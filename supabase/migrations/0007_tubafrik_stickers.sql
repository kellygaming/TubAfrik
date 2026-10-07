-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — STICKERS TIRÉS DES VIDÉOS, ET SUPPRESSION DES COMMENTAIRES
--
-- 1. Un spectateur fige un moment d'une vidéo, le recadre, ajoute un
--    texte s'il veut: c'est un sticker. Il le poste en commentaire;
--    ceux qui le voient peuvent l'ajouter à leur collection et le
--    réutiliser ailleurs. Les mèmes de la plateforme naissent ici.
--    L'image (WebP ~15 Ko) vit dans le bucket public tub-stickers,
--    rangée dans le dossier de son créateur.
-- 2. Un commentaire peut n'être qu'un sticker: le texte devient
--    facultatif quand un sticker l'accompagne.
-- 3. Le créateur d'une vidéo peut supprimer les commentaires postés
--    dessous (modération de son propre espace), en plus de leurs
--    auteurs.
-- ═══════════════════════════════════════════════════════════════

create table public.tub_stickers (
    id              uuid primary key default gen_random_uuid(),
    creator_id      uuid not null references public.tub_profiles(id) on delete cascade,
    source_video_id uuid references public.tub_videos(id) on delete set null,
    image_path      text not null check (image_path ~ '^[0-9a-f-]{36}/[0-9a-f-]{36}\.(webp|jpg)$'),
    caption         text check (caption is null or char_length(caption) <= 40),
    uses_count      integer not null default 0,
    status          text not null default 'active' check (status in ('active','removed')),
    created_at      timestamptz not null default now()
);
create index tub_stickers_popular_idx on public.tub_stickers (uses_count desc, created_at desc) where status = 'active';
create index tub_stickers_creator_idx on public.tub_stickers (creator_id, created_at desc);

-- La collection personnelle: stickers créés ou ajoutés depuis un commentaire.
create table public.tub_sticker_saves (
    user_id    uuid not null references public.tub_profiles(id) on delete cascade,
    sticker_id uuid not null references public.tub_stickers(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, sticker_id)
);

alter table public.tub_stickers      enable row level security;
alter table public.tub_sticker_saves enable row level security;
revoke all on public.tub_stickers, public.tub_sticker_saves from public, anon, authenticated;

grant select on public.tub_stickers to anon, authenticated;
grant insert (creator_id, source_video_id, image_path, caption) on public.tub_stickers to authenticated;
create policy tub_stickers_read on public.tub_stickers for select
    using (status = 'active' or creator_id = (select auth.uid()));
create policy tub_stickers_insert on public.tub_stickers for insert to authenticated
    with check (creator_id = (select auth.uid()) and split_part(image_path, '/', 1) = (select auth.uid())::text);

grant select, insert, delete on public.tub_sticker_saves to authenticated;
create policy tub_sticker_saves_own on public.tub_sticker_saves for all to authenticated
    using (user_id = (select auth.uid())) with check (user_id = (select auth.uid()));

-- Anti-abus: 30 stickers créés par jour et par compte.
create or replace function public.tub_sticker_quota() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if (select count(*) from public.tub_stickers
         where creator_id = new.creator_id and created_at > now() - interval '1 day') >= 30 then
        raise exception 'quota_stickers';
    end if;
    return new;
end $$;
create trigger tub_stickers_quota before insert on public.tub_stickers
       for each row execute function public.tub_sticker_quota();

-- ── Commentaires: sticker facultatif, texte facultatif s'il y a un sticker ──
alter table public.tub_comments add column sticker_id uuid references public.tub_stickers(id) on delete set null;
alter table public.tub_comments drop constraint tub_comments_body_check;
alter table public.tub_comments add constraint tub_comments_body_check
    check (char_length(body) <= 300 and (char_length(btrim(body)) >= 1 or sticker_id is not null));
grant insert (sticker_id) on public.tub_comments to authenticated;

-- Compteur d'utilisations (classement « Populaires »).
create or replace function public.tub_count_sticker_use() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if new.sticker_id is not null then
        update public.tub_stickers set uses_count = uses_count + 1 where id = new.sticker_id;
    end if;
    return null;
end $$;
create trigger tub_comments_sticker_use after insert on public.tub_comments
       for each row execute function public.tub_count_sticker_use();

revoke all on function public.tub_sticker_quota(), public.tub_count_sticker_use()
       from public, anon, authenticated;

-- ── Le créateur modère les commentaires de ses vidéos ──
create policy tub_comments_delete_video_owner on public.tub_comments for delete to authenticated
    using (exists (select 1 from public.tub_videos v
                    where v.id = video_id and v.author_id = (select auth.uid())));

-- ── Stockage des images de stickers ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tub-stickers', 'tub-stickers', true, 307200, array['image/webp','image/jpeg'])
on conflict (id) do nothing;

create policy tub_stickers_upload on storage.objects for insert to authenticated
  with check (bucket_id = 'tub-stickers' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tub_stickers_select_own on storage.objects for select to authenticated
  using (bucket_id = 'tub-stickers' and (storage.foldername(name))[1] = (select auth.uid())::text);
