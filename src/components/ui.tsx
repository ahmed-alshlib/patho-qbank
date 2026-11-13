"use client";
import { useEffect, useRef, useState } from "react";

export function Bar({ value, tone = "brand", className = "" }: { value: number; tone?: "brand" | "good" | "bad" | "warn"; className?: string }) {
  const [w, setW] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setW(value)); return () => cancelAnimationFrame(t); }, [value]);
  const color = tone === "bad" ? "bg-bad" : tone === "warn" ? "bg-amber" : "bg-mint";
  return (
    <div className={`h-1.5 w-full overflow-hidden rounded-full bg-ink/[.09] ${className}`}>
      <div className={`h-full rounded-full transition-[width] duration-1000 ease-out ${color}`} style={{ width: `${Math.min(100, Math.max(0, w))}%` }} />
    </div>
  );
}

/** A progress ring that fills smoothly when it appears. The label size follows the ring size unless labelClass is given. */
export function ProgressRing({ value, size = 120, stroke = 10, label, sub, labelClass, className = "" }: { value: number; size?: number; stroke?: number; label?: string; sub?: string; labelClass?: string; className?: string }) {
  const [v, setV] = useState(0);
  useEffect(() => { const t = requestAnimationFrame(() => setV(value)); return () => cancelAnimationFrame(t); }, [value]);
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  const auto = size >= 150 ? "font-display text-[44px] font-extrabold" : size >= 110 ? "font-display text-[32px] font-extrabold" : size >= 66 ? "font-display text-[17px] font-extrabold" : size >= 50 ? "text-[13px] font-bold" : "text-[11.5px] font-bold";
  return (
    <div className={`relative shrink-0 ${className}`} style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--ink) / .09)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgb(var(--mint))" strokeWidth={stroke} strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c - (Math.min(100, v) / 100) * c} style={{ transition: "stroke-dashoffset 1.2s cubic-bezier(.22,1,.36,1)" }} />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className={`leading-none tabular-nums ${labelClass ?? auto}`}>{label ?? `${Math.round(value)}%`}</span>
        {sub && <span className={`text-muted ${size >= 150 ? "mt-1.5 text-sm" : "mt-1 text-[12px]"}`}>{sub}</span>}
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
        <span className={`grid h-9 w-9 place-items-center rounded-full ${tint}`}>{icon}</span>
      </div>
      <div className="mt-3 font-display text-3xl font-extrabold">
        {typeof value === "number" ? <CountUp to={value} suffix={suffix} /> : value}
      </div>
      {sub && <div className="mt-1 text-xs text-muted">{sub}</div>}
    </div>
  );
}

export function EmptyState({ icon, title, text, children }: { icon: React.ReactNode; title: string; text: string; children?: React.ReactNode }) {
  return (
    <div className="card flex flex-col items-center gap-3 py-14 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-full bg-brand/10 text-brand">{icon}</span>
      <h3 className="font-display text-xl font-bold">{title}</h3>
      <p className="max-w-sm text-sm text-muted">{text}</p>
      {children}
    </div>
  );
}
