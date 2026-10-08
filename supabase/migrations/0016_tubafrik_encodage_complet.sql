-- Une vidéo n'est « encodée » que quand Bunny a fini (statut 4). Les
-- vidéos publiées pendant les 7 derniers jours sont revérifiées par le
-- cron: celles restées en JIT sans fichiers sont réencodées.
alter table public.tub_videos add column if not exists encoded_at timestamptz;
update public.tub_videos set encoded_at = coalesce(published_at, created_at)
 where status = 'ready' and encoded_at is null and coalesce(published_at, created_at) < now() - interval '7 days';
