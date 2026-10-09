import { CheckCircle2, Gauge, Hourglass, XCircle } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getChapterStats, getOverview, pct } from "@/lib/stats";
import { Bar, ProgressRing, Stat } from "@/components/ui";
import ActivityChart from "@/components/ActivityChart";

export const dynamic = "force-dynamic";

export default async function Progress() {
  const user = (await getUser())!;
  const o = await getOverview(user.id);
  const chapters = await getChapterStats(user.id);
  const total = chapters.reduce((s, c) => s + c.total, 0);
  const subjects = [...new Set(chapters.map((c) => c.subjectName))].map((name) => {
    const cs = chapters.filter((c) => c.subjectName === name);
    const completed = cs.reduce((s, c) => s + c.completed, 0), correct = cs.reduce((s, c) => s + c.correct, 0);
    return { name, completed, total: cs.reduce((s, c) => s + c.total, 0), accuracy: completed ? Math.round((correct / completed) * 100) : null };
  });

  return (
    <div className="space-y-6">
      <div><p className="eyebrow">Analytics</p><h1 className="mt-1 text-4xl font-semibold">Progress</h1></div>
      <div className="stagger space-y-6">
        <section className="card flex flex-col items-center gap-6 sm:flex-row">
          <ProgressRing value={pct(o.completed, total)} size={120} sub={`${o.completed}/${total}`} />
          <div className="grid w-full flex-1 grid-cols-2 gap-3">
            <Stat label="Accuracy" value={o.accuracy ?? "–"} suffix={o.accuracy === null ? "" : "%"} icon={<Gauge className="h-4 w-4" />} tone="brand" />
            <Stat label="Avg time" value={o.avgTime} suffix="s" icon={<Hourglass className="h-4 w-4" />} tone="warn" />
            <Stat label="Correct" value={o.correct} icon={<CheckCircle2 className="h-4 w-4" />} tone="good" />
            <Stat label="Incorrect" value={o.incorrect} icon={<XCircle className="h-4 w-4" />} tone="bad" />
          </div>
        </section>

        <section className="card"><h2 className="mb-4 text-xl font-semibold">Questions answered per day</h2><ActivityChart data={o.daily} /></section>

        <section className="card space-y-5">
          <h2 className="text-xl font-semibold">By subject</h2>
          {subjects.map((s) => (
            <div key={s.name} className="space-y-2">
              <div className="flex justify-between text-sm"><span className="font-medium">{s.name}</span><span className="text-muted">{s.accuracy === null ? "not started" : `${s.accuracy}% accuracy`} · {s.completed}/{s.total}</span></div>
              <Bar value={pct(s.completed, s.total)} />
            </div>
          ))}
        </section>

        <section className="card space-y-5">
          <h2 className="text-xl font-semibold">By chapter</h2>
          {chapters.map((c) => (
            <div key={c.id} className="space-y-2">
              <div className="flex justify-between gap-3 text-sm"><span><span className="text-muted">{c.subjectName} · </span><span className="font-medium">{c.name}</span></span><span className="shrink-0 text-muted">{c.accuracy === null ? "not started" : `${c.accuracy}% (${c.completed}/${c.total})`}</span></div>
              <Bar value={c.accuracy ?? 0} tone={c.accuracy === null ? "brand" : c.accuracy >= 70 ? "good" : "bad"} />
            </div>
          ))}
        </section>
      </div>
    </div>
  );
}
