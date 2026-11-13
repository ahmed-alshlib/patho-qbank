"use client";
import { useEffect, useState } from "react";
import type { CSSProperties } from "react";
import { Minus, Plus } from "lucide-react";

const STEPS = [0.85, 1, 1.15, 1.3, 1.5];
const KEY = "rk_font_step";

/** Reading size for questions, choices and explanations. Saved on this device. */
export function useFontScale() {
  const [step, setStep] = useState(1);
  useEffect(() => { try { const s = Number(localStorage.getItem(KEY)); if (s >= 0 && s < STEPS.length && Number.isInteger(s)) setStep(s); } catch {} }, []);
  const set = (n: number) => { const v = Math.max(0, Math.min(STEPS.length - 1, n)); setStep(v); try { localStorage.setItem(KEY, String(v)); } catch {} };
  return { step, dec: () => set(step - 1), inc: () => set(step + 1), style: { "--qs": STEPS[step] } as CSSProperties, min: step === 0, max: step === STEPS.length - 1 };
}

export function FontSizeControl({ f }: { f: ReturnType<typeof useFontScale> }) {
  return (
    <span className="inline-flex h-9 items-center overflow-hidden rounded-full bg-surface shadow-card" role="group" aria-label="Text size" data-testid="font-size">
      <button onClick={f.dec} disabled={f.min} aria-label="Smaller text" title="Smaller text" className="grid h-9 w-9 place-items-center text-ink/70 transition hover:text-ink active:scale-90 disabled:opacity-35"><Minus className="h-3.5 w-3.5" strokeWidth={2.4} /></button>
      <span className="select-none px-0.5 text-xs font-bold text-muted" aria-hidden>Aa</span>
      <button onClick={f.inc} disabled={f.max} aria-label="Larger text" title="Larger text" className="grid h-9 w-9 place-items-center text-ink/70 transition hover:text-ink active:scale-90 disabled:opacity-35"><Plus className="h-3.5 w-3.5" strokeWidth={2.4} /></button>
    </span>
  );
}

export function SessionProgress({ done, total, position }: { done: number; total: number; position: number }) {
  const pct = total ? Math.round((done / total) * 100) : 0;
  return (
    <div data-testid="session-progress" className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-medium text-muted">
        <span>Question {position} of {total}</span><span className="tabular-nums">{done} answered · {pct}%</span>
      </div>
      <div className="h-[5px] overflow-hidden rounded-full bg-ink/[.09]" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-full rounded-full bg-mint transition-[width] duration-700" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
