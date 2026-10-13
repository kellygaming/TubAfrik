-- Mise en avant d'une vidéo (challenge, annonce): 2e position du fil
-- « Pour toi » pour tout le monde, toutes catégories, avec un badge.
-- Pas encombrant: jamais remontrée à qui l'a vue aujourd'hui ou hier.
alter table public.tub_videos
    add column if not exists featured_until timestamptz,
    add column if not exists featured_label text check (featured_label is null or char_length(featured_label) <= 40);

create or replace function public.tub_featured(p_anon_key text default null)
returns setof jsonb
language sql stable security definer set search_path = '' as $$
with me as (
    select coalesce(auth.uid()::text,
                    case when p_anon_key ~ '^[A-Za-z0-9_-]{16,64}$' then 'a:' || p_anon_key end) as viewer
)
select to_jsonb(f) || jsonb_build_object('featured', coalesce(v.featured_label, 'À la une'))
  from public.tub_videos v
  join public.tub_feed_items f on f.id = v.id
 where v.featured_until > now()
   and v.status = 'ready'
   and not exists (
       select 1 from public.tub_views w
        where w.video_id = v.id and w.viewer_key = (select viewer from me) and w.day >= current_date - 1)
 order by v.featured_until desc
 limit 2;
$$;
revoke all on function public.tub_featured(text) from public;
grant execute on function public.tub_featured(text) to anon, authenticated;
