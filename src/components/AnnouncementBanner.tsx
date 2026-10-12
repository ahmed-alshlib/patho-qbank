"use client";
import { useEffect, useState } from "react";
import { AlertTriangle, Info, Megaphone, X } from "lucide-react";

type A = { id: string; message: string; level: string };
const KEY = "rk_ann_dismissed";
const STYLE: Record<string, { box: string; icon: typeof Info }> = {
  info: { box: "!border-brand/40", icon: Megaphone },
  warning: { box: "!border-warn/50", icon: AlertTriangle },
  urgent: { box: "!border-bad/50", icon: AlertTriangle },
};

export default function AnnouncementBanner({ items }: { items: A[] }) {
  const [gone, setGone] = useState<string[]>([]);
  useEffect(() => { try { setGone(JSON.parse(localStorage.getItem(KEY) ?? "[]")); } catch {} }, []);
  const dismiss = (id: string) => { const n = [...gone, id].slice(-50); setGone(n); try { localStorage.setItem(KEY, JSON.stringify(n)); } catch {} };
  const shown = items.filter((a) => a.level === "urgent" || !gone.includes(a.id));
  if (!shown.length) return null;
  return (
    <div className="mb-4 space-y-3" data-testid="announcements">
      {shown.map((a) => {
        const st = STYLE[a.level] ?? STYLE.info, Icon = st.icon;
        return (
          <div key={a.id} className={`card flex items-start gap-3 !p-4 text-sm ${st.box}`} role="status">
            <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${a.level === "urgent" ? "text-bad" : a.level === "warning" ? "text-warn" : "text-brand"}`} />
            <p dir="auto" className="flex-1 whitespace-pre-line leading-6">{a.message}</p>
            {a.level !== "urgent" && <button onClick={() => dismiss(a.id)} aria-label="Dismiss" className="grid h-6 w-6 shrink-0 place-items-center rounded-md text-muted hover:bg-raised"><X className="h-4 w-4" /></button>}
          </div>
        );
      })}
    </div>
  );
}
