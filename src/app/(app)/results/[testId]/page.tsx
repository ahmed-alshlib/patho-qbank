import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CircleHelp, Clock, RotateCcw, XCircle, Plus, TrendingDown, TrendingUp, Target } from "lucide-react";
import { getUser, requireUser } from "@/lib/auth";
import { getResults } from "@/lib/sessions";
import { eq, sql } from "drizzle-orm";
import { db, topics } from "@/db";
import { retryIncorrect } from "../../../actions-session";
import { Bar, ProgressRing } from "@/components/ui";
import ResultReview from "@/components/ResultReview";

export const dynamic = "force-dynamic";

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

/** A mock exam counts as passed from this score. */
const PASS_MARK = 60;

export default async function Results({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const user = (await requireUser());
  const r = await getResults(user.id, testId);
  if (!r) notFound();
  if (!r.test.finishedAt) redirect(`/session/${testId}`);
  const { test, items } = r;

  const correct = items.filter((i) => i.status === "correct").length;
  const incorrect = items.filter((i) => i.status === "incorrect").length;
  const unanswered = items.length - correct - incorrect;
  const score = items.length ? Math.round((correct / items.length) * 100) : 0;
  // Time actually spent answering, not the gap between opening and finishing the session:
  // a session left open overnight must not show "24h". Each answer counts at most 10 minutes
  // (the rest is time away from the screen). A timed exam can never show more than its limit.
  const wall = Math.max(0, Math.round((new Date(test.finishedAt!).getTime() - new Date(test.startedAt).getTime()) / 1000));
  const [spent] = Array.from((await db.execute(sql`
    select coalesce(sum(least(coalesce(time_spent_sec, 0), 600)), 0)::int as s
    from user_answers where user_id = ${user.id} and test_id = ${testId}`)) as unknown as ArrayLike<{ s: number }>);
  const active = Math.min(wall, spent?.s ?? 0);
  const used = test.timed && test.timeLimitSec ? Math.min(wall, test.timeLimitSec) : active;

  const group = (key: "subject" | "chapter" | "topic") => {
    const m = new Map<string, { name: string; c: number; t: number }>();
    for (const i of items) {
      const g = m.get(i[key]) ?? { name: i[key], c: 0, t: 0 };
      g.t++; if (i.status === "correct") g.c++;
      m.set(i[key], g);
    }
    return [...m.values()].sort((a, b) => a.c / a.t - b.c / b.t);
  };
  const byChapter = group("chapter");
  const byTopic = group("topic");

  let mock = false; try { mock = !!JSON.parse(test.filters || "{}").mock; } catch {}
  // Mock exams: compare with the student's previous mock on the same subjects, and point at the weakest chapter.
  let prev: number | null = null;
  let weakest: { name: string; c: number; t: number; href: string } | null = null;
  if (mock) {
    const subs = [...new Set(items.map((i) => i.subjectId))].sort().join(",");
    const rowsPrev = Array.from((await db.execute(sql`
      select t.id,
        (select count(*) from test_questions tq where tq.test_id = t.id)::int as total,
        (select count(*) from (select distinct on (question_id) is_correct from user_answers ua where ua.test_id = t.id and ua.user_id = t.user_id order by question_id, answered_at desc) y where y.is_correct)::int as correct,
        (select string_agg(distinct c.subject_id, ',' order by c.subject_id) from test_questions tq join questions q on q.id = tq.question_id join topics tp on tp.id = q.topic_id join chapters c on c.id = tp.chapter_id where tq.test_id = t.id) as subs
      from tests t
      where t.user_id = ${user.id} and t.id <> ${testId} and t.finished_at is not null and t.finished_at < ${new Date(test.finishedAt!).toISOString()}::timestamptz
        and t.filters like '%"mock":true%'
      order by t.finished_at desc limit 20`)) as unknown as ArrayLike<{ total: number; correct: number; subs: string }>);
    const p = rowsPrev.find((x) => x.subs === subs && x.total > 0);
    if (p) prev = Math.round((p.correct / p.total) * 100);
    const chMap = new Map<string, { id: string; name: string; c: number; t: number }>();
    for (const i of items) { const g = chMap.get(i.chapterId) ?? { id: i.chapterId, name: i.chapter, c: 0, t: 0 }; g.t++; if (i.status === "correct") g.c++; chMap.set(i.chapterId, g); }
    const w = [...chMap.values()].filter((g) => g.c < g.t).sort((a, b) => a.c / a.t - b.c / b.t || b.t - a.t)[0];
    if (w && chMap.size > 1) {
      const tids = (await db.select({ id: topics.id }).from(topics).where(eq(topics.chapterId, w.id))).map((x) => x.id);
      weakest = { name: w.name, c: w.c, t: w.t, href: `/session/new?mode=study&topics=${tids.join(",")}` };
    }
  }
  const passed = score >= PASS_MARK;

  return (
    <div className="space-y-6">
      <div className="stagger space-y-6">
        <div>
          <p className="eyebrow">{mock ? "Mock exam results" : `${test.mode === "exam" ? "Exam" : "Study"} session results`}</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl" data-testid="result-headline">{mock ? (passed ? "You'd pass" : "Below the pass mark") : score >= 80 ? "Excellent work" : score >= 60 ? "Good effort" : "Keep going"}</h1>
          {mock && (
            <div className="mt-2 flex flex-wrap gap-2">
              <span className={`chip ${passed ? "!text-good" : "!text-bad"}`}>Pass mark {PASS_MARK}%</span>
              {prev !== null && (score === prev
                ? <span className="chip">Same as your last mock ({prev}%)</span>
                : <span className={`chip ${score > prev ? "!text-good" : "!text-bad"}`} data-testid="vs-last">{score > prev ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}{score > prev ? "+" : ""}{score - prev}% vs your last mock</span>)}
            </div>
          )}
        </div>

        <section className="relative overflow-hidden rounded-[28px] border border-brand/30 bg-gradient-to-br from-brand/20 via-brand/5 to-transparent p-5 shadow-lift sm:p-7">
          <div className="flex flex-col items-center gap-6 sm:flex-row">
            <ProgressRing value={score} size={140} stroke={12} sub={`${correct} of ${items.length}`} />
            <div className="grid w-full flex-1 grid-cols-2 gap-3 sm:grid-cols-4">
              {[["Correct", correct, "text-good", CheckCircle2, "n-correct"], ["Wrong", incorrect, "text-bad", XCircle, "n-incorrect"], ["Skipped", unanswered, "text-muted", CircleHelp, "n-unanswered"]].map(([l, v, tone, Icon, id]) => {
                const I = Icon as typeof Clock;
                return (
                  <div key={l as string} className="rounded-2xl border border-line bg-surface/60 p-3 text-center">
                    <div className={`flex items-center justify-center gap-1 text-xs font-semibold ${tone}`}><I className="h-3.5 w-3.5" />{l as string}</div>
                    <div className="mt-1 text-2xl font-bold tabular-nums" data-testid={id as string}>{v as number}</div>
                  </div>
                );
              })}
              <div className="rounded-2xl border border-line bg-surface/60 p-3 text-center">
                <div className="flex items-center justify-center gap-1 text-xs font-semibold text-muted"><Clock className="h-3.5 w-3.5" />Time</div>
                <div className="mt-1 text-2xl font-bold tabular-nums">{fmt(used)}</div>
                {test.timed && test.timeLimitSec ? <div className="text-[11px] text-muted">of {fmt(test.timeLimitSec)}</div> : null}
              </div>
            </div>
          </div>
          <div className="mt-5 flex flex-col gap-2.5 sm:flex-row">
            {incorrect > 0 && (
              <form action={retryIncorrect} className="flex-[2]">
                <input type="hidden" name="testId" value={testId} />
                <button className="btn h-[52px] w-full !rounded-2xl text-base"><RotateCcw className="h-4 w-4" />Retry {incorrect} mistake{incorrect === 1 ? "" : "s"}</button>
              </form>
            )}
            <div className="flex flex-1 gap-2.5">
              <Link href="/session/new" className="btn-ghost h-[52px] flex-1 !rounded-2xl"><Plus className="h-4 w-4" />New</Link>
              <Link href="/history" className="btn-ghost h-[52px] flex-1 !rounded-2xl">History</Link>
            </div>
          </div>
        </section>

        {weakest && (
          <section className="flex flex-col gap-3 rounded-[22px] border border-bad/30 bg-bad/5 p-4 sm:flex-row sm:items-center" data-testid="weakest">
            <Target className="h-5 w-5 shrink-0 text-bad" />
            <p className="min-w-0 flex-1 text-sm"><b className="text-bad">Weakest chapter: {weakest.name}</b> <span className="text-muted">({weakest.c}/{weakest.t} correct)</span></p>
            <Link href={weakest.href} className="btn shrink-0 !rounded-2xl">Practise this chapter</Link>
          </section>
        )}

        <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {[["By chapter", byChapter], ["By topic", byTopic]].map(([title, list]) => (
            <div key={title as string} className="card">
              <h2 className="font-display text-lg font-semibold">{title as string}</h2>
              <div className="mt-3 space-y-3">
                {(list as typeof byChapter).map((g) => {
                  const p = Math.round((g.c / g.t) * 100);
                  return (
                    <div key={g.name}>
                      <div className="flex justify-between text-sm"><span className="truncate pr-2">{g.name}</span><span className="shrink-0 text-muted">{g.c}/{g.t} · {p}%</span></div>
                      <Bar value={p} tone={p >= 70 ? "good" : p < 50 ? "bad" : "brand"} className="mt-1.5" />
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </section>

        <ResultReview items={items} />
      </div>
    </div>
  );
}
