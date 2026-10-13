"use client";
import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import { NAV_ITEMS, useActive } from "@/components/NavLinks";

/** Phone menu: reaches everything that is not in the bottom bar (summaries, bookmarks, incorrect, notes, subscriptions). */
export default function MobileMenu({ badges }: { badges?: Record<string, number> }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const active = useActive(), path = usePathname();
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [path]);
  const rest = NAV_ITEMS.filter((i) => !i.bottom);
  const row = (i: (typeof NAV_ITEMS)[number]) => (
    <Link key={i.href} href={i.href} data-active={active(i.href)} className="nav-link"><i.icon className="h-[18px] w-[18px]" />{i.label}
      {!!badges?.[i.href] && <span className="ml-auto rounded-full bg-bad/15 px-2 py-0.5 text-[11px] font-semibold text-bad">{badges[i.href]}</span>}</Link>
  );
  return (
    <>
      <button className="btn-ghost !p-2.5" aria-label="Menu" data-testid="mobile-menu" onClick={() => setOpen(true)}><Menu className="h-4 w-4" /></button>
      {mounted && open && createPortal(
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div className="glass-float absolute inset-x-3 top-3 max-h-[85vh] space-y-1 overflow-y-auto !p-4" onClick={(e) => e.stopPropagation()}>
            <div className="mb-2 flex items-center justify-between"><span className="font-display text-lg font-semibold">Menu</span><button className="btn-ghost !p-2" aria-label="Close" onClick={() => setOpen(false)}><X className="h-4 w-4" /></button></div>
            {rest.filter((i) => !i.group).map(row)}
            <p className="eyebrow px-3 pb-1 pt-3">Review</p>
            {rest.filter((i) => i.group).map(row)}
          </div>
        </div>, document.body)}
    </>
  );
}
