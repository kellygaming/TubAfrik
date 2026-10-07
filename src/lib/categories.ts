// Les grandes familles de vidéos, comme sur TikTok ou YouTube Shorts.
// Le gaming en est une parmi d'autres; ses jeux deviennent un sous-filtre.
// Une liste en code tant qu'elle change rarement (même liste côté SQL:
// contrainte tub_videos_category_check).
export const CATEGORIES = [
  { slug: "divertissement", name: "Divertissement", emoji: "🎬" },
  { slug: "humour", name: "Humour", emoji: "😂" },
  { slug: "musique", name: "Musique", emoji: "🎵" },
  { slug: "danse", name: "Danse", emoji: "💃" },
  { slug: "gaming", name: "Gaming", emoji: "🎮" },
  { slug: "sport", name: "Sport", emoji: "⚽" },
  { slug: "cuisine", name: "Cuisine", emoji: "🍲" },
  { slug: "beaute-mode", name: "Beauté & Mode", emoji: "💄" },
  { slug: "lifestyle", name: "Lifestyle", emoji: "✨" },
  { slug: "education", name: "Éducation", emoji: "📚" },
  { slug: "tech", name: "Tech", emoji: "📱" },
  { slug: "business", name: "Business", emoji: "💼" },
  { slug: "voyage", name: "Voyage", emoji: "✈️" },
  { slug: "animaux", name: "Animaux", emoji: "🐾" },
  { slug: "autre", name: "Autre", emoji: "🌀" },
] as const;

export type CategorySlug = (typeof CATEGORIES)[number]["slug"];

export const isCategorySlug = (s: unknown): s is CategorySlug =>
  typeof s === "string" && CATEGORIES.some((c) => c.slug === s);

export const category = (slug: string | null | undefined) => CATEGORIES.find((c) => c.slug === slug) ?? null;

/** Libellé court pour la vidéo: le jeu si c'est du gaming, sinon la catégorie. */
export function videoTag(cat: string | null | undefined, game: string | null | undefined, gameName: (s: string | null | undefined) => string | null) {
  const g = cat === "gaming" ? gameName(game) : null;
  if (g) return { label: `🎮 ${g}`, href: `/?cat=gaming&jeu=${game}` };
  const c = category(cat);
  return c ? { label: `${c.emoji} ${c.name}`, href: `/?cat=${c.slug}` } : null;
}
