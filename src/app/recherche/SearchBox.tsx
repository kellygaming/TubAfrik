"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/icons";

export function SearchBox({ initial }: { initial: string }) {
  const router = useRouter();
  const [q, setQ] = useState(initial);
  const input = useRef<HTMLInputElement>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  useEffect(() => {
    // La page s'ouvre prête à taper, sans un tap de plus sur le champ.
    if (!initial) input.current?.focus();
  }, [initial]);

  // La recherche part toute seule 350 ms après la dernière frappe.
  function onChange(value: string) {
    setQ(value);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      router.replace(value.trim() ? `/recherche?q=${encodeURIComponent(value.trim())}` : "/recherche", { scroll: false });
    }, 350);
  }

  return (
    <form
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        clearTimeout(timer.current);
        router.replace(q.trim() ? `/recherche?q=${encodeURIComponent(q.trim())}` : "/recherche", { scroll: false });
        input.current?.blur();
      }}
      className="flex items-center gap-2"
    >
      <div className="relative flex-1">
        <SearchIcon width={18} height={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          ref={input}
          id="recherche-createur"
          type="search"
          value={q}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Chercher un créateur…"
          enterKeyHint="search"
          autoComplete="off"
          maxLength={40}
          className="h-11 w-full rounded-full bg-surface-2 pl-10 pr-4 text-base outline-none placeholder:text-muted focus:ring-2 focus:ring-brand/40"
        />
      </div>
      <button type="button" onClick={() => history.back()} className="px-1 text-sm text-muted">
        Fermer
      </button>
    </form>
  );
}
