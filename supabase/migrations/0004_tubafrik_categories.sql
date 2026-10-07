-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — OUVERT À TOUS LES CRÉATEURS, UN FIL PAR PERSONNE
--
-- 1. Catégories: musique, cuisine, sport, humour… Le gaming devient
--    une catégorie parmi d'autres; la colonne `game` ne sert plus que
--    de sous-filtre quand category = 'gaming'.
-- 2. Centres d'intérêt: choisis à l'inscription, puis appris de ce que
--    la personne aime, regarde et suit.
-- 3. tub_feed_v2: le « Pour toi » est propre à chacun. Il pondère le
--    score de chaque vidéo par l'affinité de la personne avec sa
--    catégorie, y ajoute un hasard stable pendant une session (graine
--    envoyée par le navigateur), relègue ce qui a déjà été vu, et évite
--    d'enchaîner le même créateur ou la même catégorie.
--    tub_feed reste en place pour les versions du site déjà ouvertes.
-- 4. Cadeaux: « Booyah » ne parle qu'aux joueurs de Free Fire; il
--    devient « Rose », compris par tout le monde.
-- ═══════════════════════════════════════════════════════════════

-- ── Vidéos ──────────────────────────────────────────────────────
alter table public.tub_videos
    add column category text not null default 'divertissement'
    constraint tub_videos_category_check check (category in (
        'divertissement','humour','musique','danse','gaming','sport','cuisine','beaute-mode',
        'lifestyle','education','tech','business','voyage','animaux','autre'));

update public.tub_videos set category = 'gaming' where game is not null and game <> 'hors-gaming';
update public.tub_videos set game = null where game = 'hors-gaming';

create index tub_videos_category_idx on public.tub_videos (category, published_at desc) where status = 'ready';
create index tub_views_viewer_idx on public.tub_views (viewer_key, day);

-- ── Profils ─────────────────────────────────────────────────────
alter table public.tub_profiles
    add column main_category text
        constraint tub_profiles_main_category_check check (main_category is null or main_category in (
            'divertissement','humour','musique','danse','gaming','sport','cuisine','beaute-mode',
            'lifestyle','education','tech','business','voyage','animaux','autre')),
    add column interests text[] not null default '{}'
        constraint tub_profiles_interests_check check (cardinality(interests) <= 15 and interests <@ array[
            'divertissement','humour','musique','danse','gaming','sport','cuisine','beaute-mode',
            'lifestyle','education','tech','business','voyage','animaux','autre']::text[]);

update public.tub_profiles set main_category = 'gaming' where main_game is not null and main_game <> 'hors-gaming';
update public.tub_profiles set main_game = null where main_game = 'hors-gaming';

grant insert (main_category, interests) on public.tub_profiles to authenticated;
grant update (main_category, interests) on public.tub_profiles to authenticated;

-- ── Le fil: la catégorie s'ajoute en fin de vue (ordre des colonnes imposé) ──
create or replace view public.tub_feed_items with (security_invoker = true) as
select v.id, v.bunny_id, v.caption, v.game, v.duration_s, v.width, v.height,
       v.thumbnail_file, v.likes_count, v.comments_count, v.views_count,
       v.published_at, v.author_id,
       p.username, p.display_name, p.avatar_url,
       (1 + v.likes_count * 3 + v.comments_count * 5 + v.views_count * 0.2)
         / power(extract(epoch from (now() - v.published_at)) / 3600 + 2, 1.5) as score,
       v.category
  from public.tub_videos v
  join public.tub_profiles p on p.id = v.author_id
 where v.status = 'ready';

