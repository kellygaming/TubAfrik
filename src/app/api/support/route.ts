import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { chariowConfigured, createCheckout, splitPhone } from "@/lib/chariow";
import { CREATOR_SHARE } from "@/lib/payments";
import { normalizePhone } from "@/lib/gifts";
import { SITE_URL } from "@/lib/format";

const MAX_OPEN_PER_HOUR = 10;

// Un fan ouvre un paiement pour offrir un cadeau à un TubAfrikain.
// Rien n'est crédité ici: la ligne reste « pending » jusqu'à ce que
// Chariow confirme l'encaissement (voir lib/payments.ts).
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user?.email) return NextResponse.json({ error: "Connecte-toi pour envoyer un cadeau." }, { status: 401 });
  if (!chariowConfigured()) return NextResponse.json({ error: "Les cadeaux arrivent très bientôt." }, { status: 503 });

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const creatorId = typeof body?.creator === "string" ? body.creator : "";
  const giftSlug = typeof body?.gift === "string" ? body.gift : "";
  const videoId = typeof body?.video === "string" ? body.video : null;
  const message = typeof body?.message === "string" ? body.message.trim().slice(0, 150) || null : null;
  const phone = typeof body?.phone === "string" ? normalizePhone(body.phone) : null;

  const chariowPhone = phone && splitPhone(phone);
  if (!phone || !chariowPhone) {
    return NextResponse.json({ error: "Numéro mobile money invalide. Écris-le avec l'indicatif, ex. +225 07 00 00 00 00." }, { status: 400 });
  }
  if (creatorId === user.id) return NextResponse.json({ error: "Tu ne peux pas t'offrir un cadeau 😄" }, { status: 400 });

  const db = supabaseAdmin();
  const [{ data: gift }, { data: creator }, { data: me }] = await Promise.all([
    db.from("tub_gifts").select("slug,name,price_fcfa,chariow_product_id,active").eq("slug", giftSlug).maybeSingle(),
    db.from("tub_profiles").select("id").eq("id", creatorId).maybeSingle(),
    db.from("tub_profiles").select("display_name").eq("id", user.id).maybeSingle(),
  ]);
  if (!gift?.active || !gift.chariow_product_id) return NextResponse.json({ error: "Ce cadeau n'est pas disponible." }, { status: 400 });
  if (!creator) return NextResponse.json({ error: "Créateur introuvable." }, { status: 404 });
  if (!me) return NextResponse.json({ error: "Crée d'abord ton profil." }, { status: 403 });

  // Une vidéo n'est acceptée que si elle appartient bien au créateur.
  let video: string | null = null;
  if (videoId) {
    const { data: v } = await db.from("tub_videos").select("id").eq("id", videoId).eq("author_id", creatorId).maybeSingle();
    video = v?.id ?? null;
  }

  // Anti-abus: pas de rafale de paiements ouverts.
  const since = new Date(Date.now() - 3600 * 1000).toISOString();
  const { count } = await db.from("tub_payments").select("id", { count: "exact", head: true })
    .eq("payer_id", user.id).gte("created_at", since);
  if ((count ?? 0) >= MAX_OPEN_PER_HOUR) {
    return NextResponse.json({ error: "Trop de tentatives. Réessaie dans un moment." }, { status: 429 });
  }

  const { data: payment, error } = await db.from("tub_payments").insert({
    payer_id: user.id,
    creator_id: creatorId,
    video_id: video,
    gift_slug: gift.slug,
    amount_fcfa: gift.price_fcfa,
    creator_share: Math.floor(gift.price_fcfa * CREATOR_SHARE),
    message,
  }).select("id").single();
  if (error) return NextResponse.json({ error: "Enregistrement impossible." }, { status: 500 });

  await db.from("tub_private").upsert({ user_id: user.id, phone, updated_at: new Date().toISOString() });

  try {
    const checkout = await createCheckout({
      productId: gift.chariow_product_id,
      email: user.email,
      name: me.display_name,
      phone: chariowPhone,
      // « app » permet à tout autre récepteur de Pulse (le bot Kelly
      // Gaming) de reconnaître et d'ignorer une vente TubAfrik.
      metadata: { app: "tubafrik", tub_payment_id: payment.id },
      redirectUrl: `${SITE_URL}/merci?p=${payment.id}`,
    });
    await db.from("tub_payments").update({ chariow_sale_id: checkout.saleId }).eq("id", payment.id);
    return NextResponse.json({ id: payment.id, url: checkout.url });
  } catch (e) {
    console.error("[CADEAU] Checkout Chariow refusé", payment.id, (e as Error).message);
    await db.from("tub_payments").update({ status: "failed" }).eq("id", payment.id);
    return NextResponse.json({ error: "Le paiement n'a pas pu démarrer. Vérifie ton numéro et réessaie." }, { status: 502 });
  }
}
