-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — CADEAUX, VIP ET GAINS DES TUBAFRIKAINS
--
-- Un fan offre un cadeau (payé en mobile money chez Chariow) à un
-- TubAfrikain. Le cadeau fait de lui un VIP de ce créateur pour un
-- temps: badge, commentaires lumineux et placés en tête.
--
-- L'argent:
--   • 80 % pour le créateur, 20 % pour TubAfrik ;
--   • la part du créateur devient retirable 3 jours après le paiement
--     (le temps qu'une contestation mobile money éventuelle tombe) ;
--   • pas de minimum de retrait: tout le disponible part d'un coup.
--
-- Le solde n'est JAMAIS une colonne qu'on incrémente: c'est la somme
-- d'un registre (tub_ledger) où chaque mouvement est une ligne. Un
-- retrait débite le registre dans la même transaction que sa création,
-- un refus le recrédite: le solde ne peut ni doubler ni disparaître.
--
-- Rien ici ne s'écrit depuis le navigateur. Le serveur (service_role)
-- crée les paiements et les confirme après avoir interrogé Chariow ;
-- seuls la lecture de ses propres lignes et la demande de retrait
-- (fonction contrôlée) sont ouvertes aux comptes.
-- ═══════════════════════════════════════════════════════════════

-- ── Le catalogue des cadeaux ────────────────────────────────────
-- Un cadeau = un produit « Licence » à prix fixe chez Chariow.
-- Tant que chariow_product_id est vide, le cadeau ne s'affiche pas.
create table public.tub_gifts (
    slug               text primary key check (slug ~ '^[a-z0-9-]{2,30}$'),
    name               text not null,
    emoji              text not null,
    price_fcfa         integer not null check (price_fcfa > 0),
    vip_days           integer not null check (vip_days > 0),
    chariow_product_id text unique,
    sort               integer not null default 0,
    active             boolean not null default true
);

insert into public.tub_gifts (slug, name, emoji, price_fcfa, vip_days, sort) values
    ('booyah',  'Booyah',          '🔥',  500,   7, 1),
    ('diamant', 'Diamant',         '💎', 1000,  30, 2),
    ('couronne','Couronne',        '👑', 2500,  60, 3),
    ('lion',    'Lion d''Afrique', '🦁', 5000, 120, 4);

-- ── Données privées (jamais dans tub_profiles, qui est publique) ─
-- Le numéro sert à Chariow (obligatoire) et à préremplir les retraits.
create table public.tub_private (
    user_id     uuid primary key references public.tub_profiles(id) on delete cascade,
    phone       text check (phone is null or phone ~ '^\+[0-9]{8,15}$'),
    updated_at  timestamptz not null default now()
);

-- ── Les paiements ───────────────────────────────────────────────
create table public.tub_payments (
    id              uuid primary key default gen_random_uuid(),
    payer_id        uuid not null references public.tub_profiles(id) on delete cascade,
    creator_id      uuid not null references public.tub_profiles(id) on delete cascade,
    video_id        uuid references public.tub_videos(id) on delete set null,
    gift_slug       text not null references public.tub_gifts(slug),
    amount_fcfa     integer not null check (amount_fcfa > 0),
    creator_share   integer not null check (creator_share >= 0),
    message         text check (message is null or char_length(btrim(message)) between 1 and 150),
    status          text not null default 'pending' check (status in ('pending','paid','failed')),
    chariow_sale_id text unique,
    created_at      timestamptz not null default now(),
    paid_at         timestamptz,
    check (payer_id <> creator_id)
);
create index tub_payments_pending_idx on public.tub_payments (created_at) where status = 'pending';
create index tub_payments_creator_idx on public.tub_payments (creator_id, paid_at desc) where status = 'paid';
create index tub_payments_payer_idx   on public.tub_payments (payer_id, created_at desc);

-- ── Les retraits ────────────────────────────────────────────────
create table public.tub_withdrawals (
    id           uuid primary key default gen_random_uuid(),
    creator_id   uuid not null references public.tub_profiles(id) on delete cascade,
    amount_fcfa  integer not null check (amount_fcfa > 0),
    method       text not null check (method in ('wave','orange','mtn','moov','airtel','mvola','autre')),
    phone        text not null check (phone ~ '^\+[0-9]{8,15}$'),
    status       text not null default 'en_attente' check (status in ('en_attente','paye','refuse')),
    admin_note   text check (admin_note is null or char_length(admin_note) <= 300),
    created_at   timestamptz not null default now(),
    processed_at timestamptz
);
-- Un seul retrait en attente à la fois par créateur.
create unique index tub_withdrawals_one_pending on public.tub_withdrawals (creator_id) where status = 'en_attente';

-- ── Le registre ─────────────────────────────────────────────────
create table public.tub_ledger (
    id            bigint generated always as identity primary key,
    creator_id    uuid not null references public.tub_profiles(id) on delete cascade,
    amount_fcfa   integer not null check (amount_fcfa <> 0),
    kind          text not null check (kind in ('gain','retrait','retrait_annule')),
    payment_id    uuid unique references public.tub_payments(id),
    withdrawal_id uuid references public.tub_withdrawals(id),
    available_at  timestamptz not null default now(),
    created_at    timestamptz not null default now()
);
create index tub_ledger_creator_idx on public.tub_ledger (creator_id, created_at desc);

-- ── Les VIP ─────────────────────────────────────────────────────
create table public.tub_vip (
    fan_id      uuid not null references public.tub_profiles(id) on delete cascade,
    creator_id  uuid not null references public.tub_profiles(id) on delete cascade,
    expires_at  timestamptz not null,
    total_fcfa  integer not null default 0,
    primary key (creator_id, fan_id)
);
create index tub_vip_fan_idx on public.tub_vip (fan_id);

-- ── Commentaires-cadeaux ────────────────────────────────────────
-- Écrits uniquement par tub_settle_payment: le navigateur n'a le droit
-- d'insérer que (video_id, author_id, body), donc kind reste 'text'.
alter table public.tub_comments
    add column kind      text not null default 'text' check (kind in ('text','gift')),
    add column gift_slug text references public.tub_gifts(slug);

-- ═══════════════════════════════════════════════════════════════
-- DROITS
-- ═══════════════════════════════════════════════════════════════
alter table public.tub_gifts       enable row level security;
alter table public.tub_private     enable row level security;
alter table public.tub_payments    enable row level security;
alter table public.tub_withdrawals enable row level security;
alter table public.tub_ledger      enable row level security;
alter table public.tub_vip         enable row level security;

revoke all on public.tub_gifts, public.tub_private, public.tub_payments,
              public.tub_withdrawals, public.tub_ledger, public.tub_vip
       from public, anon, authenticated;

grant select on public.tub_gifts to anon, authenticated;
create policy tub_gifts_read on public.tub_gifts for select using (active and chariow_product_id is not null);

grant select on public.tub_vip to anon, authenticated;
create policy tub_vip_read on public.tub_vip for select using (true);

grant select on public.tub_private to authenticated;
create policy tub_private_own on public.tub_private for select to authenticated
    using (user_id = (select auth.uid()));

-- Le fan voit ses envois, le créateur ce qu'il a reçu.
grant select on public.tub_payments to authenticated;
create policy tub_payments_own on public.tub_payments for select to authenticated
    using (payer_id = (select auth.uid()) or (creator_id = (select auth.uid()) and status = 'paid'));

grant select on public.tub_withdrawals to authenticated;
create policy tub_withdrawals_own on public.tub_withdrawals for select to authenticated
    using (creator_id = (select auth.uid()));

grant select on public.tub_ledger to authenticated;
create policy tub_ledger_own on public.tub_ledger for select to authenticated
    using (creator_id = (select auth.uid()));

-- ═══════════════════════════════════════════════════════════════
-- CONFIRMER UN PAIEMENT — serveur uniquement, rejouable sans risque
--
-- Appelée par le Pulse Chariow, par la page /merci et par la tâche
-- planifiée: les trois peuvent arriver en même temps. Le UPDATE …
-- WHERE status <> 'paid' RETURNING fait office de verrou: une seule
-- des trois obtient la ligne, les autres repartent avec false.
-- ═══════════════════════════════════════════════════════════════
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

    -- 80 % pour le créateur, retirable dans 3 jours.
    if p.creator_share > 0 then
        insert into public.tub_ledger (creator_id, amount_fcfa, kind, payment_id, available_at)
        values (p.creator_id, p.creator_share, 'gain', p.id, now() + interval '3 days');
    end if;

    -- VIP: on prolonge à partir de la fin actuelle si elle est future.
    insert into public.tub_vip (fan_id, creator_id, expires_at, total_fcfa)
    values (p.payer_id, p.creator_id, now() + make_interval(days => g.vip_days), p.amount_fcfa)
    on conflict (creator_id, fan_id) do update
       set expires_at = greatest(public.tub_vip.expires_at, now()) + make_interval(days => g.vip_days),
           total_fcfa = public.tub_vip.total_fcfa + excluded.total_fcfa;

    -- Le cadeau apparaît sous la vidéo, en commentaire doré.
    if p.video_id is not null then
        insert into public.tub_comments (video_id, author_id, body, kind, gift_slug)
        values (p.video_id, p.payer_id,
                coalesce(nullif(btrim(p.message), ''), 'a envoyé ' || g.emoji || ' ' || g.name),
                'gift', g.slug);
    end if;
    return true;
end;
$$;

-- ── Le portefeuille du créateur connecté ────────────────────────
create or replace function public.tub_my_wallet()
returns table (available integer, upcoming integer, earned integer, withdrawn integer, next_release timestamptz)
language sql stable security definer set search_path = '' as $$
    select coalesce(sum(amount_fcfa) filter (where available_at <= now()), 0)::integer,
           coalesce(sum(amount_fcfa) filter (where available_at > now()), 0)::integer,
           coalesce(sum(amount_fcfa) filter (where kind = 'gain'), 0)::integer,
           coalesce(-sum(amount_fcfa) filter (where kind in ('retrait','retrait_annule')), 0)::integer,
           min(available_at) filter (where available_at > now())
      from public.tub_ledger
     where creator_id = auth.uid();
$$;

-- ── Demander un retrait: tout le disponible, sans minimum ───────
create or replace function public.tub_request_withdrawal(p_method text, p_phone text)
returns uuid
language plpgsql security definer set search_path = '' as $$
declare
    me     uuid := auth.uid();
    amount integer;
    w_id   uuid;
begin
    if me is null then raise exception 'non_connecte'; end if;
    -- Deux clics rapprochés: le second attend le premier puis voit
    -- le retrait en attente.
    perform pg_advisory_xact_lock(hashtextextended('tub_wallet:' || me::text, 0));

    if exists (select 1 from public.tub_withdrawals where creator_id = me and status = 'en_attente') then
        raise exception 'retrait_en_cours';
    end if;

    select coalesce(sum(amount_fcfa), 0) into amount
      from public.tub_ledger where creator_id = me and available_at <= now();
    if amount <= 0 then raise exception 'solde_vide'; end if;

    insert into public.tub_withdrawals (creator_id, amount_fcfa, method, phone)
    values (me, amount, p_method, p_phone)
    returning id into w_id;

    insert into public.tub_ledger (creator_id, amount_fcfa, kind, withdrawal_id)
    values (me, -amount, 'retrait', w_id);

    insert into public.tub_private (user_id, phone) values (me, p_phone)
    on conflict (user_id) do update set phone = excluded.phone, updated_at = now();
    return w_id;
end;
$$;

-- ── Traiter un retrait (admin, via le serveur) ──────────────────
create or replace function public.tub_process_withdrawal(p_id uuid, p_paid boolean, p_note text default null)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
    w public.tub_withdrawals;
begin
    update public.tub_withdrawals
       set status = case when p_paid then 'paye' else 'refuse' end,
           processed_at = now(), admin_note = p_note
     where id = p_id and status = 'en_attente'
    returning * into w;
    if not found then return false; end if;

    -- Refusé: l'argent revient tout de suite dans le disponible.
    if not p_paid then
        insert into public.tub_ledger (creator_id, amount_fcfa, kind, withdrawal_id)
        values (w.creator_id, w.amount_fcfa, 'retrait_annule', w.id);
    end if;
    return true;
end;
$$;

revoke all on function public.tub_settle_payment(uuid, text),
                       public.tub_my_wallet(),
                       public.tub_request_withdrawal(text, text),
                       public.tub_process_withdrawal(uuid, boolean, text)
       from public, anon, authenticated;
grant execute on function public.tub_my_wallet(), public.tub_request_withdrawal(text, text) to authenticated;
grant execute on function public.tub_settle_payment(uuid, text),
                          public.tub_process_withdrawal(uuid, boolean, text) to service_role;
