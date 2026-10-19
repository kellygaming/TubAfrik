-- « Ta vidéo est en ligne, partage-la »: dans l'Activité dès la publication.
-- Déjà couverte par son propre email: jamais reprise dans le résumé.
alter table public.tub_notifications drop constraint tub_notifications_kind_check;
alter table public.tub_notifications add constraint tub_notifications_kind_check
    check (kind in ('gift','follow','comment','reply','published'));

create or replace function public.tub_notify_published() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if new.status = 'ready' and old.status is distinct from 'ready'
       and not exists (select 1 from public.tub_notifications
                        where kind = 'published' and video_id = new.id) then
        insert into public.tub_notifications (user_id, kind, actor_id, video_id, body, emailed_at)
        values (new.author_id, 'published', new.author_id, new.id, nullif(left(new.caption, 140), ''), now());
    end if;
    return null;
end $$;

drop trigger if exists tub_videos_published on public.tub_videos;
create trigger tub_videos_published after update of status on public.tub_videos
    for each row execute function public.tub_notify_published();
