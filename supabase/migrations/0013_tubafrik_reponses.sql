-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — RÉPONDRE À UN COMMENTAIRE
--
-- Un seul niveau de fil, comme sur TikTok: une réponse à une réponse
-- se range sous le commentaire d'origine (le « @pseudo » dit à qui on
-- s'adresse). La personne à qui l'on répond est prévenue.
-- ═══════════════════════════════════════════════════════════════

alter table public.tub_comments
    add column parent_id uuid references public.tub_comments(id) on delete cascade;
create index tub_comments_parent_idx on public.tub_comments (parent_id, created_at) where parent_id is not null;
grant insert (parent_id) on public.tub_comments to authenticated;

-- Le parent doit être sur la même vidéo; on remonte toujours au commentaire racine.
create or replace function public.tub_comment_parent() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    p public.tub_comments;
begin
    if new.parent_id is null then return new; end if;
    select * into p from public.tub_comments where id = new.parent_id;
    if not found or p.video_id <> new.video_id then
        raise exception 'reponse_invalide';
    end if;
    if p.parent_id is not null then new.parent_id := p.parent_id; end if;
    return new;
end $$;
create trigger tub_comments_parent before insert on public.tub_comments
       for each row execute function public.tub_comment_parent();
revoke all on function public.tub_comment_parent() from public, anon, authenticated;

alter table public.tub_notifications drop constraint tub_notifications_kind_check;
alter table public.tub_notifications add constraint tub_notifications_kind_check
    check (kind in ('gift','follow','comment','reply'));

-- Commentaire: le créateur de la vidéo est prévenu. Réponse: la personne
-- à qui l'on répond aussi (une seule notification si c'est la même).
create or replace function public.tub_notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    author  uuid;
    replied uuid;
begin
    if new.kind <> 'text' then return null; end if;
    select author_id into author from public.tub_videos where id = new.video_id;
    if new.parent_id is not null then
        select author_id into replied from public.tub_comments where id = new.parent_id;
        if replied is not null and replied <> new.author_id then
            insert into public.tub_notifications (user_id, kind, actor_id, video_id, body)
            values (replied, 'reply', new.author_id, new.video_id, left(new.body, 140));
        end if;
    end if;
    if author is not null and author <> new.author_id and author is distinct from replied then
        insert into public.tub_notifications (user_id, kind, actor_id, video_id, body)
        values (author, 'comment', new.author_id, new.video_id, left(new.body, 140));
    end if;
    return null;
end $$;
revoke all on function public.tub_notify_comment() from public, anon, authenticated;
