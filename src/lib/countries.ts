// Pays proposés au profil. L'Afrique francophone d'abord (le cœur de
// la communauté Kelly Gaming), puis le reste du continent.
export const COUNTRIES = [
  ["CI", "Côte d'Ivoire"], ["SN", "Sénégal"], ["CM", "Cameroun"], ["BF", "Burkina Faso"],
  ["ML", "Mali"], ["BJ", "Bénin"], ["TG", "Togo"], ["NE", "Niger"], ["GN", "Guinée"],
  ["CD", "RD Congo"], ["CG", "Congo"], ["GA", "Gabon"], ["TD", "Tchad"],
  ["CF", "Centrafrique"], ["MG", "Madagascar"], ["BI", "Burundi"], ["RW", "Rwanda"],
  ["DJ", "Djibouti"], ["KM", "Comores"], ["MR", "Mauritanie"], ["MA", "Maroc"],
  ["DZ", "Algérie"], ["TN", "Tunisie"], ["NG", "Nigeria"], ["GH", "Ghana"],
  ["KE", "Kenya"], ["ZA", "Afrique du Sud"], ["EG", "Égypte"], ["ET", "Éthiopie"],
  ["FR", "France (diaspora)"], ["BE", "Belgique (diaspora)"], ["CA", "Canada (diaspora)"],
] as const;

export const flag = (code: string | null | undefined) =>
  code && /^[A-Z]{2}$/.test(code)
    ? String.fromCodePoint(...[...code].map((c) => 0x1f1a5 + c.charCodeAt(0)))
    : "";

export const countryName = (code: string | null | undefined) =>
  COUNTRIES.find(([c]) => c === code)?.[1] ?? null;
