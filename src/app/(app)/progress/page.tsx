import { Flame, Hourglass, Target, TrendingDown, TrendingUp } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { accessibleSubjectIds } from "@/lib/access";
import { getChapterStats, getOverview, pct } from "@/lib/stats";
import { Bar, ProgressRing } from "@/components/ui";
import ActivityChart from "@/components/ActivityChart";
import Sparkline from "@/components/Sparkline";
import Link from "next/link";
import { getTopicInsights, getWeeklyTrend, weakTopics } from "@/lib/insights";

export const dynamic = "force-dynamic";

export default async function Progress() {
  const user = (await requireUser());
  const o = await getOverview(user.id, user.dailyGoal);
  const allowed = await accessibleSubjectIds(user.id);
  const chapters = (await getChapterStats(user.id)).filter((c) => allowed.has(c.subjectId));
  const done = chapters.reduce((s, c) => s + c.completed, 0), right = chapters.reduce((s, c) => s + c.correct, 0);
  const accuracy = done ? Math.round((right / done) * 100) : null;
  const [insights, weeks] = await Promise.all([getTopicInsights(user.id), getWeeklyTrend(user.id)]);
  const weak = weakTopics(insights);
  const total = chapters.reduce((s, c) => s + c.total, 0);
  const subjects = [...new Set(chapters.map((c) => c.subjectName))].map((name) => {
    const cs = chapters.filter((c) => c.subjectName === name);
    const completed = cs.reduce((s, c) => s + c.completed, 0), correct = cs.reduce((s, c) => s + c.correct, 0);
    return { name, completed, total: cs.reduce((s, c) => s + c.total, 0), accuracy: completed ? Math.round((correct / completed) * 100) : null };
  });
  // This week against the week before, when both have answers.
  const trend = weeks.filter((w) => w.accuracy !== null);
  const delta = trend.length >= 2 ? trend[trend.length - 1].accuracy! - trend[trend.length - 2].accuracy! : null;
  const tile = "card !rounded-[22px] !p-4 lg:!rounded-[24px] lg:!p-5";

  return (
    <div className="space-y-3 lg:space-y-5">
      <h1 className="text-[30px] font-extrabold leading-[44px] lg:text-[38px] lg:leading-tight">Progress</h1>

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-5">
        <section className="card overflow-hidden !rounded-[26px] !px-[18px] !pb-2 !pt-[18px] lg:!rounded-[28px] lg:!px-7 lg:!pt-6" data-testid="weekly-trend">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="eyebrow">Accuracy</p>
              <div className="mt-2.5 font-display text-[46px] font-extrabold leading-none lg:text-[56px]">{accuracy === null ? "–" : `${accuracy}%`}</div>
            </div>
            {delta !== null && (
              <span className={`inline-flex h-[30px] items-center gap-1.5 rounded-full pl-2.5 pr-3 text-[13px] font-bold ${delta >= 0 ? "bg-mint/15 text-good" : "bg-bad/15 text-bad"}`}>
                {delta >= 0 ? <TrendingUp className="h-[15px] w-[15px]" strokeWidth={2.4} /> : <TrendingDown className="h-[15px] w-[15px]" strokeWidth={2.4} />}{delta >= 0 ? "+" : ""}{delta} this week
              </span>
            )}
          </div>
          {trend.length >= 2
            ? <div className="-mx-1.5 mt-2"><Sparkline points={trend.map((w) => w.accuracy!)} label={`Weekly accuracy: ${trend.map((w) => `${w.label} ${w.accuracy}%`).join(", ")}`} /></div>
            : <p className="pb-4 pt-3 text-sm text-muted">{accuracy === null ? "Answer some questions to see your accuracy." : "Your weekly trend appears here after two weeks of answers."}</p>}
          {trend.length >= 2 && <div className="flex justify-between pb-2 text-[11px] font-medium text-muted"><span>{trend[0].label}</span><span>{trend[trend.length - 1].label}</span></div>}
        </section>

        <div className="grid grid-cols-2 gap-2.5 lg:grid-cols-1 lg:gap-5">
          <div className={`${tile} lg:flex lg:items-center lg:gap-5`}>
            <ProgressRing value={pct(done, total)} size={84} stroke={8} className="hidden lg:block" />
            <div>
              <Target className="h-5 w-5 text-info lg:hidden" />
              <div className="mt-2.5 font-display text-[22px] font-extrabold tabular-nums lg:mt-0 lg:text-[26px]">{done} / {total}</div>
              <div className="mt-0.5 text-[12.5px] text-muted lg:text-sm">questions answered</div>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-2.5 lg:grid-cols-2 lg:gap-5">
            <div className={`${tile} hidden lg:block`}>
              <Flame className="h-5 w-5 text-warn" />
              <div className="mt-2.5 font-display text-[22px] font-extrabold tabular-nums">{o.streak} day{o.streak === 1 ? "" : "s"}</div>
              <div className="mt-0.5 text-[12.5px] text-muted">streak</div>
            </div>
            <div className={`${tile} hidden lg:block`}>
              <Hourglass className="h-5 w-5 text-info" />
              <div className="mt-2.5 font-display text-[22px] font-extrabold tabular-nums">{o.avgTime}s</div>
              <div className="mt-0.5 text-[12.5px] text-muted">per question</div>
            </div>
            <div className={`${tile} lg:hidden`}>
              <Flame className="h-5 w-5 text-warn" />
              <div className="mt-2.5 font-display text-[22px] font-extrabold tabular-nums">{o.streak} day{o.streak === 1 ? "" : "s"}</div>
              <div className="mt-0.5 text-[12.5px] text-muted">streak · {o.avgTime}s per question</div>
            </div>
          </div>
        </div>
      </div>

      <section className="card !rounded-[24px] !p-[18px] lg:!p-6">
        <div className="mb-3 flex items-center justify-between"><p className="eyebrow">Last 14 days</p><span className="text-[13px] font-semibold">{o.daily.reduce((s, d) => s + d.count, 0)} answers</span></div>
        <ActivityChart data={o.daily} goal={o.goal} height="h-28 lg:h-40" />
      </section>

      <section data-testid="weak-topics" className="pt-2">
        <h2 className="text-lg lg:text-[19px]">Needs attention</h2>
        <p className="mt-0.5 text-[13px] text-muted">Topics where your latest answers are under 75% (at least 3 answered).</p>
        <div className="card mt-2.5 divide-y divide-line !rounded-[24px] !px-[18px] !py-1">
          {weak.length === 0 && <p className="py-4 text-sm text-muted">Nothing flagged yet. Keep answering and weak spots will show here.</p>}
          {weak.map((t) => (
            <div key={t.topicId} className="flex min-h-16 items-center gap-3 py-2.5">
              <div className="min-w-0 flex-1">
                <div className="truncate text-[15px] font-semibold">{t.topic}</div>
                <div className="mt-0.5 truncate text-[12.5px] text-muted">{t.subject} · <span className={`font-semibold ${t.accuracy! < 60 ? "text-bad" : "text-warn"}`}>{t.accuracy}% correct</span> ({t.correct}/{t.answered})</div>
              </div>
              <Link href={`/session/new?topics=${t.topicId}`} className="shrink-0 rounded-full bg-raised px-3.5 py-2 text-[13px] font-semibold transition duration-200 hover:bg-ink/10 active:scale-95">Practise</Link>
            </div>
          ))}
        </div>
      </section>

      <div className="grid grid-cols-1 gap-3 pt-2 lg:grid-cols-2 lg:gap-5">
        <section className="card !rounded-[24px] !p-[18px] lg:!p-6">
          <p className="eyebrow">By subject</p>
          <div className="mt-3.5 space-y-4">
            {subjects.map((s) => (
              <div key={s.name}>
                <div className="flex items-baseline justify-between gap-3"><span className="truncate text-[14.5px] font-semibold">{s.name}</span><span className="shrink-0 text-[12.5px] text-muted">{s.accuracy === null ? "not started" : `${s.accuracy}% correct`} · {s.completed}/{s.total}</span></div>
                <Bar value={pct(s.completed, s.total)} className="mt-2" />
              </div>
            ))}
          </div>
        </section>
        <section className="card !rounded-[24px] !p-[18px] lg:!p-6">
          <p className="eyebrow">By chapter · accuracy</p>
          <div className="mt-3.5 space-y-4">
            {chapters.map((c) => (
              <div key={c.id}>
                <div className="flex items-baseline justify-between gap-3"><span className="truncate text-[14.5px] font-semibold">{c.name}</span><span className="shrink-0 text-[12.5px] text-muted">{c.accuracy === null ? "not started" : `${c.accuracy}% (${c.completed}/${c.total})`}</span></div>
                <Bar value={c.accuracy ?? 0} tone={c.accuracy === null ? "brand" : c.accuracy >= 75 ? "good" : c.accuracy >= 60 ? "warn" : "bad"} className="mt-2" />
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
