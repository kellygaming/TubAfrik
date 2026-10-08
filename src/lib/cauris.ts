import "server-only";
import { supabaseAdmin } from "./supabase/admin";
import { saleStatus } from "./chariow";
import type { PaymentState } from "./payments";

// ═══════════════════════════════════════════════════════════════
// CONFIRMER UN ACHAT DE CAURIS
//
// Même règle que pour les cadeaux: le Pulse, la page de retour et la
// tâche planifiée ne font que demander « où en est cette vente ? » à
// Chariow. La base ne crédite qu'une fois (tub_settle_cauri_purchase
// est rejouable).
// ═══════════════════════════════════════════════════════════════
export async function confirmCauriPurchase(purchaseId: string): Promise<PaymentState> {
  const db = supabaseAdmin();
  const { data: c } = await db.from("tub_cauri_purchases")
    .select("id,status,chariow_sale_id,amount_fcfa,cauris").eq("id", purchaseId).maybeSingle();
  if (!c) return "failed";
  if (c.status === "paid" || !c.chariow_sale_id) return c.status as PaymentState;

  const { verdict, amount } = await saleStatus(c.chariow_sale_id);
  if (verdict === "paid") {
    // Encaissé moins que prévu (fiche Chariow à un autre prix): les Cauris
    // suivent ce qui a vraiment été payé, jamais plus.
    if (amount && amount < c.amount_fcfa) {
      const cauris = Math.max(1, Math.floor((c.cauris * amount) / c.amount_fcfa));
      await db.from("tub_cauri_purchases").update({ amount_fcfa: amount, cauris }).eq("id", c.id).neq("status", "paid");
    }
    const { error } = await db.rpc("tub_settle_cauri_purchase", { p_purchase: c.id, p_sale: c.chariow_sale_id });
    if (error) {
      console.error("[CAURIS] Crédit impossible", c.id, error.message);
      return "pending";
    }
    return "paid";
  }
  if (verdict === "failed" && c.status === "pending") {
    await db.from("tub_cauri_purchases").update({ status: "failed" }).eq("id", c.id).eq("status", "pending");
    return "failed";
  }
  return c.status as PaymentState;
}

/** Chemin de retour sûr après paiement: interne au site uniquement. */
export function safeReturn(path: unknown) {
  return typeof path === "string" && /^\/(?!\/)[\w\-/.?=&%]*$/.test(path) && path.length < 200 ? path : "/";
}

/** 1 Cauri = 10 F de cadeau. */
export const giftCost = (priceFcfa: number) => Math.ceil(priceFcfa / 10);
