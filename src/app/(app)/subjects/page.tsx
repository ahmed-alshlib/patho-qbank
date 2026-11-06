import Link from "next/link";
import { BookOpen, ChevronRight } from "lucide-react";
import { accessibleSubjectIds } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { getChapterStats, pct } from "@/lib/stats";
import { Bar, EmptyState, ProgressRing } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Subjects() {
  const user = (await requireUser());
  const allowed = await accessibleSubjectIds(user.id);
  // Only the subjects this student has an active subscription for. Everything else is on the Subscriptions page.
  const stats = (await getChapterStats(user.id)).filter((c) => allowed.has(c.subjectId));
  const subjects = [...new Map(stats.map((c) => [c.subjectId, c.subjectName])).entries()].map(([id, name]) => {
    const chapters = stats.filter((c) => c.subjectId === id);
    const total = chapters.reduce((s, c) => s + c.total, 0), done = chapters.reduce((s, c) => s + c.completed, 0);
    const right = chapters.reduce((s, c) => s + c.correct, 0), wrong = chapters.reduce((s, c) => s + c.incorrect, 0);
    const next = chapters.find((c) => c.completed < c.total) ?? chapters[0];
    return { id, name, chapters, total, done, wrong, acc: done ? Math.round((right / done) * 100) : null, next };
  });

  return (
    <div className="space-y-6">
      <h1 className="text-[30px] font-bold tracking-tight sm:text-4xl">Subjects</h1>
      {subjects.length === 0 && (
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No active subjects yet" text="Subscribe to a subject to see its chapters and start practising.">
          <Link href="/plans" className="btn mt-2">Browse subscriptions</Link>
        </EmptyState>
      )}

      {subjects.length > 1 && (
        <nav aria-label="Jump to subject" className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:px-0">
          {subjects.map((s) => (
            <a key={s.id} href={`#s-${s.id}`} className="flex h-10 shrink-0 items-center rounded-full border border-line bg-surface px-4 text-sm font-semibold text-ink/80 transition hover:border-brand hover:text-brand">{s.name}</a>
          ))}
        </nav>
      )}

      {subjects.map((s) => (
        <section key={s.id} id={`s-${s.id}`} className="scroll-mt-24 space-y-3">
          <div className="relative overflow-hidden rounded-[26px] border border-brand/30 bg-gradient-to-br from-brand/20 via-brand/5 to-transparent p-5 shadow-soft">
            <div className="flex items-center gap-4">
              <ProgressRing value={pct(s.done, s.total)} size={78} stroke={8} />
              <div className="min-w-0 flex-1">
                <h2 className="text-xl font-bold">{s.name}</h2>
                <p className="mt-0.5 text-sm text-muted">{s.total} questions · {s.chapters.length} chapters</p>
                <p className="text-sm text-muted">{s.acc === null ? "Not started yet" : `${s.acc}% accuracy`}{s.wrong ? ` · ${s.wrong} to review` : ""}</p>
              </div>
            </div>
            <div className="mt-4 flex gap-2.5">
              {s.next && <Link href={`/study/${s.next.id}`} className="btn h-12 flex-1 !rounded-2xl">Practice</Link>}
              <Link href="/session/new?mode=exam" className="btn-ghost h-12 flex-1 !rounded-2xl font-semibold">Mock exam</Link>
            </div>
          </div>

          <p className="eyebrow px-1 pt-2">Chapters</p>
          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {s.chapters.map((c) => (
              <Link key={c.id} href={`/study/${c.id}`} className="card card-hover group flex items-center gap-3 !rounded-[20px] !p-4">
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline justify-between gap-3">
                    <span className="min-w-0 truncate text-[15px] font-semibold">{c.name}</span>
                    <span className="shrink-0 text-xs font-semibold tabular-nums text-muted">{c.completed}/{c.total}</span>
                  </div>
                  <Bar value={pct(c.completed, c.total)} className="mt-2.5 !h-1.5" />
                  {(c.accuracy !== null || c.incorrect > 0) && (
                    <div className="mt-2 flex gap-3 text-xs">
                      {c.accuracy !== null && <span className="text-good">{c.accuracy}% accuracy</span>}
                      {c.incorrect > 0 && <span className="text-bad">{c.incorrect} wrong</span>}
                    </div>
                  )}
                </div>
                <ChevronRight className="h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-brand" />
              </Link>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
