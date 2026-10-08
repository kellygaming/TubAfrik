-- ═══════════════════════════════════════════════════════════════
-- TUBAFRIK — SUPPRESSION DE COMPTE (exigée par Google Play)
--
-- Le compte de connexion est partagé avec Kelly Gaming: on ne supprime
-- jamais l'utilisateur lui-même, seulement son compte TubAfrik.
-- Et on n'efface pas les traces comptables (cadeaux payés, gains des
-- créateurs, retraits): la loi impose de les garder, et effacer un fan
-- ferait disparaître les gains des créateurs qu'il a soutenus.
--
-- Donc: la personne DEMANDE la suppression (dans l'app ou sur le site),
-- l'équipe la traite sous 30 jours. Le traitement efface les contenus
-- et l'identité, et ne laisse qu'un profil anonyme « Compte supprimé »
-- relié aux écritures comptables.
-- ═══════════════════════════════════════════════════════════════

alter table public.tub_profiles add column deleted_at timestamptz;

create table public.tub_account_deletions (
    user_id      uuid primary key references public.tub_profiles(id) on delete cascade,
    reason       text check (reason is null or char_length(reason) <= 300),
    requested_at timestamptz not null default now(),
    processed_at timestamptz
);
alter table public.tub_account_deletions enable row level security;
revoke all on public.tub_account_deletions from public, anon, authenticated;
grant select on public.tub_account_deletions to authenticated;
grant insert (user_id, reason) on public.tub_account_deletions to authenticated;
grant delete on public.tub_account_deletions to authenticated;
create policy tub_account_deletions_read on public.tub_account_deletions for select to authenticated
    using (user_id = (select auth.uid()));
create policy tub_account_deletions_insert on public.tub_account_deletions for insert to authenticated
    with check (user_id = (select auth.uid()));
-- Changer d'avis tant que la demande n'est pas traitée.
create policy tub_account_deletions_cancel on public.tub_account_deletions for delete to authenticated
    using (user_id = (select auth.uid()) and processed_at is null);

-- Appelée par l'équipe (service_role), APRÈS avoir retiré les fichiers vidéo de Bunny.
create or replace function public.tub_anonymize_account(p_user uuid)
returns void
language plpgsql security definer set search_path = '' as $$
begin
    update public.tub_videos set status = 'removed' where author_id = p_user and status <> 'removed';
    delete from public.tub_comments       where author_id = p_user;
    delete from public.tub_likes          where user_id = p_user;
    delete from public.tub_follows        where follower_id = p_user or followee_id = p_user;
    delete from public.tub_sticker_saves  where user_id = p_user;
    update public.tub_stickers set status = 'removed' where creator_id = p_user;
    delete from public.tub_notifications  where user_id = p_user or actor_id = p_user;
    delete from public.tub_live_messages  where author_id = p_user;
    update public.tub_lives set status = 'ended', ended_at = coalesce(ended_at, now()), ended_reason = 'compte_supprime'
     where creator_id = p_user and status <> 'ended';
    delete from public.tub_live_channels  where creator_id = p_user;
    delete from public.tub_vip            where fan_id = p_user;
    delete from public.tub_private        where user_id = p_user;
    delete from public.tub_cauri_wallets  where user_id = p_user;

    update public.tub_profiles set
        username      = 'supprime_' || left(replace(id::text, '-', ''), 12),
        display_name  = 'Compte supprimé',
        avatar_url    = null,
        bio           = null,
        main_game     = null,
        main_category = null,
        interests     = '{}',
        country       = null,
        live_enabled  = false,
        deleted_at    = now()
     where id = p_user;

    update public.tub_account_deletions set processed_at = now() where user_id = p_user;
end;
$$;
revoke all on function public.tub_anonymize_account(uuid) from public, anon, authenticated;
grant execute on function public.tub_anonymize_account(uuid) to service_role;
