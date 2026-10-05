-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — VERSION MINIMALE
--
-- Vit dans le même projet Supabase que Kelly Gaming: un seul compte
-- Google, une seule session, et plus tard un seul portefeuille pour
-- les codes créateurs et les cadeaux. Toutes les tables portent le
-- préfixe `tub_` pour ne jamais croiser celles de la boutique.
--
-- Leçon du verrouillage RLS du 20/08 côté Kelly Gaming: ici RLS est
-- activé dès la création, et les droits sont accordés colonne par
-- colonne. Les compteurs (likes, vues, abonnés) ne s'écrivent que par
-- les déclencheurs, jamais depuis le navigateur.
--
-- Les vidéos elles-mêmes ne passent pas par ici: elles vivent chez
-- Bunny Stream. Une ligne `tub_videos` n'est créée que par le serveur
-- (service_role), au moment où Bunny attribue son identifiant.
-- ═══════════════════════════════════════════════════════════════

-- ── Profils ─────────────────────────────────────────────────────
create table public.tub_profiles (
    id              uuid primary key references auth.users(id) on delete cascade,
    username        text not null unique
                    check (username ~ '^[a-z0-9_.]{3,24}$'),
    display_name    text not null check (char_length(display_name) between 1 and 40),
    avatar_url      text check (avatar_url is null or avatar_url ~ '^https://'),
    bio             text check (bio is null or char_length(bio) <= 160),
    main_game       text,
    country         text check (country is null or country ~ '^[A-Z]{2}$'),
    followers_count integer not null default 0,
    following_count integer not null default 0,
    videos_count    integer not null default 0,
    created_at      timestamptz not null default now()
);

-- ── Vidéos ──────────────────────────────────────────────────────
-- uploading  → ligne créée, le navigateur envoie le fichier à Bunny
-- processing → Bunny a reçu le fichier et encode
-- ready      → visible dans le fil
-- failed     → l'encodage a échoué
-- review     → masquée automatiquement après plusieurs signalements
-- removed    → retirée par son auteur ou par la modération
create table public.tub_videos (
    id              uuid primary key default gen_random_uuid(),
    author_id       uuid not null references public.tub_profiles(id) on delete cascade,
    bunny_id        text not null unique,
    caption         text not null default '' check (char_length(caption) <= 300),
    game            text,
    status          text not null default 'uploading'
                    check (status in ('uploading','processing','ready','failed','review','removed')),
    duration_s      numeric(8,2),
    width           integer,
    height          integer,
    thumbnail_file  text,
    likes_count     integer not null default 0,
    comments_count  integer not null default 0,
    views_count     integer not null default 0,
    created_at      timestamptz not null default now(),
    published_at    timestamptz
);
create index tub_videos_ready_idx  on public.tub_videos (published_at desc) where status = 'ready';
create index tub_videos_author_idx on public.tub_videos (author_id, created_at desc);
create index tub_videos_game_idx   on public.tub_videos (game, published_at desc) where status = 'ready';

-- ── Interactions ────────────────────────────────────────────────
create table public.tub_likes (
    user_id    uuid not null references public.tub_profiles(id) on delete cascade,
    video_id   uuid not null references public.tub_videos(id) on delete cascade,
    created_at timestamptz not null default now(),
    primary key (user_id, video_id)
);
create index tub_likes_video_idx on public.tub_likes (video_id);

create table public.tub_comments (
    id         uuid primary key default gen_random_uuid(),
    video_id   uuid not null references public.tub_videos(id) on delete cascade,
    author_id  uuid not null references public.tub_profiles(id) on delete cascade,
    body       text not null check (char_length(btrim(body)) between 1 and 300),
    created_at timestamptz not null default now()
);
create index tub_comments_video_idx on public.tub_comments (video_id, created_at desc);

create table public.tub_follows (
    follower_id uuid not null references public.tub_profiles(id) on delete cascade,
    followee_id uuid not null references public.tub_profiles(id) on delete cascade,
    created_at  timestamptz not null default now(),
    primary key (follower_id, followee_id),
    check (follower_id <> followee_id)
);
create index tub_follows_followee_idx on public.tub_follows (followee_id);

-- Une vue par spectateur, par vidéo et par jour. `viewer_key` vaut
-- l'id du compte, ou « a: » + un identifiant tiré au hasard par le
-- navigateur pour les visiteurs non connectés (liens WhatsApp).
-- Le jour où les vues rapporteront de l'argent, seules celles où
-- `is_auth` est vrai compteront: un identifiant anonyme se fabrique.
create table public.tub_views (
    video_id   uuid not null references public.tub_videos(id) on delete cascade,
    viewer_key text not null,
    day        date not null default current_date,
    is_auth    boolean not null,
    created_at timestamptz not null default now(),
    primary key (video_id, viewer_key, day)
);

