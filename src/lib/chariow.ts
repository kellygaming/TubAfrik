import "server-only";
import { createHmac, timingSafeEqual } from "node:crypto";

// ═══════════════════════════════════════════════════════════════
// CHARIOW — le guichet mobile money des cadeaux
//
// Repris du bot Kelly Gaming (telegram-g2bulk-bot/api/_lib/chariow.js),
// où chaque règle ci-dessous a été apprise sur une vraie vente:
//
//   • un cadeau = un produit « Licence » à PRIX FIXE: Chariow refuse en
//     422 le prix libre et les produits Service passés par l'API ;
//   • le téléphone est découpé d'après son indicatif, jamais d'après le
//     pays du visiteur — une paire incohérente fait refuser le paiement ;
//   • la signature d'un Pulse se calcule sur les octets BRUTS du corps ;
//   • une vente payée a le statut « completed » OU « settled » (reversée).
//
// La vérité sur un paiement, c'est GET /sales/{id}: le Pulse ne sert
// qu'à nous réveiller plus vite. Un Pulse perdu ne perd donc rien.
// ═══════════════════════════════════════════════════════════════

const API = "https://api.chariow.com/v1";
const TIMEOUT = 15_000;

function key() {
  const k = process.env.CHARIOW_API_KEY;
  if (!k) throw new Error("CHARIOW_API_KEY absente");
  return k;
}

export const chariowConfigured = () => Boolean(process.env.CHARIOW_API_KEY);

// Du plus long au plus court, pour qu'un indicatif ne masque jamais un autre.
const DIAL_CODES: [string, string][] = [
  ["261", "MG"], ["225", "CI"], ["221", "SN"], ["243", "CD"], ["242", "CG"],
  ["237", "CM"], ["241", "GA"], ["226", "BF"], ["223", "ML"], ["229", "BJ"],
  ["228", "TG"], ["224", "GN"], ["227", "NE"], ["235", "TD"], ["234", "NG"],
  ["254", "KE"], ["233", "GH"], ["250", "RW"], ["257", "BI"], ["236", "CF"],
  ["240", "GQ"], ["222", "MR"], ["212", "MA"], ["216", "TN"], ["213", "DZ"],
  ["351", "PT"], ["352", "LU"], ["353", "IE"], ["33", "FR"], ["32", "BE"],
  ["49", "DE"], ["44", "GB"], ["34", "ES"], ["39", "IT"], ["41", "CH"],
  ["31", "NL"], ["1", "US"],
];

/** « +225 07 00 00 00 00 » → { number: "0700000000", country_code: "CI" }, ou null. */
export function splitPhone(phone: string) {
  const digits = phone.replace(/\D/g, "");
  for (const [dial, country] of DIAL_CODES) {
    if (!digits.startsWith(dial)) continue;
    const number = digits.slice(dial.length);
    return number.length >= 6 ? { number, country_code: country } : null;
  }
  return null;
}

function splitName(name: string, email: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length) {
    return { first_name: parts[0].slice(0, 50), last_name: (parts.slice(1).join(" ") || parts[0]).slice(0, 50) };
  }
  return { first_name: (email.split("@")[0] || "Fan").slice(0, 50), last_name: "TubAfrik" };
}

export async function createCheckout(o: {
  productId: string;
  email: string;
  name: string;
  phone: { number: string; country_code: string };
  metadata: Record<string, string>;
  redirectUrl: string;
}) {
  const res = await fetch(`${API}/checkout`, {
    method: "POST",
    headers: { Authorization: `Bearer ${key()}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      product_id: o.productId,
      email: o.email,
      ...splitName(o.name, o.email),
      phone: o.phone,
      custom_metadata: o.metadata,
      redirect_url: o.redirectUrl,
    }),
    signal: AbortSignal.timeout(TIMEOUT),
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Chariow ${res.status}: ${text.slice(0, 300)}`);
  const data = (JSON.parse(text)?.data ?? {}) as {
    step?: string;
    payment?: { checkout_url?: string };
    purchase?: { id?: string };
  };
  if (data.step !== "payment" || !data.payment?.checkout_url) {
    throw new Error(`Chariow: étape inattendue « ${data.step} »`);
  }
  return { url: data.payment.checkout_url, saleId: data.purchase?.id ?? null };
}

export type SaleVerdict = "paid" | "failed" | "pending" | "unknown";

/** Ce que Chariow sait de la vente. « unknown » = injoignable ou inconnue: on ne conclut rien. */
export async function saleStatus(saleId: string): Promise<SaleVerdict> {
  let res: Response;
  try {
    res = await fetch(`${API}/sales/${encodeURIComponent(saleId)}`, {
      headers: { Authorization: `Bearer ${key()}` },
      signal: AbortSignal.timeout(10_000),
      cache: "no-store",
    });
  } catch {
    return "unknown";
  }
  if (!res.ok) return "unknown";
  const sale = ((await res.json().catch(() => null))?.data ?? {}) as {
    status?: string;
    payment?: { status?: string };
  };
  const status = String(sale.status ?? "").toLowerCase();
  const payment = String(sale.payment?.status ?? "").toLowerCase();
  if (status === "completed" || status === "settled" || payment === "success") return "paid";
  if (status === "failed" || status === "abandoned" || payment === "failed" || payment === "cancelled") return "failed";
  return "pending";
}

/** Signature d'un Pulse: « sha256=<HMAC-SHA256 du corps brut> », comparée en temps constant. */
export function validPulseSignature(rawBody: Buffer, header: string | null) {
  const secret = process.env.CHARIOW_PULSE_SECRET;
  if (!secret || !header?.startsWith("sha256=")) return false;
  const expected = Buffer.from(`sha256=${createHmac("sha256", secret).update(rawBody).digest("hex")}`);
  const got = Buffer.from(header);
  return got.length === expected.length && timingSafeEqual(got, expected);
}
