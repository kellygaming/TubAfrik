-- TUBAFRIK — photos de profil (appliquée le 07/10 sous le nom tubafrik_avatars_select)
--
-- Remplacer sa photo (upload avec upsert) exige, en plus d'INSERT et
-- d'UPDATE, le droit de LIRE son propre fichier. Sans cette règle, chaque
-- envoi était refusé (400) depuis la mise en ligne: aucun avatar n'avait
-- jamais été enregistré.
create policy tub_avatars_select on storage.objects for select to authenticated
  using (bucket_id = 'tub-avatars' and (storage.foldername(name))[1] = (select auth.uid())::text);