create table public.tub_reports (
    id          uuid primary key default gen_random_uuid(),
    video_id    uuid not null references public.tub_videos(id) on delete cascade,
    reporter_id uuid not null references public.tub_profiles(id) on delete cascade,
    reason      text not null check (reason in
                ('nudite','violence','haine','arnaque','droits_auteur','spam','autre')),
    details     text check (details is null or char_length(details) <= 300),
    status      text not null default 'open' check (status in ('open','resolved','dismissed')),
    created_at  timestamptz not null default now(),
    unique (video_id, reporter_id)
);
create index tub_reports_open_idx on public.tub_reports (video_id) where status = 'open';

-- ═══════════════════════════════════════════════════════════════
-- DROITS — rien par défaut, puis le strict nécessaire
-- ═══════════════════════════════════════════════════════════════
alter table public.tub_profiles enable row level security;
alter table public.tub_videos   enable row level security;
alter table public.tub_likes    enable row level security;
alter table public.tub_comments enable row level security;
alter table public.tub_follows  enable row level security;
alter table public.tub_views    enable row level security;
alter table public.tub_reports  enable row level security;

revoke all on public.tub_profiles, public.tub_videos, public.tub_likes, public.tub_comments,
              public.tub_follows, public.tub_views, public.tub_reports
       from anon, authenticated;

-- Profils: publics; chacun crée et modifie le sien, sans toucher aux compteurs.
grant select on public.tub_profiles to anon, authenticated;
grant insert (id, username, display_name, avatar_url, bio, main_game, country)
      on public.tub_profiles to authenticated;
grant update (username, display_name, avatar_url, bio, main_game, country)
      on public.tub_profiles to authenticated;
create policy tub_profiles_read   on public.tub_profiles for select using (true);
create policy tub_profiles_insert on public.tub_profiles for insert to authenticated
       with check (id = (select auth.uid()));
create policy tub_profiles_update on public.tub_profiles for update to authenticated
       using (id = (select auth.uid())) with check (id = (select auth.uid()));

-- Vidéos: lecture seule. Le fil ne voit que `ready`; l'auteur voit aussi
-- les siennes en cours d'encodage. Écriture réservée au serveur.
grant select on public.tub_videos to anon, authenticated;
create policy tub_videos_read on public.tub_videos for select
       using (status = 'ready' or author_id = (select auth.uid()));

-- Likes et abonnements: publics, chacun gère les siens.
grant select on public.tub_likes to anon, authenticated;
grant insert, delete on public.tub_likes to authenticated;
create policy tub_likes_read   on public.tub_likes for select using (true);
create policy tub_likes_insert on public.tub_likes for insert to authenticated
       with check (user_id = (select auth.uid()));
create policy tub_likes_delete on public.tub_likes for delete to authenticated
       using (user_id = (select auth.uid()));

grant select on public.tub_follows to anon, authenticated;
grant insert, delete on public.tub_follows to authenticated;
create policy tub_follows_read   on public.tub_follows for select using (true);
create policy tub_follows_insert on public.tub_follows for insert to authenticated
       with check (follower_id = (select auth.uid()));
create policy tub_follows_delete on public.tub_follows for delete to authenticated
       using (follower_id = (select auth.uid()));

-- Commentaires: publics, chacun écrit et efface les siens.
grant select on public.tub_comments to anon, authenticated;
grant insert (video_id, author_id, body) on public.tub_comments to authenticated;
grant delete on public.tub_comments to authenticated;
create policy tub_comments_read   on public.tub_comments for select using (true);
create policy tub_comments_insert on public.tub_comments for insert to authenticated
       with check (author_id = (select auth.uid()));
create policy tub_comments_delete on public.tub_comments for delete to authenticated
       using (author_id = (select auth.uid()));

-- Signalements: on peut signaler, pas relire ceux des autres.
grant insert (video_id, reporter_id, reason, details) on public.tub_reports to authenticated;
create policy tub_reports_insert on public.tub_reports for insert to authenticated
       with check (reporter_id = (select auth.uid()));

-- tub_views: aucun droit direct, seulement via tub_record_view().

-- ═══════════════════════════════════════════════════════════════
-- COMPTEURS — tenus par la base, pas par le navigateur
-- ═══════════════════════════════════════════════════════════════
create or replace function public.tub_count_likes() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'INSERT' then
        update public.tub_videos set likes_count = likes_count + 1 where id = new.video_id;
    else
        update public.tub_videos set likes_count = greatest(likes_count - 1, 0) where id = old.video_id;
    end if;
    return null;
end $$;
create trigger tub_likes_count after insert or delete on public.tub_likes
       for each row execute function public.tub_count_likes();

create or replace function public.tub_count_comments() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'INSERT' then
        update public.tub_videos set comments_count = comments_count + 1 where id = new.video_id;
    else
        update public.tub_videos set comments_count = greatest(comments_count - 1, 0) where id = old.video_id;
    end if;
    return null;
end $$;
create trigger tub_comments_count after insert or delete on public.tub_comments
       for each row execute function public.tub_count_comments();

