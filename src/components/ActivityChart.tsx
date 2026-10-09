export default function ActivityChart({ data }: { data: { key: string; label: string; count: number }[] }) {
  const max = Math.max(1, ...data.map((d) => d.count));
  return (
    <div className="flex h-36 items-end gap-1.5">
      {data.map((d, n) => (
        <div key={d.key} className="group flex h-full flex-1 flex-col items-center justify-end gap-1.5" title={`${d.key}: ${d.count} answered`}>
          <span className="text-[10px] font-medium text-muted opacity-0 transition group-hover:opacity-100">{d.count}</span>
          <div className={`w-full rounded-md transition-all duration-300 group-hover:brightness-110 ${d.count ? "bg-gradient-to-t from-brand to-brand2" : "bg-raised"} animate-rise`}
            style={{ height: `${Math.max(6, (d.count / max) * 100)}%`, animationDelay: `${n * 40}ms` }} />
          <span className="text-[10px] text-muted">{d.label[0]}</span>
        </div>
      ))}
    </div>
  );
}
