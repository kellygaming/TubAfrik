// ═══════════════════════════════════════════════════════════════
// LE LOGO TUBAFRIK
//
// Un bouton « lecture » découpé en bandes, comme un pagne kente tissé:
// la vidéo et l'Afrique dans le même signe. Aplats francs, pas de
// dégradé ni de halo: il doit rester net à 16 px comme à 512 px.
// ═══════════════════════════════════════════════════════════════
const PLAY = "M22 16Q22 11 26.5 13.6L51.4 28.6Q55 31.9 51.4 35.4L26.5 50.4Q22 53 22 48Z";
const BANDS = ["#120d0a", "#fff6ec", "#120d0a", "#fff6ec", "#120d0a"];

export function LogoMark({ size = 32, className = "", tile = true }: { size?: number; className?: string; tile?: boolean }) {
  const top = 11;
  const bottom = 53;
  const gap = 1.8;
  const h = (bottom - top - gap * (BANDS.length - 1)) / BANDS.length;
  // Sans tuile (posé sur l'orange ou sur une photo), les bandes claires deviennent orange.
  const colors = tile ? BANDS : BANDS.map((c) => (c === "#120d0a" ? "#fff6ec" : "#ff6b1a"));
  const id = `tub-play-${tile ? "t" : "n"}`;
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} className={className} role="img" aria-label="TubAfrik">
      <defs>
        <clipPath id={id}>
          <path d={PLAY} />
        </clipPath>
      </defs>
      {tile && <rect width="64" height="64" rx="16" fill="#ff6b1a" />}
      <g clipPath={`url(#${id})`}>
        {colors.map((c, i) => (
          <rect key={i} x="18" y={top + i * (h + gap)} width="40" height={h} fill={c} />
        ))}
      </g>
    </svg>
  );
}

export function Wordmark({ className = "" }: { className?: string }) {
  return (
    <span className={`font-display font-extrabold tracking-tight ${className}`}>
      Tub<span className="text-brand">Afrik</span>
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
