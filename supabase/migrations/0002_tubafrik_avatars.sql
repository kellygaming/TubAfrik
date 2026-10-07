-- TUBAFRIK — photos de profil (appliquée le 06/10 sous le nom tubafrik_avatars)
-- Un espace de stockage public en lecture; chacun n'écrit que dans son
-- dossier (nommé par son identifiant), 2 Mo max, images seulement.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('tub-avatars', 'tub-avatars', true, 2097152, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy tub_avatars_insert on storage.objects for insert to authenticated
  with check (bucket_id = 'tub-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tub_avatars_update on storage.objects for update to authenticated
  using (bucket_id = 'tub-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text)
  with check (bucket_id = 'tub-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
create policy tub_avatars_delete on storage.objects for delete to authenticated
  using (bucket_id = 'tub-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
