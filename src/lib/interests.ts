import { isCategorySlug } from "./categories";

// ═══════════════════════════════════════════════════════════════
// CE QUE LE VISITEUR AIME, RETENU PAR SON NAVIGATEUR
//
// Un compte connecté a ses centres d'intérêt en base (choisis à
// l'inscription, puis appris de ses likes et de ses vues). Un visiteur
// venu d'un lien WhatsApp n'a rien de tout ça: on compte ici, dans son
// navigateur, les catégories qu'il regarde jusqu'au bout et qu'il aime.
// Les 5 premières partent dans un cookie, que le serveur lit pour
// composer dès le premier affichage un fil qui lui ressemble.
// ═══════════════════════════════════════════════════════════════
const KEY = "tub_interests";
export const INTEREST_COOKIE = "tub_int";

export function bumpInterest(category: string | null | undefined, weight: number) {
  if (!isCategorySlug(category)) return;
  try {
    const counts = JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>;
    counts[category] = Math.min((counts[category] ?? 0) + weight, 50);
    localStorage.setItem(KEY, JSON.stringify(counts));
    document.cookie = `${INTEREST_COOKIE}=${topInterests(counts).join(",")}; path=/; max-age=31536000; samesite=lax`;
  } catch {}
}

export function topInterests(counts?: Record<string, number>): string[] {
  try {
    const c = counts ?? (JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, number>);
    return Object.entries(c).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([k]) => k).filter(isCategorySlug);
  } catch {
    return [];
  }
}

/** Lecture côté serveur du cookie « tub_int ». */
export function parseInterestCookie(value: string | undefined) {
  return (value ?? "").split(",").filter(isCategorySlug).slice(0, 5);
}
