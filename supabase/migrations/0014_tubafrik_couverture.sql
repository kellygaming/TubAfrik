-- Photo de couverture du profil (bannière en haut de la page créateur).
-- Le fichier vit dans le même bucket que l'avatar: tub-avatars/{uid}/cover.webp
alter table public.tub_profiles
    add column if not exists cover_url text
    check (cover_url is null or char_length(cover_url) <= 500);

grant update (cover_url) on public.tub_profiles to authenticated;
