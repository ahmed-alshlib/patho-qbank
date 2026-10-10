"use client";
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Button + floating panel. The panel is rendered at the page root so no card can hide it, and it closes on outside click, Escape and after a form inside it is submitted. */
export default function Popover({ trigger, triggerClass = "", label, width = 352, children }: {
  trigger: React.ReactNode; triggerClass?: string; label: string; width?: number; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number; w: number; maxH: number } | null>(null);
  const btn = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);

  const place = () => {
    const el = btn.current; if (!el) return;
    const r = el.getBoundingClientRect();
    const w = Math.min(width, window.innerWidth - 16);
    const left = Math.min(Math.max(8, r.right - w), window.innerWidth - w - 8);
    setPos({ top: r.bottom + 8, left, w, maxH: Math.max(180, window.innerHeight - r.bottom - 24) });
  };
  useLayoutEffect(() => { if (open) place(); }, [open]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!open) return;
    const down = (e: MouseEvent) => {
      const t = e.target as Element;
      if (panel.current?.contains(t) || btn.current?.contains(t) || t.closest?.("[role=dialog]")) return;
      setOpen(false);
    };
    const key = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    window.addEventListener("mousedown", down); window.addEventListener("keydown", key);
    window.addEventListener("resize", place); window.addEventListener("scroll", place, true);
    return () => { window.removeEventListener("mousedown", down); window.removeEventListener("keydown", key); window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true); };
  }, [open]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <>
      <button ref={btn} type="button" aria-expanded={open} aria-label={label} title={label} className={triggerClass} onClick={() => setOpen((o) => !o)}>{trigger}</button>
      {open && pos && createPortal(
        <div ref={panel} data-popover style={{ position: "fixed", top: pos.top, left: pos.left, width: pos.w, maxHeight: pos.maxH }}
          className="z-50 space-y-3 overflow-y-auto glass-float !rounded-2xl p-4 text-left"
          onSubmit={() => setTimeout(() => setOpen(false), 150)}>{children}</div>,
        document.body)}
    </>
  );
}