-- security definer: la fonction lit l'historique de vues de la personne
-- (tub_views n'est lisible par personne via l'API). Elle ne lit que
-- celui de auth.uid() ou de l'identifiant anonyme fourni, et ne renvoie
-- que des vidéos publiées.
create or replace function public.tub_feed_v2(
    p_mode      text    default 'pour-toi',
    p_category  text    default null,
    p_game      text    default null,
    p_interests text[]  default null,
    p_seed      text    default null,
    p_anon_key  text    default null,
    p_limit     integer default 8,
    p_offset    integer default 0
) returns setof public.tub_feed_items
language sql stable security definer set search_path = '' as $$
with me as (
    select auth.uid() as uid,
           coalesce(auth.uid()::text,
                    case when p_anon_key ~ '^[A-Za-z0-9_-]{16,64}$' then 'a:' || p_anon_key end) as viewer
),
prefs as (
    -- Déclaré: les centres d'intérêt du profil, ou ceux que le navigateur
    -- d'un visiteur a retenus (au plus 15, catégories connues seulement).
    select unnest(coalesce((select p.interests from public.tub_profiles p where p.id = (select uid from me)), '{}')
                  || coalesce(p_interests[1:15], '{}')) as category, 3.0 as w
    union all
    -- Appris: ce qu'on aime pèse plus que ce qu'on regarde.
    select v.category, 1.0
      from public.tub_likes l join public.tub_videos v on v.id = l.video_id
     where l.user_id = (select uid from me) and l.created_at > now() - interval '60 days'
    union all
    select v.category, 0.3
      from public.tub_views w join public.tub_videos v on v.id = w.video_id
     where w.viewer_key = (select viewer from me) and w.day > current_date - 30
    union all
    select pr.main_category, 2.0
      from public.tub_follows f join public.tub_profiles pr on pr.id = f.followee_id
     where f.follower_id = (select uid from me) and pr.main_category is not null
),
aff as (
    select category, least(sum(w), 12) as a from prefs where category is not null group by category
),
total as (select coalesce(sum(a), 0) as t from aff),
seen as (
    select video_id from public.tub_views
     where viewer_key = (select viewer from me) and day > current_date - 3
),
base as (
    select f.*,
           f.score
           -- Affinité: une catégorie qu'on adore pèse jusqu'à ~12× une
           -- catégorie jamais vue, qui garde quand même sa chance (0,35).
           * case when (select t from total) = 0 then 1
                  else 0.35 + coalesce((select a from aff where aff.category = f.category), 0) / (select t from total) * 4
             end
           -- Hasard stable pour une graine donnée: deux personnes, ou deux
           -- sessions, ne voient pas le même ordre.
           * (0.55 + (abs(hashtext(coalesce(p_seed, '') || f.id::text)) % 1000) / 1000.0 * 0.9)
           -- Déjà vu ces 3 derniers jours: repoussé loin, pas supprimé.
           * case when f.id in (select video_id from seen) then 0.12 else 1 end as s
      from public.tub_feed_items f
     where (p_category is null or f.category = p_category)
       and (p_game is null or f.game = p_game)
       and (p_mode <> 'abonnements' or f.author_id in
              (select followee_id from public.tub_follows where follower_id = (select uid from me)))
),
spread as (
    select b.*,
           row_number() over (partition by b.author_id order by b.s desc) as ra,
           row_number() over (partition by b.category  order by b.s desc) as rc
      from base b
)
select id, bunny_id, caption, game, duration_s, width, height, thumbnail_file,
       likes_count, comments_count, views_count, published_at, author_id,
       username, display_name, avatar_url, score, category
  from spread
 order by case when p_mode = 'abonnements' then extract(epoch from published_at)
               -- Variété: la 2e vidéo d'un même créateur vaut 60 %, la 3e 36 %…
               -- et sans filtre, une catégorie ne monopolise pas l'écran.
               else s * power(0.6, ra - 1) * case when p_category is null then power(0.85, rc - 1) else 1 end
          end desc,
          published_at desc
 limit least(greatest(p_limit, 1), 30)
offset greatest(p_offset, 0);
$$;
revoke all on function public.tub_feed_v2(text, text, text, text[], text, text, integer, integer) from public;
grant execute on function public.tub_feed_v2(text, text, text, text[], text, text, integer, integer) to anon, authenticated;

-- ── Cadeaux: des noms que tout le monde comprend ────────────────
update public.tub_gifts set slug = 'rose', name = 'Rose', emoji = '🌹' where slug = 'booyah';
