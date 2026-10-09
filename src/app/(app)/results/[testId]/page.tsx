import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { CheckCircle2, CircleHelp, Clock, RotateCcw, XCircle, Plus } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getResults } from "@/lib/sessions";
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
  const user = (await getUser())!;
  const r = await getResults(user.id, testId);
  if (!r) notFound();
  if (!r.test.finishedAt) redirect(`/session/${testId}`);
  const { test, items } = r;

  const correct = items.filter((i) => i.status === "correct").length;
  const incorrect = items.filter((i) => i.status === "incorrect").length;
  const unanswered = items.length - correct - incorrect;
  const score = items.length ? Math.round((correct / items.length) * 100) : 0;
  const used = Math.max(0, Math.round((new Date(test.finishedAt!).getTime() - new Date(test.startedAt).getTime()) / 1000));

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
          <h1 className="mt-1 text-4xl font-semibold">{score >= 80 ? "Excellent work" : score >= 60 ? "Good effort" : "Keep going"}</h1>
        </div>

        <section className="card flex flex-col items-center gap-6 !p-6 sm:flex-row sm:!p-8">
          <ProgressRing value={score} size={132} stroke={11} sub="score" />
          <div className="grid flex-1 grid-cols-2 gap-4 sm:grid-cols-4">
            <div><div className="flex items-center gap-1.5 text-good"><CheckCircle2 className="h-4 w-4" /><span className="eyebrow !text-good">Correct</span></div><div className="mt-1 font-display text-3xl font-semibold" data-testid="n-correct">{correct}</div></div>
            <div><div className="flex items-center gap-1.5 text-bad"><XCircle className="h-4 w-4" /><span className="eyebrow !text-bad">Incorrect</span></div><div className="mt-1 font-display text-3xl font-semibold" data-testid="n-incorrect">{incorrect}</div></div>
            <div><div className="flex items-center gap-1.5 text-muted"><CircleHelp className="h-4 w-4" /><span className="eyebrow">Unanswered</span></div><div className="mt-1 font-display text-3xl font-semibold" data-testid="n-unanswered">{unanswered}</div></div>
            <div><div className="flex items-center gap-1.5 text-muted"><Clock className="h-4 w-4" /><span className="eyebrow">Time</span></div><div className="mt-1 font-display text-3xl font-semibold">{fmt(used)}</div>{test.timed && test.timeLimitSec ? <div className="text-xs text-muted">of {fmt(test.timeLimitSec)}</div> : null}</div>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          {incorrect > 0 && (
            <form action={retryIncorrect}>
              <input type="hidden" name="testId" value={testId} />
              <button className="btn"><RotateCcw className="h-4 w-4" />Retry incorrect ({incorrect})</button>
            </form>
          )}
          <Link href="/session/new" className="btn-ghost"><Plus className="h-4 w-4" />New session</Link>
          <Link href="/history" className="btn-ghost">History</Link>
        </div>

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
