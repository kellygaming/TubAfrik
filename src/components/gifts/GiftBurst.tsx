"use client";

import { useEffect, useMemo } from "react";
import type { Gift } from "@/lib/gifts";
import { Avatar } from "../Avatar";
import { GiftArt } from "./GiftArt";

export type Burst = {
  key: string;
  gift: Gift;
  fan: { display_name: string; avatar_url: string | null };
  message: string | null;
};

// ═══════════════════════════════════════════════════════════════
// L'ANIMATION D'UN CADEAU, PAR-DESSUS LA VIDÉO
//
// Une mise en scène par cadeau, en CSS pur: rien à télécharger (le
// spectateur paie sa data), rien qui bloque la vidéo (pointer-events
// coupés). Plus le cadeau est grand, plus la scène dure et s'étoffe.
//   🌹 Rose      pétales qui tombent
//   💎 Diamant   rotation et éclats
//   👑 Couronne  chute avec rebond et rayons dorés
//   🦁 Lion      entrée en force, secousse et bandes kente
// ═══════════════════════════════════════════════════════════════
const SCENES: Record<string, { duration: number; particles: string; count: number; mode: "fall" | "burst" }> = {
  rose: { duration: 3200, particles: "🌸", count: 14, mode: "fall" },
  diamant: { duration: 3400, particles: "✨", count: 16, mode: "burst" },
  couronne: { duration: 3800, particles: "✨", count: 18, mode: "burst" },
  lion: { duration: 4600, particles: "⭐", count: 22, mode: "burst" },
};

// Hasard reproductible tiré de l'identifiant du cadeau: React exige un
// rendu pur, et chaque cadeau garde ainsi sa propre chorégraphie.
function seeded(key: string) {
  let h = 2166136261;
  for (let i = 0; i < key.length; i++) h = Math.imul(h ^ key.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

export function GiftBurst({ burst, onDone }: { burst: Burst; onDone: () => void }) {
  const scene = SCENES[burst.gift.slug] ?? SCENES.diamant;

  useEffect(() => {
    const t = setTimeout(onDone, scene.duration);
    return () => clearTimeout(t);
  }, [burst.key, onDone, scene.duration]);

  // Trajectoires tirées une fois par cadeau: stables pendant l'animation.
  const particles = useMemo(() => {
    const rand = seeded(burst.key);
    return Array.from({ length: scene.count }, (_, i) => {
        const angle = (i / scene.count) * Math.PI * 2 + (rand() - 0.5) * 0.6;
        const dist = 110 + rand() * 90;
        return {
          i,
          left: Math.round(rand() * 100),
          delay: Math.round(rand() * (scene.mode === "fall" ? 1400 : 350)) / 1000,
          dx: Math.round(Math.cos(angle) * dist),
          dy: Math.round(Math.sin(angle) * dist),
          size: Math.round(14 + rand() * 14),
          spin: Math.round((rand() - 0.5) * 360),
        };
      });
  }, [burst.key, scene.count, scene.mode]);

  const slug = burst.gift.slug;
  const big = slug === "lion" ? 200 : slug === "couronne" ? 170 : 150;

  return (
    <div aria-live="polite" className={`gift-stage pointer-events-none absolute inset-0 z-20 overflow-hidden gift-${slug}`}
      style={{ "--gift-duration": `${scene.duration}ms` } as React.CSSProperties}>
      {/* Voile très léger pour détacher le cadeau de la vidéo */}
      <div className="gift-veil absolute inset-0 bg-black/35" />

      {slug === "lion" && (
        <div className="gift-kente absolute inset-x-0 top-1/2 -translate-y-1/2">
          {[0, 1, 2, 3].map((i) => (
            <span key={i} className={i % 2 ? "bg-[#ff6b1a]" : "bg-gold"} style={{ animationDelay: `${i * 70}ms` }} />
          ))}
        </div>
      )}
      {slug === "couronne" && <div className="gift-rays absolute left-1/2 top-[42%] h-[520px] w-[520px]" />}

      {particles.map((p) =>
        scene.mode === "fall" ? (
          <span key={p.i} className="gift-fall absolute top-0" style={{
            left: `${p.left}%`, fontSize: p.size, animationDelay: `${p.delay}s`,
            "--spin": `${p.spin}deg`,
          } as React.CSSProperties}>{scene.particles}</span>
        ) : (
          <span key={p.i} className="gift-spark absolute left-1/2 top-[42%]" style={{
            fontSize: p.size, animationDelay: `${0.35 + p.delay}s`,
            "--dx": `${p.dx}px`, "--dy": `${p.dy}px`,
          } as React.CSSProperties}>{scene.particles}</span>
        ),
      )}

      <div className={`gift-hero absolute left-1/2 top-[42%] gift-hero-${slug}`}>
        <GiftArt gift={burst.gift} size={big} className="drop-shadow-[0_8px_24px_rgba(0,0,0,0.6)]" />
      </div>

      <div className="gift-banner absolute inset-x-4 top-[calc(42%+120px)] flex justify-center">
        <div className="vip-card flex max-w-[92%] items-center gap-3 bg-black/70 px-4 py-2.5 pl-5 backdrop-blur">
          <Avatar src={burst.fan.avatar_url} name={burst.fan.display_name} size={36} className="ring-2 ring-gold" />
          <div className="min-w-0">
            <p className="truncate text-sm">
              <span className="font-bold">{burst.fan.display_name}</span>{" "}
              <span className="text-gold-grad font-semibold">a offert {burst.gift.name}</span>
            </p>
            {burst.message && <p className="truncate text-xs text-white/80">« {burst.message} »</p>}
          </div>
        </div>
      </div>
    </div>
  );
}
