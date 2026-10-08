-- ═══════════════════════════════════════════════════════════════
-- EMAILS — bienvenue, activité (résumé), vidéo publiée
-- Envoyés par la tâche planifiée /api/cron/emails (Zoho SMTP).
-- ═══════════════════════════════════════════════════════════════
alter table public.tub_profiles
    add column if not exists email_opt_out    boolean not null default false,
    add column if not exists welcome_email_at timestamptz,
    add column if not exists last_digest_at   timestamptz;

-- Le membre choisit lui-même de recevoir ou non les emails d'activité.
grant update (email_opt_out) on public.tub_profiles to authenticated;

alter table public.tub_notifications
    add column if not exists emailed_at timestamptz;
create index if not exists tub_notifications_to_email
    on public.tub_notifications (user_id, created_at) where emailed_at is null;

alter table public.tub_videos
    add column if not exists published_email_at timestamptz;

-- Le passé ne part pas par email: seules les nouvelles activités et vidéos.
update public.tub_notifications set emailed_at = now() where emailed_at is null;
update public.tub_videos set published_email_at = now() where published_email_at is null and status = 'ready';
