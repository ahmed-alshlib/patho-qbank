import Link from "next/link";
import { ArrowRight, History as HistoryIcon, Plus, Timer } from "lucide-react";
import { getUser, requireUser } from "@/lib/auth";
import { listSessions, TZ } from "@/lib/sessions";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function History() {
  const user = (await requireUser());
  const list = await listSessions(user.id);
  const when = (d: Date) => d.toLocaleString("en", { timeZone: TZ, month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
  return (
    <div className="space-y-6">
      <div className="flex items-end justify-between gap-3">
        <div><p className="eyebrow">Sessions</p><h1 className="mt-1 text-4xl font-semibold">History</h1></div>
        <Link href="/session/new" className="btn"><Plus className="h-4 w-4" />New session</Link>
      </div>
      {list.length === 0 ? (
        <EmptyState icon={<HistoryIcon className="h-6 w-6" />} title="No sessions yet" text="Create a study or exam session and it will show up here.">
          <Link href="/session/new" className="btn mt-2">Create session</Link>
        </EmptyState>
      ) : (
        <div className="stagger space-y-3">
          {list.map((s) => {
            const done = !!s.finishedAt;
            const score = s.total ? Math.round((s.correct / s.total) * 100) : 0;
            return (
              <Link key={s.id} href={done ? `/results/${s.id}` : `/session/${s.id}`} className="card card-hover flex items-center gap-4" data-testid="session-row">
                <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl text-xs font-bold ${done ? "bg-brand/10 text-brand" : "bg-warn/10 text-warn"}`}>
                  {done ? `${score}%` : "…"}
                </span>
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-semibold">{s.mock ? "Mock exam" : s.mode === "exam" ? "Exam" : "Study"} · {s.total} questions</span>
                    {s.timed && <span className="chip"><Timer className="h-3 w-3" />{s.timeLimitSec ? Math.round(s.timeLimitSec / 60) : ""} min</span>}
                    {!done && <span className="chip !bg-warn/15 !text-warn">In progress</span>}
                  </div>
                  <div className="mt-0.5 text-xs text-muted">{when(s.startedAt)} · {s.answered}/{s.total} answered{done ? ` · ${s.correct} correct` : ""}</div>
                </div>
                <ArrowRight className="h-4 w-4 text-muted" />
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
