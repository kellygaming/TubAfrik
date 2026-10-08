-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — UN « POUR TOI » VRAIMENT MÉLANGÉ
--
-- Avant: score = engagement / (âge en heures + 2)^1,5, multiplié par un
-- hasard de ×0,55 à ×1,45. La fraîcheur écrasait tout (une vidéo d'une
-- heure pesait ~70× plus qu'une vidéo de deux jours): le fil restait
-- chronologique et identique pour tout le monde.
--
-- Maintenant: un TIRAGE AU SORT PONDÉRÉ (méthode d'Efraimidis-Spirakis).
-- Chaque vidéo reçoit un poids; sa clé de tri vaut u^(1/poids), u étant
-- un hasard propre à la session (graine) et à la vidéo. Une vidéo deux
-- fois plus « lourde » a deux fois plus de chances de passer devant,
-- mais aucune n'est jamais écartée.
--
-- Le poids:
--   • popularité en logarithme (vues, likes, commentaires): les vidéos
--     qui plaisent remontent, sans écraser celles qui débutent;
--   • fraîcheur douce (demi-vie de l'ordre de la semaine) et coup de
--     pouce aux vidéos de moins de 48 h pour qu'elles aient leur chance;
--   • affinité de la personne avec la catégorie (inchangé);
--   • déjà vu ces 3 derniers jours: repoussé loin (inchangé).
-- Même signature que la version précédente: le site n'a rien à changer.
-- ═══════════════════════════════════════════════════════════════

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
    select unnest(coalesce((select p.interests from public.tub_profiles p where p.id = (select uid from me)), '{}')
                  || coalesce(p_interests[1:15], '{}')) as category, 3.0 as w
    union all
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
weighted as (
    select f.*,
           -- Popularité: 1 au départ, ~3,5 vers 100 vues, ~6 vers 2 000 vues engagées.
           (1 + ln(1 + f.views_count * 0.2 + f.likes_count * 3 + f.comments_count * 5) * 0.8)
           -- Fraîcheur douce: ×1 à la publication, ×0,6 à 1 semaine, ×0,4 à 1 mois.
           * power(1 + extract(epoch from (now() - f.published_at)) / 86400 / 7, -0.6)
           -- Les toutes nouvelles ont leur chance d'être vues.
           * case when f.published_at > now() - interval '48 hours' then 1.6 else 1 end
           * case when (select t from total) = 0 then 1
                  else 0.35 + coalesce((select a from aff where aff.category = f.category), 0) / (select t from total) * 4
             end
           * case when f.id in (select video_id from seen) then 0.08 else 1 end as w,
           -- Hasard stable pour une session: dans ]0;1[.
           ((abs(hashtext(coalesce(p_seed, '') || f.id::text)) % 1000003) + 1) / 1000005.0 as u
      from public.tub_feed_items f
     where (p_category is null or f.category = p_category)
       and (p_game is null or f.game = p_game)
       and (p_mode <> 'abonnements' or f.author_id in
              (select followee_id from public.tub_follows where follower_id = (select uid from me)))
),
keyed as (
    select wt.*, power(wt.u, 1.0 / greatest(wt.w, 0.0001)) as k from weighted wt
),
spread as (
    select k2.*,
           row_number() over (partition by k2.author_id order by k2.k desc) as ra,
           row_number() over (partition by k2.category  order by k2.k desc) as rc
      from keyed k2
)
select id, bunny_id, caption, game, duration_s, width, height, thumbnail_file,
       likes_count, comments_count, views_count, published_at, author_id,
       username, display_name, avatar_url, score, category
  from spread
 order by case when p_mode = 'abonnements' then extract(epoch from published_at)
               -- Variété: pas deux vidéos du même créateur coup sur coup,
               -- et sans filtre, une catégorie ne monopolise pas l'écran.
               else k * power(0.75, ra - 1) * case when p_category is null then power(0.92, rc - 1) else 1 end
          end desc,
          id
 limit least(greatest(p_limit, 1), 30)
offset greatest(p_offset, 0);
$$;
