// 1 234 → « 1,2 k »: les compteurs restent courts sur un petit écran.
export function compact(n: number) {
  return new Intl.NumberFormat("fr-FR", { notation: "compact", maximumFractionDigits: 1 }).format(n);
}

export function timeAgo(iso: string) {
  const s = Math.max(1, Math.floor((Date.now() - new Date(iso).getTime()) / 1000));
  const steps: [number, string][] = [
    [60, "s"], [60, "min"], [24, "h"], [7, "j"], [4.35, "sem"], [12, "mois"],
  ];
  let v = s;
  for (const [size, unit] of steps) {
    if (v < size) return `${Math.floor(v)} ${unit}`;
    v /= size;
  }
  return `${Math.floor(v)} an${v >= 2 ? "s" : ""}`;
}

export const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
