import Link from "next/link";
import { ArrowRight, BookOpen } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getChapterStats, pct } from "@/lib/stats";
import { EmptyState, ProgressRing } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Subjects() {
  const user = (await getUser())!;
  const stats = await getChapterStats(user.id);
  const bySubject = new Map<string, typeof stats>();
  for (const c of stats) bySubject.set(c.subjectName, [...(bySubject.get(c.subjectName) ?? []), c]);

  return (
    <div className="space-y-10">
      <div><p className="eyebrow">Question bank</p><h1 className="mt-1 text-4xl font-semibold">Subjects</h1></div>
      {stats.length === 0 && <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No content yet" text="Questions will appear here once they are loaded." />}
      {[...bySubject.entries()].map(([subject, chapters]) => {
        const total = chapters.reduce((s, c) => s + c.total, 0), done = chapters.reduce((s, c) => s + c.completed, 0);
        return (
          <section key={subject} className="space-y-4">
            <div className="flex items-end justify-between border-b border-line pb-3">
              <h2 className="text-2xl font-semibold">{subject}</h2>
              <span className="text-sm text-muted">{done}/{total} done · {pct(done, total)}%</span>
            </div>
            <div className="stagger grid gap-4 md:grid-cols-2">
              {chapters.map((c) => (
                <Link key={c.id} href={`/study/${c.id}`} className="card card-hover group flex items-center gap-5">
                  <ProgressRing value={pct(c.completed, c.total)} size={76} stroke={7} />
                  <div className="min-w-0 flex-1 space-y-2">
                    <div>
                      <div className="font-display text-lg font-semibold leading-tight">{c.name}</div>
                      {c.description && <div className="mt-0.5 line-clamp-1 text-xs text-muted">{c.description}</div>}
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      <span className="chip">{c.total} questions</span>
                      <span className="chip">{c.total - c.completed} left</span>
                      {c.accuracy !== null && <span className="chip !text-good">{c.accuracy}% accuracy</span>}
                      {c.incorrect > 0 && <span className="chip !text-bad">{c.incorrect} incorrect</span>}
                    </div>
                  </div>
                  <ArrowRight className="h-5 w-5 shrink-0 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
                </Link>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
