import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ChevronRight, Clock, RotateCcw, Plus, TrendingDown, TrendingUp, Target } from "lucide-react";
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

  const headline = mock ? (passed ? "You'd pass" : "Below the pass mark") : score >= 80 ? "Strong session" : score >= 60 ? "Good effort" : "Keep going";
  const tiles: [string, number, string, string][] = [["correct", correct, "text-good", "n-correct"], ["wrong", incorrect, "text-bad", "n-incorrect"], ["skipped", unanswered, "text-ink", "n-unanswered"]];

  return (
    <div className="mx-auto max-w-2xl space-y-3 lg:max-w-none lg:space-y-5">
      <section className="flex flex-col items-center pt-1 text-center lg:flex-row lg:gap-10 lg:rounded-[28px] lg:bg-surface lg:px-9 lg:py-8 lg:text-left lg:shadow-card">
        <p className="eyebrow mb-4 lg:hidden">{mock ? "Mock exam results" : `${test.mode === "exam" ? "Exam" : "Study"} session results`}</p>
        <ProgressRing value={score} size={172} stroke={13} sub={`${correct} of ${items.length} correct`} />
        <div className="mt-5 min-w-0 lg:mt-0 lg:flex-1">
          <p className="eyebrow mb-2 hidden lg:block">{mock ? "Mock exam results" : `${test.mode === "exam" ? "Exam" : "Study"} session results`}</p>
          <h1 className="text-[26px] font-extrabold leading-tight lg:text-[34px]" data-testid="result-headline">{headline}</h1>
          <div className="mt-2.5 flex flex-wrap items-center justify-center gap-2 lg:justify-start">
            {mock && <span className={`inline-flex h-8 items-center rounded-full px-3 text-[13px] font-bold ${passed ? "bg-mint/15 text-good" : "bg-bad/15 text-bad"}`}>Pass mark {PASS_MARK}%</span>}
            {mock && prev !== null && (score === prev
              ? <span className="inline-flex h-8 items-center rounded-full bg-raised px-3 text-[13px] font-semibold text-muted">Same as your last mock ({prev}%)</span>
              : <span className={`inline-flex h-8 items-center gap-1.5 rounded-full px-3 text-[13px] font-bold ${score > prev ? "bg-mint/15 text-good" : "bg-bad/15 text-bad"}`} data-testid="vs-last">{score > prev ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}{score > prev ? "+" : ""}{score - prev}% vs your last mock</span>)}
            <span className="inline-flex h-8 items-center gap-1.5 rounded-full bg-raised px-3 text-[13px] font-semibold text-ink/80"><Clock className="h-3.5 w-3.5" />{fmt(used)}{test.timed && test.timeLimitSec ? ` of ${fmt(test.timeLimitSec)}` : ""}</span>
          </div>
          <div className="mt-6 hidden gap-2.5 lg:flex">
            {incorrect > 0 && (
              <form action={retryIncorrect}>
                <input type="hidden" name="testId" value={testId} />
                <button className="btn h-[54px] !rounded-[18px] !px-6 text-base"><RotateCcw className="h-4 w-4" />Retry {incorrect} mistake{incorrect === 1 ? "" : "s"}</button>
              </form>
            )}
            <Link href="/session/new" className="btn-ghost h-[54px] !rounded-[18px] !px-5 text-[15px]"><Plus className="h-4 w-4" />New session</Link>
            <Link href="/history" className="btn-ghost h-[54px] !rounded-[18px] !px-5 text-[15px]">History</Link>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-3 gap-2.5 pt-2 lg:gap-5 lg:pt-0">
        {tiles.map(([l, v, tone, id]) => (
          <div key={l} className="card !rounded-[20px] !px-2 !py-3.5 text-center lg:!rounded-[24px] lg:!py-5">
            <div className={`font-display text-[22px] font-extrabold tabular-nums lg:text-[28px] ${tone}`} data-testid={id}>{v}</div>
            <div className="mt-0.5 text-[12.5px] text-muted lg:text-sm">{l}</div>
          </div>
        ))}
      </div>

      <div className="flex gap-2.5 lg:hidden">
        {incorrect > 0 && (
          <form action={retryIncorrect} className="min-w-0 flex-1">
            <input type="hidden" name="testId" value={testId} />
            <button className="btn h-[54px] w-full whitespace-nowrap !rounded-[18px] !px-3 text-[15px]"><RotateCcw className="h-4 w-4 shrink-0" />Retry {incorrect} mistake{incorrect === 1 ? "" : "s"}</button>
          </form>
        )}
        <Link href="/session/new" aria-label="New session" className={`btn-ghost h-[54px] !rounded-[18px] text-[15px] ${incorrect > 0 ? "w-[54px] !px-0" : "flex-1"}`}><Plus className="h-5 w-5" />{incorrect > 0 ? "" : "New session"}</Link>
        <Link href="/history" className="btn-ghost h-[54px] !rounded-[18px] !px-5 text-[15px]">History</Link>
      </div>

      {weakest && (
        <Link href={weakest.href} className="card card-hover flex items-center gap-3.5 !rounded-[22px] !py-3.5 !pl-4 !pr-3.5" data-testid="weakest">
          <span className="grid h-[42px] w-[42px] shrink-0 place-items-center rounded-full bg-warn/15 text-warn"><Target className="h-[21px] w-[21px]" /></span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[15px] font-semibold">Practise {weakest.name}</span>
            <span className="mt-0.5 block text-[12.5px] text-muted">Your weakest chapter here · {weakest.c}/{weakest.t} correct</span>
          </span>
          <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted" />
        </Link>
      )}

      <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
        {[["By chapter", byChapter], ["By topic", byTopic]].map(([title, list]) => (
          <div key={title as string} className="card !p-[18px] lg:!p-6">
            <p className="eyebrow">{title as string}</p>
            <div className="mt-3.5 space-y-3.5">
              {(list as typeof byChapter).map((g) => {
                const p = Math.round((g.c / g.t) * 100);
                return (
                  <div key={g.name}>
                    <div className="flex items-baseline justify-between gap-3"><span className="truncate text-[14.5px] font-semibold">{g.name}</span><span className="shrink-0 text-sm font-bold tabular-nums">{g.c}/{g.t}</span></div>
                    <Bar value={p} tone={p >= 80 ? "good" : p >= 60 ? "warn" : "bad"} className="mt-2" />
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </section>

      <div className="pt-3"><ResultReview items={items} /></div>
    </div>
  );
}
