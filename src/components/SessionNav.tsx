"use client";
import { useEffect, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { Flag, X } from "lucide-react";
import Logo from "@/components/Logo";

export type NavTone = "correct" | "wrong" | "answered" | "none";
export type NavItem = { id: string; tone: NavTone; flagged?: boolean; grouped?: boolean };
export type NavFilter = { key: string; label: string; test: (x: NavItem) => boolean };

const TONE: Record<NavTone, string> = {
  correct: "border-good/70 bg-good/15 text-good",
  wrong: "border-bad/70 bg-bad/15 text-bad",
  answered: "border-brand/70 bg-brand/15 text-brand",
  none: "border-line bg-raised text-muted",
};

/** Numbered squares for every question in the session. Five per row so even long sessions stay tidy. */
export function NavGrid({ items, current, onGo, test }: { items: NavItem[]; current: number; onGo: (n: number) => void; test?: (x: NavItem) => boolean }) {
  const shown = items.map((x, n) => ({ x, n })).filter(({ x }) => !test || test(x));
  if (!shown.length) return <p className="py-6 text-center text-sm text-muted">Nothing here.</p>;
  return (
    <div className="grid grid-cols-5 gap-2 p-1.5" aria-label="Question navigator">
      {shown.map(({ x, n }) => (
        <button key={x.id} onClick={() => onGo(n)} aria-label={`Question ${n + 1}`} aria-current={n === current || undefined}
          className={`relative grid h-11 place-items-center rounded-xl border-[1.5px] text-sm font-bold tabular-nums transition hover:scale-105 ${TONE[x.tone]} ${n === current ? "z-10 !border-[2.5px] !border-brand shadow-[0_0_0_4px_rgb(var(--brand)/.22)]" : ""} ${x.grouped ? "border-b-[3px] !border-b-brand" : ""}`}>
          {n + 1}
          {x.flagged && <Flag className="absolute -right-1 -top-1 h-3.5 w-3.5 fill-warn text-warn" />}
        </button>
      ))}
    </div>
  );
}

function Tabs({ filters, value, onChange, items }: { filters: NavFilter[]; value: string; onChange: (k: string) => void; items: NavItem[] }) {
  return (
    <div className="grid gap-1 rounded-2xl border border-line bg-raised/60 p-1" style={{ gridTemplateColumns: `repeat(${filters.length}, minmax(0, 1fr))` }} role="tablist">
      {filters.map((f) => (
        <button key={f.key} role="tab" aria-selected={value === f.key} onClick={() => onChange(f.key)}
          className={`h-9 rounded-xl text-xs font-semibold transition ${value === f.key ? "bg-brand text-white shadow-soft" : "text-muted hover:text-ink"}`}>
          {f.label} {items.filter(f.test).length}
        </button>
      ))}
    </div>
  );
}

const Legend = ({ answeredOnly }: { answeredOnly?: boolean }) => (
  <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-muted">
    {answeredOnly
      ? <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-brand" />Answered</span>
      : <>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-good" />Correct</span>
          <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded bg-bad" />Wrong</span>
        </>}
    <span className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded border border-line bg-raised" />Not yet</span>
  </div>
);

type Shared = { items: NavItem[]; current: number; onGo: (n: number) => void; filters: NavFilter[]; summary: string; answeredOnly?: boolean };

/** Phone and tablet: the question numbers live in a sheet that slides up from the bottom. */
export function NavSheet({ open, onClose, footer, ...p }: Shared & { open: boolean; onClose: () => void; footer?: ReactNode }) {
  const [tab, setTab] = useState(p.filters[0]?.key ?? "all");
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);
  if (!mounted || !open) return null;
  const f = p.filters.find((x) => x.key === tab);
  return createPortal(
    <div className="fixed inset-0 z-50 bg-black/55 backdrop-blur-sm" onClick={onClose} data-testid="nav-sheet">
      <div role="dialog" aria-modal="true" aria-label="All questions" onClick={(e) => e.stopPropagation()}
        className="animate-sheet absolute inset-x-0 bottom-0 mx-auto flex max-h-[82vh] max-w-2xl flex-col rounded-t-[28px] border-t border-line bg-surface shadow-lift">
        <div className="mx-auto mt-2.5 h-1.5 w-10 rounded-full bg-line" />
        <div className="flex items-center justify-between px-5 pb-2 pt-3">
          <div><h2 className="text-xl font-semibold">Questions</h2><p className="text-xs text-muted">{p.summary}</p></div>
          <button onClick={onClose} aria-label="Close" className="btn-ghost !p-2.5"><X className="h-5 w-5" /></button>
        </div>
        <div className="space-y-3 px-5">
          <Tabs filters={p.filters} value={tab} onChange={setTab} items={p.items} />
          <Legend answeredOnly={p.answeredOnly} />
        </div>
        <div className="mt-3 min-h-0 flex-1 overflow-y-auto px-5 pb-4">
          <NavGrid items={p.items} current={p.current} test={f?.test} onGo={(n) => { p.onGo(n); onClose(); }} />
        </div>
        {footer && <div className="flex gap-2 border-t border-line px-5 pb-[max(env(safe-area-inset-bottom),18px)] pt-3">{footer}</div>}
      </div>
    </div>, document.body);
}

/** Large screens: the same grid sits in a column beside the question. */
export function NavRail({ children, ...p }: Shared & { children?: ReactNode }) {
  const [tab, setTab] = useState(p.filters[0]?.key ?? "all");
  const f = p.filters.find((x) => x.key === tab);
  return (
    <aside className="hidden lg:block">
      <div className="card sticky top-6 space-y-3 !p-4">
        <div className="flex items-baseline justify-between"><h2 className="text-base font-semibold">Questions</h2><span className="text-xs text-muted">{p.summary}</span></div>
        <Tabs filters={p.filters} value={tab} onChange={setTab} items={p.items} />
        <div className="max-h-[52vh] overflow-y-auto p-1"><NavGrid items={p.items} current={p.current} onGo={p.onGo} test={f?.test} /></div>
        <Legend answeredOnly={p.answeredOnly} />
        {children}
      </div>
    </aside>
  );
}

/** Thumb-reach actions pinned to the bottom of the screen on phones and tablets. */
export function ActionBar({ children }: { children: ReactNode }) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-line bg-[rgb(var(--bg)/.9)] px-4 pt-3 backdrop-blur-xl pb-[max(env(safe-area-inset-bottom),14px)] lg:hidden" data-testid="action-bar">
      <div className="mx-auto flex max-w-3xl items-center gap-2">{children}</div>
    </div>
  );
}

/** Keeps the brand on every screenshot of a question. */
export function LogoLine({ className = "" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2 opacity-80 ${className}`} data-testid="logo-line">
      <Logo className="h-4" /><span className="text-xs font-semibold tracking-wide text-muted">rakeezedu.com</span>
    </div>
  );
}
