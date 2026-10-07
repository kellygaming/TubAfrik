"use client";

import { useState } from "react";
import { GiftIcon } from "../icons";
import { SupportSheet, type SupportTarget } from "./SupportSheet";

export function SupportButton({ target }: { target: SupportTarget }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex h-10 items-center justify-center gap-1.5 rounded-full bg-gold px-4 text-sm font-bold text-black transition active:scale-[0.97]"
      >
        <GiftIcon width={18} height={18} /> Soutenir
      </button>
      <SupportSheet target={open ? target : null} onClose={() => setOpen(false)} />
    </>
  );
}
