import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CircleHelp, Clock, RotateCcw, XCircle, Plus } from "lucide-react";
import { getUser, requireUser } from "@/lib/auth";
import { getResults } from "@/lib/sessions";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { retryIncorrect } from "../../../actions-session";
import { Bar, ProgressRing } from "@/components/ui";
import ResultReview from "@/components/ResultReview";

export const dynamic = "force-dynamic";

function fmt(sec: number) {
  const m = Math.floor(sec / 60), s = sec % 60;
  return m >= 60 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${m}m ${String(s).padStart(2, "0")}s`;
}

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

  return (
    <div className="space-y-6">
      <div className="stagger space-y-6">
        <div>
          <p className="eyebrow">{test.mode === "exam" ? "Exam" : "Study"} session results</p>
          <h1 className="mt-1 text-3xl font-semibold sm:text-4xl">{score >= 80 ? "Excellent work" : score >= 60 ? "Good effort" : "Keep going"}</h1>
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

        <section className="grid gap-4 lg:grid-cols-2">
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
