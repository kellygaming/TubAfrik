// Les deux noms existent selon l'âge du projet Supabase: l'ancienne
// « anon key » et la nouvelle « publishable key ». L'une ou l'autre.
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
export const SUPABASE_PUBLIC_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
