/** Answers per day. Days that reached the daily goal are solid, today is amber, the rest are lighter. */
export default function ActivityChart({ data, goal = 0, height = "h-28" }: { data: { key: string; label: string; count: number }[]; goal?: number; height?: string }) {
  const max = Math.max(1, goal, ...data.map((d) => d.count));
  return (
    <div className={`flex items-end gap-1.5 ${height}`} role="img" aria-label={`Questions answered on each of the last ${data.length} days`}>
      {data.map((d, n) => {
        const today = n === data.length - 1;
        const tone = !d.count ? "bg-ink/[.09]" : today ? "bg-amber" : goal && d.count < goal ? "bg-mint/45" : "bg-mint";
        return (
          <div key={d.key} className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end gap-1.5" title={`${d.key}: ${d.count} answered`}>
            <span className="text-[11px] font-semibold text-muted opacity-0 transition group-hover:opacity-100">{d.count}</span>
            <div className={`w-full rounded-[5px] transition-all duration-300 group-hover:brightness-110 ${tone} animate-rise`}
              style={{ height: `${Math.max(5, (d.count / max) * 100)}%`, animationDelay: `${n * 35}ms` }} />
            <span className={`text-[11px] ${today ? "font-bold text-ink" : "text-muted"}`}>{d.label[0]}</span>
          </div>
        );
      })}
    </div>
  );
}
