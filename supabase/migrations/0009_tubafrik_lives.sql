-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — LES LIVES
--
-- Diffusion: Cloudflare Stream Live. Le créateur envoie son flux en
-- RTMPS (Prism Live Studio, Streamlabs: caméra ou écran du téléphone),
-- les spectateurs regardent en HLS dans le lecteur du site.
--
-- 1. tub_live_channels: l'entrée Cloudflare de chaque créateur, créée
--    une fois puis réutilisée (la clé de diffusion ne change pas, le
--    créateur la colle une seule fois dans son appli). La clé n'est
--    jamais stockée ici: le serveur la redemande à Cloudflare.
-- 2. tub_lives: une ligne par live. waiting → live → ended. Seul le
--    serveur écrit (il interroge Cloudflare pour savoir si le flux
--    arrive vraiment).
-- 3. tub_live_messages: le chat. Les cadeaux offerts pendant un live y
--    apparaissent aussi (écrits par tub_settle_payment).
-- 4. Lives sur invitation au départ: tub_profiles.live_enabled.
-- ═══════════════════════════════════════════════════════════════

alter table public.tub_profiles add column live_enabled boolean not null default false;

create table public.tub_live_channels (
    creator_id  uuid primary key references public.tub_profiles(id) on delete cascade,
    cf_input_id text not null unique,
    created_at  timestamptz not null default now()
);
alter table public.tub_live_channels enable row level security;
revoke all on public.tub_live_channels from public, anon, authenticated;

create table public.tub_lives (
    id           uuid primary key default gen_random_uuid(),
    creator_id   uuid not null references public.tub_profiles(id) on delete cascade,
    cf_input_id  text not null,
    title        text not null check (char_length(btrim(title)) between 1 and 80),
    category     text not null default 'divertissement' check (category in (
        'divertissement','humour','musique','danse','gaming','sport','cuisine','beaute-mode',
        'lifestyle','education','tech','business','voyage','animaux','autre')),
    status       text not null default 'waiting' check (status in ('waiting','live','ended')),
    hls_url      text check (hls_url is null or hls_url ~ '^https://'),
    created_at   timestamptz not null default now(),
    started_at   timestamptz,
    ended_at     timestamptz,
    last_live_at timestamptz,
    checked_at   timestamptz not null default now(),
    ended_reason text
);
-- Un seul live ouvert à la fois par créateur.
create unique index tub_lives_one_open on public.tub_lives (creator_id) where status <> 'ended';
create index tub_lives_on_air on public.tub_lives (started_at desc) where status = 'live';

alter table public.tub_lives enable row level security;
revoke all on public.tub_lives from public, anon, authenticated;
grant select on public.tub_lives to anon, authenticated;
create policy tub_lives_read on public.tub_lives for select using (true);

create table public.tub_live_messages (
    id         bigint generated always as identity primary key,
    live_id    uuid not null references public.tub_lives(id) on delete cascade,
    author_id  uuid not null references public.tub_profiles(id) on delete cascade,
    body       text not null check (char_length(btrim(body)) between 1 and 200),
    kind       text not null default 'text' check (kind in ('text','gift')),
    gift_slug  text references public.tub_gifts(slug),
    created_at timestamptz not null default now()
);
create index tub_live_messages_live_idx on public.tub_live_messages (live_id, id desc);

alter table public.tub_live_messages enable row level security;
revoke all on public.tub_live_messages from public, anon, authenticated;
grant select on public.tub_live_messages to anon, authenticated;
grant insert (live_id, author_id, body) on public.tub_live_messages to authenticated;
grant delete on public.tub_live_messages to authenticated;
create policy tub_live_messages_read on public.tub_live_messages for select using (true);
create policy tub_live_messages_write on public.tub_live_messages for insert to authenticated
    with check (author_id = (select auth.uid())
                and exists (select 1 from public.tub_lives l where l.id = live_id and l.status = 'live'));
-- L'auteur retire son message; le créateur modère le chat de son live.
create policy tub_live_messages_delete on public.tub_live_messages for delete to authenticated
    using (author_id = (select auth.uid())
           or exists (select 1 from public.tub_lives l where l.id = live_id and l.creator_id = (select auth.uid())));

-- Anti-rafale: un message par seconde et par personne.
create or replace function public.tub_live_message_rate() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
    if new.kind = 'text' and exists (
        select 1 from public.tub_live_messages
         where author_id = new.author_id and created_at > now() - interval '1 second'
    ) then
        raise exception 'trop_vite';
    end if;
    return new;
end $$;
create trigger tub_live_messages_rate before insert on public.tub_live_messages
       for each row execute function public.tub_live_message_rate();
revoke all on function public.tub_live_message_rate() from public, anon, authenticated;

-- ── Cadeaux pendant un live ─────────────────────────────────────
alter table public.tub_payments add column live_id uuid references public.tub_lives(id) on delete set null;

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

    -- Offert pendant un live: le cadeau s'affiche dans le chat, même si
    -- le live s'est terminé entre-temps (il reste dans l'historique).
    if p.live_id is not null then
        insert into public.tub_live_messages (live_id, author_id, body, kind, gift_slug)
        values (p.live_id, p.payer_id,
                left(coalesce(nullif(btrim(p.message), ''), 'a envoyé ' || g.emoji || ' ' || g.name), 200),
                'gift', g.slug);
    end if;

    insert into public.tub_notifications (user_id, kind, actor_id, video_id, gift_slug, amount_fcfa, body)
    values (p.creator_id, 'gift', p.payer_id, p.video_id, g.slug, p.creator_share, nullif(btrim(p.message), ''));
    return true;
end;
$$;
revoke all on function public.tub_settle_payment(uuid, text) from public, anon, authenticated;
grant execute on function public.tub_settle_payment(uuid, text) to service_role;

-- ── Temps réel: le chat et l'état des lives ─────────────────────
alter publication supabase_realtime add table public.tub_live_messages, public.tub_lives;
