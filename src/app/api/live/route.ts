import { NextResponse } from "next/server";
import { currentUser } from "@/lib/supabase/server";
import { supabaseAdmin } from "@/lib/supabase/admin";
import { createLiveInput, setLiveInputEnabled, streamConfigured } from "@/lib/cfstream";
import { canGoLive, LIVE_COLUMNS, type LiveRow } from "@/lib/lives";
import { isCategorySlug } from "@/lib/categories";

// Le créateur ouvre un live: on (ré)utilise son entrée Cloudflare et on
// crée la ligne « waiting ». Le live passe « live » quand Cloudflare
// reçoit vraiment le flux (voir lib/lives.ts).
export async function POST(request: Request) {
  const user = await currentUser();
  if (!user) return NextResponse.json({ error: "Connecte-toi pour passer en live." }, { status: 401 });
  if (!streamConfigured()) return NextResponse.json({ error: "Les lives arrivent très bientôt." }, { status: 503 });
  if (!(await canGoLive(user.id, user.email))) {
    return NextResponse.json({ error: "Les lives sont ouverts sur invitation pour l'instant." }, { status: 403 });
  }

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const title = typeof body?.title === "string" ? body.title.trim().slice(0, 80) : "";
  const category = isCategorySlug(body?.category) ? body.category : "divertissement";
  if (!title) return NextResponse.json({ error: "Donne un titre à ton live." }, { status: 400 });

  const db = supabaseAdmin();
  const { data: profile } = await db.from("tub_profiles").select("username").eq("id", user.id).maybeSingle();
  if (!profile) return NextResponse.json({ error: "Crée d'abord ton profil." }, { status: 403 });

  // Un live déjà ouvert? On le rend tel quel (double tap, onglet rouvert…).
  const { data: open } = await db.from("tub_lives").select(LIVE_COLUMNS)
    .eq("creator_id", user.id).neq("status", "ended").maybeSingle();
  if (open) return NextResponse.json({ live: open as unknown as LiveRow });

  let { data: channel } = await db.from("tub_live_channels").select("cf_input_id").eq("creator_id", user.id).maybeSingle();
  try {
    if (!channel) {
      const uid = await createLiveInput(`tubafrik:${profile.username}`);
      const { data } = await db.from("tub_live_channels")
        .insert({ creator_id: user.id, cf_input_id: uid }).select("cf_input_id").single();
      channel = data;
    } else {
      // L'antenne a pu être coupée par la modération lors d'un live précédent.
      await setLiveInputEnabled(channel.cf_input_id, true);
    }
  } catch (e) {
    console.error("live: Cloudflare", e);
    return NextResponse.json({ error: "Impossible de préparer le live. Réessaie dans un instant." }, { status: 502 });
  }
  if (!channel) return NextResponse.json({ error: "Impossible de préparer le live." }, { status: 500 });

  const { data: live, error } = await db.from("tub_lives")
    .insert({ creator_id: user.id, cf_input_id: channel.cf_input_id, title, category })
    .select(LIVE_COLUMNS).single();
  if (error || !live) return NextResponse.json({ error: "Impossible de créer le live." }, { status: 500 });
  return NextResponse.json({ live: live as unknown as LiveRow });
}
