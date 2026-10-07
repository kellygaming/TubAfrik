/* eslint-disable @next/next/no-img-element -- petite illustration statique, déjà optimisée */
import type { Gift } from "@/lib/gifts";

/** L'illustration du cadeau si elle existe, sinon son emoji, à la même taille. */
export function GiftArt({
  gift,
  size,
  className = "",
}: {
  gift: Pick<Gift, "emoji" | "name" | "image_url">;
  size: number;
  className?: string;
}) {
  if (gift.image_url) {
    return (
      <img src={gift.image_url} alt={gift.name} width={size} height={size} draggable={false}
        className={`inline-block select-none object-contain ${className}`} />
    );
  }
  return (
    <span role="img" aria-label={gift.name} className={`inline-block select-none leading-none ${className}`}
      style={{ fontSize: size * 0.9 }}>
      {gift.emoji}
    </span>
  );
}
