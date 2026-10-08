import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chariowConfigured, createCheckout, splitPhone } from "@/lib/chariow";
import { normalizePhone } from "@/lib/gifts";
import { safeReturn } from "@/lib/cauris";
import { SITE_URL } from "@/lib/format";

const MAX_OPEN_PER_HOUR = 10;

// Le fan achète un pack de Cauris. Rien n'est crédité ici: l'achat
// reste « pending » jusqu'à ce que Chariow confirme l'encaissement.
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user?.email) return NextResponse.json({ error: "Connecte-toi pour recharger." }, { status: 401 });
  if (!chariowConfigured()) return NextResponse.json({ error: "La recharge arrive très bientôt." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const slug = typeof body?.pack === "string" ? body.pack : "";
  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : null;
  const back = safeReturn(body?.retour);
  const chariowPhone = phone && splitPhone(phone);
  if (!phone || !chariowPhone) {
    return NextResponse.json({ error: "Numéro mobile money invalide. Écris-le avec l'indicatif, ex. +225 07 00 00 00 00." }, { status: 400 });
  }

  const db = supabaseAdmin();
  const [{ data: pack }, { data: me }] = await Promise.all([
    db.from("tub_cauri_packs").select("slug,name,cauris,price_fcfa,chariow_product_id,active").eq("slug", slug).maybeSingle(),
    db.from("tub_profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!pack?.active || !pack.chariow_product_id) return NextResponse.json({ error: "Ce pack n'est pas disponible." }, { status: 400 });
  if (!me) return NextResponse.json({ error: "Crée d'abord ton profil." }, { status: 403 });

  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await db.from("tub_cauri_purchases").select("id", { count: "exact", head: true })
    .eq("user_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= MAX_OPEN_PER_HOUR) return NextResponse.json({ error: "Trop de tentatives. Réessaie dans un moment." }, { status: 429 });

  const { data: purchase, error } = await db.from("tub_cauri_purchases")
    .insert({ user_id: user.id, pack_slug: pack.slug, cauris: pack.cauris, amount_fcfa: pack.price_fcfa })
    .select("id").single();
  if (error || !purchase) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });
  await db.from("tub_private").upsert({ user_id: user.id, phone, updated_at: new Date().toISOString() });

  try {
    const checkout = await createCheckout({
      productId: pack.chariow_product_id,
      email: user.email,
      name: me.display_name,
      phone: chariowPhone,
      metadata: { app: "tubafrik", tub_cauri_purchase_id: purchase.id },
      redirectUrl: `${SITE_URL}/cauris/merci?c=${purchase.id}&retour=${encodeURIComponent(back)}`,
    });
    await db.from("tub_cauri_purchases").update({ chariow_sale_id: checkout.saleId }).eq("id", purchase.id);
    return NextResponse.json({ id: purchase.id, url: checkout.url });
  } catch (e) {
    console.error("[CAURIS] Checkout Chariow refusé", purchase.id, (e as Error).message);
    await db.from("tub_cauri_purchases").update({ status: "failed" }).eq("id", purchase.id);
    return NextResponse.json({ error: "Le paiement n'a pas pu démarrer. Vérifie ton numéro et réessaie." }, { status: 502 });
  }
}
