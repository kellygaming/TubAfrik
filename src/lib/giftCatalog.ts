"use client";

import { supabaseBrowser } from "./supabase/client";
import { GIFT_COLUMNS, type Gift } from "./gifts";

// Le catalogue change rarement: lu une fois par visite, partagé par le
// panneau « Soutenir » et les animations de cadeaux.
let cache: Gift[] | null = null;
let pending: Promise<Gift[]> | null = null;

export function cachedGifts() {
  return cache;
}

export function loadGifts(): Promise<Gift[]> {
  if (cache) return Promise.resolve(cache);
  pending ??= Promise.resolve(
    supabaseBrowser().from("tub_gifts").select(GIFT_COLUMNS).order("sort"),
  ).then(({ data }) => {
    cache = (data as Gift[] | null) ?? [];
    return cache;
  });
  return pending;
}