create or replace function public.tub_count_follows() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if tg_op = 'INSERT' then
        update public.tub_profiles set followers_count = followers_count + 1 where id = new.followee_id;
        update public.tub_profiles set following_count = following_count + 1 where id = new.follower_id;
    else
        update public.tub_profiles set followers_count = greatest(followers_count - 1, 0) where id = old.followee_id;
        update public.tub_profiles set following_count = greatest(following_count - 1, 0) where id = old.follower_id;
    end if;
    return null;
end $$;
create trigger tub_follows_count after insert or delete on public.tub_follows
       for each row execute function public.tub_count_follows();

-- Le compteur de vidéos d'un profil = ses vidéos visibles.
create or replace function public.tub_count_videos() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    auteur uuid := coalesce(new.author_id, old.author_id);
begin
    update public.tub_profiles
       set videos_count = (select count(*) from public.tub_videos
                            where author_id = auteur and status = 'ready')
     where id = auteur;
    return null;
end $$;
create trigger tub_videos_count after insert or delete or update of status on public.tub_videos
       for each row execute function public.tub_count_videos();

-- Cinq signalements distincts encore ouverts: la vidéo sort du fil en
-- attendant qu'un modérateur tranche. Mieux vaut masquer à tort une
-- heure que laisser circuler une vidéo illégale toute une nuit.
create or replace function public.tub_auto_review() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if (select count(*) from public.tub_reports
         where video_id = new.video_id and status = 'open') >= 5 then
        update public.tub_videos set status = 'review'
         where id = new.video_id and status = 'ready';
    end if;
    return null;
end $$;
create trigger tub_reports_review after insert on public.tub_reports
       for each row execute function public.tub_auto_review();

-- ═══════════════════════════════════════════════════════════════
-- VUES — une par spectateur et par jour
-- ═══════════════════════════════════════════════════════════════
create or replace function public.tub_record_view(p_video uuid, p_anon_key text default null)
returns void language plpgsql security definer set search_path = '' as $$
declare
    uid uuid := auth.uid();
    cle text;
begin
    if uid is not null then
        cle := uid::text;
    elsif p_anon_key ~ '^[A-Za-z0-9_-]{16,64}$' then
        cle := 'a:' || p_anon_key;
    else
        return;
    end if;

    insert into public.tub_views (video_id, viewer_key, is_auth)
    select v.id, cle, uid is not null
      from public.tub_videos v
     where v.id = p_video and v.status = 'ready'
    on conflict do nothing;

    if found then
        update public.tub_videos set views_count = views_count + 1 where id = p_video;
    end if;
end $$;
revoke all on function public.tub_record_view(uuid, text) from public;
grant execute on function public.tub_record_view(uuid, text) to anon, authenticated;

-- Les fonctions de déclencheur n'ont pas à être appelables via l'API.
revoke all on function public.tub_count_likes(), public.tub_count_comments(),
                       public.tub_count_follows(), public.tub_count_videos(),
                       public.tub_auto_review()
       from public, anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- LE FIL
-- ═══════════════════════════════════════════════════════════════
-- Score « Pour toi » façon Hacker News: l'engagement pèse, l'âge use.
-- Un commentaire vaut plus qu'un like, un like plus qu'une vue.
-- Calculé à la volée: très bien jusqu'à quelques dizaines de milliers
-- de vidéos. Au-delà, on le matérialisera toutes les 10 minutes.
create or replace view public.tub_feed_items with (security_invoker = true) as
select v.id, v.bunny_id, v.caption, v.game, v.duration_s, v.width, v.height,
       v.thumbnail_file, v.likes_count, v.comments_count, v.views_count,
       v.published_at, v.author_id,
       p.username, p.display_name, p.avatar_url,
       (1 + v.likes_count * 3 + v.comments_count * 5 + v.views_count * 0.2)
         / power(extract(epoch from (now() - v.published_at)) / 3600 + 2, 1.5) as score
  from public.tub_videos v
  join public.tub_profiles p on p.id = v.author_id
 where v.status = 'ready';
grant select on public.tub_feed_items to anon, authenticated;

create or replace function public.tub_feed(
    p_mode   text default 'pour-toi',
    p_game   text default null,
    p_limit  integer default 8,
    p_offset integer default 0
) returns setof public.tub_feed_items
language sql stable security invoker set search_path = '' as $$
    select f.*
      from public.tub_feed_items f
     where (p_game is null or f.game = p_game)
       and (p_mode <> 'abonnements' or f.author_id in
              (select followee_id from public.tub_follows where follower_id = auth.uid()))
     order by case when p_mode = 'abonnements' then 0 else f.score end desc,
              f.published_at desc
     limit least(greatest(p_limit, 1), 30)
    offset greatest(p_offset, 0);
$$;
grant execute on function public.tub_feed(text, text, integer, integer) to anon, authenticated;
