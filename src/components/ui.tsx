"use client";
import { useEffect, useRef, useState } from "react";

export function Bar({ value, tone = "brand", className = "" }: { value: number; tone?: "brand" | "good" | "bad"; className?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setW(value)); return () => cancelAnimationFrame(t); }, [value]);
  const color = tone === "good" ? "bg-good" : tone === "bad" ? "bg-bad" : "bg-gradient-to-r from-brand to-brand2";
  return (
    <div className={`h-2 w-full overflow-hidden rounded-full bg-raised ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-1000 ease-out ${color}`} style={{ width: `${Math.min(100, Math.max(0, w))}%` }} />
    </div>
  );
}

export function ProgressRing({ value, size = 120, stroke = 10, label, sub }: { value: number; size?: number; stroke?: number; label?: string; sub?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setV(value)); return () => cancelAnimationFrame(t); }, [value]);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <defs><linearGradient id={`g${size}`} x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stopColor="rgb(var(--brand))" /><stop offset="100%" stopColor="rgb(var(--brand2))" /></linearGradient></defs>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--raised))" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={`url(#g${size})`} strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (Math.min(100, v) / 100) * c} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.2,.8,.2,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-display text-2xl font-semibold leading-none">{label ?? `${Math.round(value)}%`}</span>
        {sub && <span className="mt-1 text-[11px] text-muted">{sub}</span>}
      </div>
    </div>
  );
}

export function CountUp({ to, suffix = "" }: { to: number; suffix?: string }) {
  const [n, setN] = useState(0);
  const raf = useRef(0);
  useEffect(() => {
    const start = performance.now(), dur = 900;
    const tick = (t: number) => {
      const p = Math.min(1, (t - start) / dur);
      setN(Math.round(to * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf.current);
  }, [to]);
  return <>{n}{suffix}</>;
}

export function Stat({ label, value, suffix, sub, icon, tone }: { label: string; value: number | string; suffix?: string; sub?: string; icon: React.ReactNode; tone?: "good" | "bad" | "warn" | "brand" }) {
  const tint = { good: "text-good bg-good/10", bad: "text-bad bg-bad/10", warn: "text-warn bg-warn/10", brand: "text-brand bg-brand/10" }[tone ?? "brand"];
  return (
    <div className="card card-hover">
      <div className="flex items-center justify-between">
        <span className="eyebrow">{label}</span>
        <span className={`grid h-8 w-8 place-items-center rounded-lg ${tint}`}>{icon}</span>
      </div>
      <div className="mt-3 font-display text-3xl font-semibold tracking-tight">
        {typeof value === "number" ? <CountUp to={value} suffix={suffix} /> : value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand/10 text-brand">{icon}</span>
      <h3 className="font-display text-xl font-semibold">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}
