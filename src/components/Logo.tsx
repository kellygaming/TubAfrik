// ═══════════════════════════════════════════════════════════════
// LE LOGO TUBAFRIK
//
// Un bouton « lecture » découpé en bandes, comme un pagne kente tissé:
// la vidéo et l'Afrique dans le même signe. Tuile noire, bandes or et
// orange: la seule touche de couleur d'un site en noir et blanc.
// ═══════════════════════════════════════════════════════════════
const PLAY = "M22 16Q22 11 26.5 13.6L51.4 28.6Q55 31.9 51.4 35.4L26.5 50.4Q22 53 22 48Z";
const TILE = "#161616";
const BANDS = ["#f4b400", "#ff6b1a", "#f4b400", "#ff6b1a", "#f4b400"];

export function LogoMark({ size = 32, className = "", tile = true }: { size?: number; className?: string; tile?: boolean }) {
  const top = 11;
  const bottom = 53;
  const gap = 1.8;
  const h = (bottom - top - gap * (BANDS.length - 1)) / BANDS.length;
  const id = "tub-play";
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="TubAfrik">
      <defs>
        <clipPath id={id}>
          <path d={PLAY} />
        </clipPath>
      </defs>
      {tile && <rect width="64" height="64" rx="16" fill={TILE} />}
      <g clipPath={`url(#${id})`}>
        {BANDS.map((c, i) => (
          <rect key={i} x="18" y={top + i * (h + gap)} width="40" height={h} fill={c} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      TubAfrik
    </span>
  );
}

export function Logo({ size = 28, className = "" }: { size?: number; className?: string }) {
  return (
    <span className={`inline-flex items-center gap-2 ${className}`}>
      <LogoMark size={size} />
      <Wordmark className="text-[1.1em]" />
    </span>
  );
}
