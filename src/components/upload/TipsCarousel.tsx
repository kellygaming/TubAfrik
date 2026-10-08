"use client";

import { useEffect, useRef, useState } from "react";

// Conseils de créateur, en carrousel discret: ils défilent seuls toutes
// les 5 s, se balaient au doigt et s'arrêtent dès qu'on les touche.
const TIPS = [
  { icon: "🎙️", title: "Fais confiance à ta voix", text: "Une vidéo avec ta voix attire bien plus de monde qu'une musique seule." },
  { icon: "⚡", title: "Mets l'action au début", text: "Les 2 premières secondes décident de tout : c'est elles qui scotchent tes abonnés." },
  { icon: "📅", title: "Poste régulièrement", text: "Plus tu postes, plus tu as de chances de devenir viral." },
  { icon: "#️⃣", title: "2 ou 3 hashtags", text: "Bien choisis, c'est ce qui passe le mieux. Inutile d'en mettre 15." },
  { icon: "🎬", title: "Poste tes propres vidéos", text: "Les vidéos téléchargées puis republiées sont supprimées. Dommage pour tes vues !" },
  { icon: "💎", title: "La qualité avant la quantité", text: "Poste du bon contenu et prends le temps qu'il te faut." },
  { icon: "📱", title: "Filme en vertical", text: "Le format 9:16 remplit tout l'écran du téléphone." },
  { icon: "🎵", title: "Attention à la musique", text: "Une musique protégée peut faire retirer ta vidéo." },
] as const;

const EVERY = 5000;

export function TipsCarousel({ className = "" }: { className?: string }) {
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const [held, setHeld] = useState(false);

  useEffect(() => {
    if (held) return;
    const t = setInterval(() => {
      const el = track.current;
      if (!el) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % TIPS.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: next === 0 ? "auto" : "smooth" });
    }, EVERY);
    return () => clearInterval(t);
  }, [held]);

  function go(i: number) {
    setHeld(true);
    track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  }

  return (
    <section aria-label="Conseils pour réussir ta vidéo" className={`rounded-2xl border border-line bg-surface/60 ${className}`}>
      <div
        ref={track}
        onPointerDown={() => setHeld(true)}
        onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}
        className="no-scrollbar flex snap-x snap-mandatory overflow-x-auto"
      >
        {TIPS.map((t) => (
          <article key={t.title} className="flex w-full shrink-0 snap-center items-start gap-3 px-4 py-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-2 text-xl" aria-hidden>
              {t.icon}
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-text/90">{t.title}</p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{t.text}</p>
            </div>
          </article>
        ))}
      </div>
      <div className="flex justify-center gap-1.5 pb-3">
        {TIPS.map((t, i) => (
          <button
            key={t.title}
            type="button"
            onClick={() => go(i)}
            aria-label={`Conseil ${i + 1}`}
            aria-current={i === index}
            className={`h-1.5 rounded-full transition-all ${i === index ? "w-4 bg-gold" : "w-1.5 bg-white/20"}`}
          />
        ))}
      </div>
    </section>
  );
}
