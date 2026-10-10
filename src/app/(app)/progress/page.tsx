import { CheckCircle2, Gauge, Hourglass, XCircle } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getChapterStats, getOverview, pct } from "@/lib/stats";
import { Bar, ProgressRing, Stat } from "@/components/ui";
import ActivityChart from "@/components/ActivityChart";
import Link from "next/link";
import { getTopicInsights, getWeeklyTrend, weakTopics } from "@/lib/insights";

export const dynamic = "force-dynamic";

export default async function Progress() {
  const user = (await getUser())!;
  const o = await getOverview(user.id);
  const chapters = await getChapterStats(user.id);
  const [insights, weeks] = await Promise.all([getTopicInsights(user.id), getWeeklyTrend(user.id)]);
  const weak = weakTopics(insights);
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

        <section className="card space-y-4" data-testid="weak-topics">
          <div><h2 className="text-xl font-semibold">Weak topics</h2><p className="text-sm text-muted">Topics where your latest answers are under 75% (needs at least 3 answered).</p></div>
          {weak.length === 0 && <p className="text-sm text-muted">Nothing flagged yet. Keep answering and weak spots will show here.</p>}
          {weak.map((t) => (
            <div key={t.topicId} className="flex flex-wrap items-center gap-3">
              <div className="min-w-0 flex-1 space-y-1.5">
                <div className="flex justify-between gap-3 text-sm"><span className="truncate"><span className="text-muted">{t.subject} · {t.chapter} · </span><span className="font-medium">{t.topic}</span></span><span className="shrink-0 text-bad">{t.accuracy}% ({t.correct}/{t.answered})</span></div>
                <Bar value={t.accuracy!} tone="bad" />
              </div>
              <Link href={`/session/new?topics=${t.topicId}`} className="btn-ghost !py-1.5 text-xs">Practice</Link>
            </div>
          ))}
        </section>

        <section className="card space-y-4" data-testid="weekly-trend">
          <h2 className="text-xl font-semibold">Weekly accuracy</h2>
          {weeks.length === 0 ? <p className="text-sm text-muted">Answer some questions to see your weekly trend.</p> : (
            <div className="flex items-end gap-2 sm:gap-3" style={{ height: 150 }}>
              {weeks.map((w) => (
                <div key={w.label} className="flex flex-1 flex-col items-center justify-end gap-1" style={{ height: "100%" }} title={`${w.answers} answers, ${w.accuracy}% correct`}>
                  <span className="text-[11px] font-medium text-muted">{w.accuracy}%</span>
                  <div className="w-full max-w-10 rounded-t-lg bg-gradient-to-t from-brand to-brand2" style={{ height: `${Math.max(4, (w.accuracy ?? 0) * 0.9)}%` }} />
                  <span className="text-[10px] text-muted">{w.label}</span>
                </div>
              ))}
            </div>
          )}
        </section>

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
