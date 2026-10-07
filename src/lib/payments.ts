import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { saleStatus } from "./chariow";

// Part du TubAfrikain sur chaque cadeau. Les 20 % restants couvrent
// les frais Chariow et font vivre TubAfrik.
export const CREATOR_SHARE = 0.8;

export type PaymentState = "pending" | "paid" | "failed";

// ═══════════════════════════════════════════════════════════════
// CONFIRMER UN PAIEMENT
//
// Trois chemins y mènent: le Pulse Chariow, la page /merci qui attend,
// et la tâche planifiée qui repasse chaque minute. On ne croit jamais
// le message reçu: on redemande à Chariow l'état de la vente, puis la
// base confirme une seule fois (tub_settle_payment est rejouable).
// ═══════════════════════════════════════════════════════════════
export async function confirmPayment(paymentId: string): Promise<PaymentState> {
  const db = supabaseAdmin();
  const { data: p } = await db
    .from("tub_payments").select("id,status,chariow_sale_id,amount_fcfa").eq("id", paymentId).maybeSingle();
  if (!p) return "failed";
  // « failed » est revérifié aussi: Chariow garde le même identifiant de
  // vente quand le fan réessaie après un premier paiement raté.
  if (p.status === "paid" || !p.chariow_sale_id) return p.status as PaymentState;

  const { verdict, amount } = await saleStatus(p.chariow_sale_id);
  if (verdict === "paid") {
    // La part du créateur se calcule sur ce que Chariow a VRAIMENT encaissé:
    // une fiche oubliée à un autre prix ne doit ni léser ni surpayer personne.
    if (amount && amount !== p.amount_fcfa) {
      await db.from("tub_payments")
        .update({ amount_fcfa: amount, creator_share: Math.floor(amount * CREATOR_SHARE) })
        .eq("id", p.id).neq("status", "paid");
    }
    const { error } = await db.rpc("tub_settle_payment", { p_payment: p.id, p_sale: p.chariow_sale_id });
    if (error) {
      console.error("[CADEAU] Confirmation impossible", p.id, error.message);
      return "pending";
    }
    return "paid";
  }
  if (verdict === "failed" && p.status === "pending") {
    await db.from("tub_payments").update({ status: "failed" }).eq("id", p.id).eq("status", "pending");
    return "failed";
  }
  return p.status as PaymentState;
}
