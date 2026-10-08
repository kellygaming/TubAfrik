-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — LE PORTEFEUILLE DE CAURIS
--
-- Le fan recharge des Cauris en un paiement mobile money (Chariow),
-- puis offre ses cadeaux en un geste, sans quitter la vidéo ni le live.
-- 1 Cauri = 10 F de cadeau: 🌹 60, 💎 100, 👑 250, 🦁 500.
--
-- 1. tub_cauri_packs: les packs vendus (un produit Chariow chacun). Le
--    nombre de Cauris crédités se change ici, sans toucher au code.
-- 2. tub_cauri_purchases: un achat de pack, confirmé comme les cadeaux
--    (on redemande toujours l'état de la vente à Chariow).
-- 3. tub_cauri_wallets + tub_cauri_ledger: le solde, et chaque
--    mouvement qui l'explique. Le solde ne peut jamais passer sous 0.
-- 4. tub_send_gift_cauris: dépense les Cauris et crée un cadeau payé,
--    qui passe par tub_settle_payment comme un cadeau Chariow: même
--    partage 80/20, même VIP, même animation, même notification.
-- ═══════════════════════════════════════════════════════════════

create table public.tub_cauri_packs (
    slug               text primary key check (slug ~ '^[a-z0-9-]{2,30}$'),
    name               text not null,
    cauris             integer not null check (cauris > 0),
    price_fcfa         integer not null check (price_fcfa > 0),
    chariow_product_id text unique,
    sort               integer not null default 0,
    active             boolean not null default true
);
alter table public.tub_cauri_packs enable row level security;
revoke all on public.tub_cauri_packs from public, anon, authenticated;
grant select (slug, name, cauris, price_fcfa, sort, active) on public.tub_cauri_packs to anon, authenticated;
create policy tub_cauri_packs_read on public.tub_cauri_packs for select using (active);

-- Les quantités suivent les noms des produits Chariow tels qu'ils sont publiés.
insert into public.tub_cauri_packs (slug, name, cauris, price_fcfa, chariow_product_id, sort) values
    ('poignee', 'Poignée de Cauris',  60,  600, 'prd_3lt7n8h9', 1),
    ('bourse',  'Bourse de Cauris',  160, 1500, 'prd_qoff1jxu', 2),
    ('coffret', 'Coffret de Cauris', 330, 3000, 'prd_hqgxoof4', 3),
    ('tresor',  'Trésor de Cauris',  700, 6000, 'prd_h6wa4026', 4);

create table public.tub_cauri_wallets (
    user_id    uuid primary key references public.tub_profiles(id) on delete cascade,
    balance    integer not null default 0 check (balance >= 0),
    updated_at timestamptz not null default now()
);
alter table public.tub_cauri_wallets enable row level security;
revoke all on public.tub_cauri_wallets from public, anon, authenticated;
grant select on public.tub_cauri_wallets to authenticated;
create policy tub_cauri_wallets_own on public.tub_cauri_wallets for select to authenticated
    using (user_id = (select auth.uid()));

create table public.tub_cauri_purchases (
    id              uuid primary key default gen_random_uuid(),
    user_id         uuid not null references public.tub_profiles(id) on delete cascade,
    pack_slug       text not null references public.tub_cauri_packs(slug),
    cauris          integer not null check (cauris > 0),
    amount_fcfa     integer not null check (amount_fcfa > 0),
    status          text not null default 'pending' check (status in ('pending','paid','failed')),
    chariow_sale_id text unique,
    created_at      timestamptz not null default now(),
    paid_at         timestamptz
);
create index tub_cauri_purchases_pending_idx on public.tub_cauri_purchases (created_at) where status = 'pending';
create index tub_cauri_purchases_user_idx on public.tub_cauri_purchases (user_id, created_at desc);
alter table public.tub_cauri_purchases enable row level security;
revoke all on public.tub_cauri_purchases from public, anon, authenticated;
grant select on public.tub_cauri_purchases to authenticated;
create policy tub_cauri_purchases_own on public.tub_cauri_purchases for select to authenticated
    using (user_id = (select auth.uid()));

create table public.tub_cauri_ledger (
    id          bigint generated always as identity primary key,
    user_id     uuid not null references public.tub_profiles(id) on delete cascade,
    delta       integer not null check (delta <> 0),
    kind        text not null check (kind in ('achat','cadeau','ajustement')),
    purchase_id uuid references public.tub_cauri_purchases(id) on delete set null,
    payment_id  uuid references public.tub_payments(id) on delete set null,
    created_at  timestamptz not null default now()
);
create index tub_cauri_ledger_user_idx on public.tub_cauri_ledger (user_id, created_at desc);
alter table public.tub_cauri_ledger enable row level security;
revoke all on public.tub_cauri_ledger from public, anon, authenticated;
grant select on public.tub_cauri_ledger to authenticated;
create policy tub_cauri_ledger_own on public.tub_cauri_ledger for select to authenticated
    using (user_id = (select auth.uid()));

-- Un cadeau payé en Cauris n'est pas une vente Chariow: on le distingue
-- pour ne pas compter deux fois l'argent encaissé (achat du pack + cadeau).
alter table public.tub_payments add column source text not null default 'chariow'
    check (source in ('chariow','cauris'));

-- ── Créditer un achat confirmé (rejouable: une seule fois) ──────
create or replace function public.tub_settle_cauri_purchase(p_purchase uuid, p_sale text)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
    c public.tub_cauri_purchases;
begin
    update public.tub_cauri_purchases
       set status = 'paid', paid_at = now(), chariow_sale_id = coalesce(p_sale, chariow_sale_id)
     where id = p_purchase and status <> 'paid'
    returning * into c;
    if not found then return false; end if;

    insert into public.tub_cauri_wallets (user_id, balance) values (c.user_id, c.cauris)
    on conflict (user_id) do update
       set balance = public.tub_cauri_wallets.balance + excluded.balance, updated_at = now();
    insert into public.tub_cauri_ledger (user_id, delta, kind, purchase_id)
    values (c.user_id, c.cauris, 'achat', c.id);
    return true;
end;
$$;
revoke all on function public.tub_settle_cauri_purchase(uuid, text) from public, anon, authenticated;
grant execute on function public.tub_settle_cauri_purchase(uuid, text) to service_role;

-- ── Offrir un cadeau avec ses Cauris ────────────────────────────
-- Appelée par le fan lui-même (auth.uid()). Tout se passe dans une seule
-- transaction: si une étape échoue, rien n'est débité.
create or replace function public.tub_send_gift_cauris(
    p_creator uuid,
    p_gift    text,
    p_video   uuid default null,
    p_live    uuid default null,
    p_message text default null
) returns integer
language plpgsql security definer set search_path = '' as $$
declare
    me    uuid := auth.uid();
    g     public.tub_gifts;
    cost  integer;
    left_ integer;
    pid   uuid;
    msg   text := nullif(btrim(left(coalesce(p_message, ''), 150)), '');
begin
    if me is null then raise exception 'non_connecte'; end if;
    if me = p_creator then raise exception 'soi_meme'; end if;
    select * into g from public.tub_gifts where slug = p_gift and active;
    if not found then raise exception 'cadeau_inconnu'; end if;
    if not exists (select 1 from public.tub_profiles where id = p_creator) then raise exception 'createur_inconnu'; end if;

    -- La vidéo et le live doivent appartenir au créateur (sinon ignorés).
    if p_video is not null and not exists (
        select 1 from public.tub_videos where id = p_video and author_id = p_creator) then p_video := null; end if;
    if p_live is not null and not exists (
        select 1 from public.tub_lives where id = p_live and creator_id = p_creator and status <> 'ended') then p_live := null; end if;

    cost := ceil(g.price_fcfa / 10.0);
    update public.tub_cauri_wallets set balance = balance - cost, updated_at = now()
     where user_id = me and balance >= cost
    returning balance into left_;
    if not found then raise exception 'solde_insuffisant'; end if;

    insert into public.tub_payments (payer_id, creator_id, video_id, live_id, gift_slug, amount_fcfa, creator_share, message, source)
    values (me, p_creator, p_video, p_live, g.slug, g.price_fcfa, floor(g.price_fcfa * 0.8), msg, 'cauris')
    returning id into pid;
    insert into public.tub_cauri_ledger (user_id, delta, kind, payment_id) values (me, -cost, 'cadeau', pid);

    perform public.tub_settle_payment(pid, null);
    return left_;
end;
$$;
revoke all on function public.tub_send_gift_cauris(uuid, text, uuid, uuid, text) from public, anon;
grant execute on function public.tub_send_gift_cauris(uuid, text, uuid, uuid, text) to authenticated;
