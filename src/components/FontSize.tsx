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
    <span className="inline-flex items-center overflow-hidden rounded-xl border border-line" role="group" aria-label="Text size" data-testid="font-size">
      <button onClick={f.dec} disabled={f.min} aria-label="Smaller text" title="Smaller text" className="grid h-8 w-8 place-items-center text-muted transition hover:bg-raised hover:text-ink disabled:opacity-40"><Minus className="h-3.5 w-3.5" /></button>
      <span className="select-none border-x border-line px-2 text-xs font-semibold text-muted" aria-hidden>Aa</span>
      <button onClick={f.inc} disabled={f.max} aria-label="Larger text" title="Larger text" className="grid h-8 w-8 place-items-center text-muted transition hover:bg-raised hover:text-ink disabled:opacity-40"><Plus className="h-3.5 w-3.5" /></button>
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
      <div className="h-2 overflow-hidden rounded-full bg-raised" role="progressbar" aria-valuemin={0} aria-valuemax={total} aria-valuenow={done}>
        <div className="h-full rounded-full bg-gradient-to-r from-brand to-brand2 transition-[width] duration-500" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
