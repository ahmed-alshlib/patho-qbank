"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import { NAV_ITEMS, NavRow, useActive } from "@/components/NavLinks";

/** Phone menu behind the profile circle: everything that is not in the bottom bar, plus theme and log out. */
export default function MobileMenu({ badges, initials, name, email, children }: { badges?: Record<string, number>; initials: string; name: string; email: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const active = useActive(), path = usePathname();
  useEffect(() => setMounted(true), []);
  useEffect(() => setOpen(false), [path]);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);
  const rest = NAV_ITEMS.filter((i) => !i.bottom);
  return (
    <>
      <button className="grid h-11 w-11 place-items-center rounded-full bg-mint font-display text-[15px] font-extrabold text-onmint transition duration-200 active:scale-95" aria-label="Menu" aria-haspopup="dialog" data-testid="mobile-menu" onClick={() => setOpen(true)}>{initials}</button>
      {mounted && open && createPortal(
        <div className="animate-fade fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" onClick={() => setOpen(false)}>
          <div role="dialog" aria-modal="true" aria-label="Menu" className="glass-float animate-rise absolute inset-x-3 top-3 max-h-[88vh] overflow-y-auto p-3" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center gap-3 p-1.5 pb-3">
              <span className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-mint font-display text-[15px] font-extrabold text-onmint">{initials}</span>
              <div className="min-w-0 flex-1"><div className="truncate text-[15px] font-semibold">{name}</div><div className="truncate text-xs text-muted">{email}</div></div>
              <button className="btn-ghost h-10 w-10 !rounded-full !p-0" aria-label="Close" onClick={() => setOpen(false)}><X className="h-[18px] w-[18px]" /></button>
            </div>
            <div className="space-y-0.5">
              {rest.filter((i) => !i.group).map((i) => <NavRow key={i.href} item={i} active={active(i.href)} badge={badges?.[i.href]} />)}
              <p className="eyebrow px-3 pb-2 pt-4">Review</p>
              {rest.filter((i) => i.group).map((i) => <NavRow key={i.href} item={i} active={active(i.href)} badge={badges?.[i.href]} />)}
            </div>
            {children && <div className="mt-3 flex gap-2 border-t border-line pt-3">{children}</div>}
          </div>
        </div>, document.body)}
    </>
  );
}
