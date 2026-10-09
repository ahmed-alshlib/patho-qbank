import { getUser } from "@/lib/auth";
import { getChapterStats, getOverview, pct } from "@/lib/stats";
import { Bar, Stat } from "@/components-ui";

export const dynamic = "force-dynamic";

export default async function Progress() {
  const user = (await getUser())!;
  const o = await getOverview(user.id);
  const chapters = await getChapterStats(user.id);
  const total = chapters.reduce((s, c) => s + c.total, 0);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Progress</h1>
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Overall completion" value={`${pct(o.completed, total)}%`} sub={`${o.completed} of ${total}`} />
        <Stat label="Accuracy" value={o.accuracy === null ? "–" : `${o.accuracy}%`} />
        <Stat label="Correct / incorrect" value={`${o.correct} / ${o.incorrect}`} />
        <Stat label="Avg time / question" value={`${o.avgTime}s`} />
      </div>
      <section className="card space-y-4">
        <h2 className="font-medium">Accuracy by chapter</h2>
        {chapters.map((c) => (
          <div key={c.id} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{c.subjectName} · {c.name}</span>
              <span className="text-slate-500">{c.accuracy === null ? "not started" : `${c.accuracy}% (${c.completed}/${c.total})`}</span>
            </div>
            <Bar value={c.accuracy ?? 0} tone={c.accuracy === null ? "brand" : c.accuracy >= 70 ? "good" : "bad"} />
          </div>
        ))}
      </section>
    </div>
  );
}
