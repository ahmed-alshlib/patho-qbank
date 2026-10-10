export default function Loading() {
  return (
    <div className="space-y-4" aria-busy="true">
      <div className="h-9 w-56 animate-pulse rounded-xl bg-raised" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {[0, 1, 2].map((i) => <div key={i} className="card h-28 animate-pulse" />)}
      </div>
      <div className="card h-48 animate-pulse" />
    </div>
  );
}
