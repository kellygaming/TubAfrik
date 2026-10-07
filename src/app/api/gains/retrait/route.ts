import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { normalizePhone, PAYOUT_METHODS } from "@/lib/gifts";

const ERRORS: Record<string, [string, number]> = {
  retrait_en_cours: ["Un retrait est déjà en cours de traitement.", 409],
  solde_vide: ["Rien à retirer pour l'instant.", 400],
  non_connecte: ["Connecte-toi.", 401],
};

// Le TubAfrikain demande son argent: tout le disponible, sans minimum.
// Le montant est calculé et débité par la base, dans une seule transaction.
export async function POST(request: Request) {
  const body = (await request.json().catch(() => null)) as { method?: unknown; phone?: unknown } | null;
  const method = PAYOUT_METHODS.find((m) => m.id === body?.method)?.id;
  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : null;
  if (!method) return NextResponse.json({ error: "Choisis ton moyen de paiement." }, { status: 400 });
  if (!phone) return NextResponse.json({ error: "Numéro invalide. Écris-le avec l'indicatif, ex. +225 07 00 00 00 00." }, { status: 400 });

  const supabase = await supabaseServer();
  const { data, error } = await supabase.rpc("tub_request_withdrawal", { p_method: method, p_phone: phone });
  if (error) {
    const [message, status] = Object.entries(ERRORS).find(([k]) => error.message.includes(k))?.[1] ?? ["Demande impossible, réessaie.", 500];
    return NextResponse.json({ error: message }, { status });
  }
  return NextResponse.json({ id: data });
}
