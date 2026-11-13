/** A small smooth line with a soft fill under it. Values are percentages (0-100). */
export default function Sparkline({ points, height = 76, label }: { points: number[]; height?: number; label: string }) {
  const w = 320, pad = 7;
  if (points.length < 2) return null;
  const lo = Math.max(0, Math.min(...points) - 6), hi = Math.min(100, Math.max(...points) + 4);
  const span = Math.max(1, hi - lo);
  const xs = points.map((_, i) => pad + (i * (w - 2 * pad)) / (points.length - 1));
  const ys = points.map((p) => height - pad - ((p - lo) / span) * (height - 2 * pad));
  let d = `M${xs[0].toFixed(1)} ${ys[0].toFixed(1)}`;
  for (let i = 1; i < points.length; i++) {
    const cx = ((xs[i - 1] + xs[i]) / 2).toFixed(1);
    d += ` C${cx} ${ys[i - 1].toFixed(1)} ${cx} ${ys[i].toFixed(1)} ${xs[i].toFixed(1)} ${ys[i].toFixed(1)}`;
  }
  const last = points.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${height}`} preserveAspectRatio="none" role="img" aria-label={label} className="block w-full" style={{ height }}>
      <defs><linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stopColor="rgb(var(--mint))" stopOpacity=".28" /><stop offset="1" stopColor="rgb(var(--mint))" stopOpacity="0" /></linearGradient></defs>
      <path d={`${d} L${xs[last].toFixed(1)} ${height} L${xs[0].toFixed(1)} ${height} Z`} fill="url(#spark-fill)" />
      <path d={d} fill="none" stroke="rgb(var(--mint))" strokeWidth="2.6" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}
