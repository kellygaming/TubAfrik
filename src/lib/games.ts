// Les jeux mis en avant. Une simple liste en code tant qu'elle change
// rarement: pas besoin d'une table ni d'un écran d'administration.
export const GAMES = [
  { slug: "free-fire", name: "Free Fire", short: "FF" },
  { slug: "efootball", name: "eFootball", short: "eFoot" },
  { slug: "ea-fc", name: "EA FC", short: "FC" },
  { slug: "codm", name: "Call of Duty Mobile", short: "CODM" },
  { slug: "pubg-mobile", name: "PUBG Mobile", short: "PUBG" },
  { slug: "blood-strike", name: "Blood Strike", short: "BS" },
  { slug: "fortnite", name: "Fortnite", short: "Fortnite" },
  { slug: "roblox", name: "Roblox", short: "Roblox" },
  { slug: "clash-royale", name: "Clash Royale", short: "CR" },
  { slug: "genshin-impact", name: "Genshin Impact", short: "Genshin" },
  { slug: "autre-jeu", name: "Autre jeu", short: "Jeux" },
  { slug: "hors-gaming", name: "Hors gaming", short: "Lifestyle" },
] as const;

export type GameSlug = (typeof GAMES)[number]["slug"];

export const gameName = (slug: string | null | undefined) =>
  GAMES.find((g) => g.slug === slug)?.name ?? null;

export const isGameSlug = (s: unknown): s is GameSlug =>
  typeof s === "string" && GAMES.some((g) => g.slug === s);
