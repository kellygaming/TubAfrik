export type Gift = {
  slug: string;
  name: string;
  emoji: string;
  price_fcfa: number;
  vip_days: number;
};

export const GIFT_COLUMNS = "slug,name,emoji,price_fcfa,vip_days";

export const fcfa = (n: number) => `${new Intl.NumberFormat("fr-FR").format(n)} F`;

export function vipLabel(days: number) {
  if (days % 30 === 0) return `${days / 30} mois VIP`;
  return days === 7 ? "1 semaine VIP" : `${days} jours VIP`;
}

// Moyens de retrait proposés aux TubAfrikains.
export const PAYOUT_METHODS = [
  { id: "wave", label: "Wave" },
  { id: "orange", label: "Orange Money" },
  { id: "mtn", label: "MTN MoMo" },
  { id: "moov", label: "Moov Money" },
  { id: "airtel", label: "Airtel Money" },
  { id: "mvola", label: "MVola" },
  { id: "autre", label: "Autre" },
] as const;

/** Numéro international propre (« +2250700000000 ») ou null. */
export function normalizePhone(input: string) {
  const raw = input.trim().replace(/[\s.()-]/g, "");
  const digits = raw.startsWith("+") ? raw.slice(1) : raw.startsWith("00") ? raw.slice(2) : raw;
  return /^[0-9]{8,15}$/.test(digits) ? `+${digits}` : null;
}
