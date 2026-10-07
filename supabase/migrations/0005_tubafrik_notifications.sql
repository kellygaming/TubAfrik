-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — NOTIFICATIONS ET CADEAUX EN DIRECT
--
-- 1. tub_notifications: ce qui arrive à un créateur (cadeau, nouvel
--    abonné, commentaire). Écrites uniquement par la base: des
--    déclencheurs pour les abonnements et les commentaires, et
--    tub_settle_payment pour les cadeaux (un cadeau offert depuis un
--    profil n'a pas de commentaire, donc pas de déclencheur possible).
-- 2. Realtime: les commentaires (pour jouer l'animation d'un cadeau à
--    ceux qui regardent la vidéo à ce moment-là) et les notifications
--    (pour allumer la cloche sans recharger la page).
-- 3. tub_gifts.image_url: illustration du cadeau. Tant qu'elle est
--    vide, le site affiche l'emoji.
-- ═══════════════════════════════════════════════════════════════

create table public.tub_notifications (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references public.tub_profiles(id) on delete cascade,
    kind        text not null check (kind in ('gift','follow','comment')),
    actor_id    uuid references public.tub_profiles(id) on delete cascade,
    video_id    uuid references public.tub_videos(id) on delete cascade,
    gift_slug   text references public.tub_gifts(slug),
    amount_fcfa integer,
    body        text check (body is null or char_length(body) <= 300),
    created_at  timestamptz not null default now(),
    read_at     timestamptz
);
create index tub_notifications_user_idx   on public.tub_notifications (user_id, created_at desc);
create index tub_notifications_unread_idx on public.tub_notifications (user_id) where read_at is null;

alter table public.tub_notifications enable row level security;
revoke all on public.tub_notifications from public, anon, authenticated;
grant select on public.tub_notifications to authenticated;
create policy tub_notifications_own on public.tub_notifications for select to authenticated
    using (user_id = (select auth.uid()));

-- Tout marquer comme lu (ouvrir la page Activité).
create or replace function public.tub_mark_notifications_read()
returns void language sql security definer set search_path = '' as $$
    update public.tub_notifications set read_at = now()
     where user_id = auth.uid() and read_at is null;
$$;
revoke all on function public.tub_mark_notifications_read() from public, anon, authenticated;
grant execute on function public.tub_mark_notifications_read() to authenticated;

-- ── Nouvel abonné ───────────────────────────────────────────────
-- Se désabonner puis se réabonner ne crée pas une rafale: une seule
-- notification d'abonnement par personne et par jour.
create or replace function public.tub_notify_follow() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if not exists (
        select 1 from public.tub_notifications
         where user_id = new.followee_id and actor_id = new.follower_id
           and kind = 'follow' and created_at > now() - interval '1 day'
    ) then
        insert into public.tub_notifications (user_id, kind, actor_id)
        values (new.followee_id, 'follow', new.follower_id);
    end if;
    return null;
end $$;
create trigger tub_follows_notify after insert on public.tub_follows
       for each row execute function public.tub_notify_follow();

-- ── Nouveau commentaire (les cadeaux ont leur propre notification) ──
create or replace function public.tub_notify_comment() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
    author uuid;
begin
    if new.kind <> 'text' then return null; end if;
    select author_id into author from public.tub_videos where id = new.video_id;
    if author is not null and author <> new.author_id then
        insert into public.tub_notifications (user_id, kind, actor_id, video_id, body)
        values (author, 'comment', new.author_id, new.video_id, left(new.body, 140));
    end if;
    return null;
end $$;
create trigger tub_comments_notify after insert on public.tub_comments
       for each row execute function public.tub_notify_comment();

revoke all on function public.tub_notify_follow(), public.tub_notify_comment()
       from public, anon, authenticated;

-- ── Cadeau: tub_settle_payment prévient le créateur ─────────────
create or replace function public.tub_settle_payment(p_payment uuid, p_sale text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
    p public.tub_payments;
    g public.tub_gifts;
begin
    update public.tub_payments
       set status = 'paid', paid_at = now(), chariow_sale_id = coalesce(p_sale, chariow_sale_id)
     where id = p_payment and status <> 'paid'
    returning * into p;
    if not found then return false; end if;

    select * into g from public.tub_gifts where slug = p.gift_slug;

    if p.creator_share > 0 then
        insert into public.tub_ledger (creator_id, amount_fcfa, kind, payment_id, available_at)
        values (p.creator_id, p.creator_share, 'gain', p.id, now() + interval '3 days');
    end if;

    insert into public.tub_vip (fan_id, creator_id, expires_at, total_fcfa)
    values (p.payer_id, p.creator_id, now() + make_interval(days => g.vip_days), p.amount_fcfa)
    on conflict (creator_id, fan_id) do update
       set expires_at = greatest(public.tub_vip.expires_at, now()) + make_interval(days => g.vip_days),
           total_fcfa = public.tub_vip.total_fcfa + excluded.total_fcfa;

    if p.video_id is not null then
        insert into public.tub_comments (video_id, author_id, body, kind, gift_slug)
        values (p.video_id, p.payer_id,
                coalesce(nullif(btrim(p.message), ''), 'a envoyé ' || g.emoji || ' ' || g.name),
                'gift', g.slug);
    end if;

    insert into public.tub_notifications (user_id, kind, actor_id, video_id, gift_slug, amount_fcfa, body)
    values (p.creator_id, 'gift', p.payer_id, p.video_id, g.slug, p.creator_share, nullif(btrim(p.message), ''));
    return true;
end;
$$;
revoke all on function public.tub_settle_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.tub_settle_payment(uuid, text) to service_role;

-- ── Illustration des cadeaux ────────────────────────────────────
alter table public.tub_gifts add column image_url text
    check (image_url is null or image_url ~ '^(https://|/)');

-- ── Temps réel ──────────────────────────────────────────────────
alter publication supabase_realtime add table public.tub_comments, public.tub_notifications;

-- Le cadeau de test du 07/10 (@junior → @kellyyt) a précédé cette
-- migration: on lui donne sa notification pour que la cloche s'allume.
insert into public.tub_notifications (user_id, kind, actor_id, video_id, gift_slug, amount_fcfa, body, created_at)
select p.creator_id, 'gift', p.payer_id, p.video_id, p.gift_slug, p.creator_share, nullif(btrim(p.message), ''), p.paid_at
  from public.tub_payments p
 where p.status = 'paid';
