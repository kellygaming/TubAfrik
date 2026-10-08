import { NextResponse } from "next/server";
import { validPulseSignature } from "@/lib/chariow";
import { confirmPayment } from "@/lib/payments";
import { confirmCauriPurchase } from "@/lib/cauris";

// ═══════════════════════════════════════════════════════════════
// PULSE CHARIOW — « une vente vient de bouger »
//
// On répond TOUJOURS 200: après 5 échecs, Chariow désactive le Pulse
// entier, et toutes les ventes suivantes arriveraient sans réveil.
// Le message n'est qu'un signal: confirmPayment redemande l'état de la
// vente à Chariow avant de créditer quoi que ce soit.
// ═══════════════════════════════════════════════════════════════
export async function POST(request: Request) {
  const raw = Buffer.from(await request.arrayBuffer());
  if (!validPulseSignature(raw, request.headers.get("x-chariow-signature"))) {
    console.warn("[PULSE] Signature invalide — ignoré");
    return NextResponse.json({ ok: true });
  }

  let event: { sale?: { custom_metadata?: Record<string, unknown> } } = {};
  try {
    event = JSON.parse(raw.toString("utf8"));
  } catch {
    return NextResponse.json({ ok: true });
  }

  const uuid = (v: unknown): v is string => typeof v === "string" && /^[0-9a-f-]{36}$/i.test(v);

  // Achat d'un pack de Cauris.
  const purchase = event.sale?.custom_metadata?.tub_cauri_purchase_id;
  if (uuid(purchase)) {
    try {
      return NextResponse.json({ ok: true, status: await confirmCauriPurchase(purchase) });
    } catch (e) {
      console.error("[PULSE] Achat de Cauris en échec", purchase, (e as Error).message);
      return NextResponse.json({ ok: true });
    }
  }

  // Une vente qui n'est pas un cadeau TubAfrik (recharge Kelly Gaming…) ne nous concerne pas.
  const id = event.sale?.custom_metadata?.tub_payment_id;
  if (typeof id !== "string" || !/^[0-9a-f-]{36}$/i.test(id)) return NextResponse.json({ ok: true });

  try {
    const status = await confirmPayment(id);
    return NextResponse.json({ ok: true, status });
  } catch (e) {
    console.error("[PULSE] Confirmation en échec", id, (e as Error).message);
    return NextResponse.json({ ok: true });
  }
}
