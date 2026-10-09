import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getChapterStats, pct } from "@/lib/stats";
import { Bar } from "@/components-ui";

export const dynamic = "force-dynamic";

export default async function Subjects() {
  const user = (await getUser())!;
  const stats = await getChapterStats(user.id);
  const bySubject = new Map<string, typeof stats>();
  for (const c of stats) bySubject.set(c.subjectName, [...(bySubject.get(c.subjectName) ?? []), c]);

  return (
    <div className="space-y-8">
      <h1 className="text-2xl font-semibold">Subjects</h1>
      {[...bySubject.entries()].map(([subject, chapters]) => (
        <section key={subject} className="space-y-3">
          <h2 className="text-lg font-medium">{subject}</h2>
          <div className="grid gap-3 md:grid-cols-2">
            {chapters.map((c) => (
              <div key={c.id} className="card space-y-3">
                <div>
                  <div className="font-medium">{c.name}</div>
                  {c.description && <div className="text-sm text-slate-500">{c.description}</div>}
                </div>
                <Bar value={pct(c.completed, c.total)} />
                <div className="grid grid-cols-4 gap-2 text-center text-xs text-slate-600">
                  <div><div className="text-base font-semibold text-slate-900">{c.total}</div>total</div>
                  <div><div className="text-base font-semibold text-slate-900">{c.total - c.completed}</div>remaining</div>
                  <div><div className="text-base font-semibold text-slate-900">{c.accuracy === null ? "–" : `${c.accuracy}%`}</div>accuracy</div>
                  <div><div className="text-base font-semibold text-red-600">{c.incorrect}</div>incorrect</div>
                </div>
                <Link className="btn w-full" href={`/study/${c.id}`}>{c.completed ? "Continue chapter" : "Start chapter"}</Link>
              </div>
            ))}
          </div>
        </section>
      ))}
      {stats.length === 0 && <p className="text-slate-500">No content has been loaded yet.</p>}
    </div>
  );
}
