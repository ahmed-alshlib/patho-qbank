import Link from "next/link";
import { getUser } from "@/lib/auth";
import { getChapterStats, getOverview, pct } from "@/lib/stats";
import { Bar, Stat } from "@/components-ui";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = (await getUser())!;
  const o = await getOverview(user.id);
  const chapters = await getChapterStats(user.id);
  const totalQ = chapters.reduce((s, c) => s + c.total, 0);
  const recent = chapters.filter((c) => c.lastAnsweredAt).sort((a, b) => b.lastAnsweredAt! - a.lastAnsweredAt!).slice(0, 3);
  const weak = chapters.filter((c) => c.completed >= 1 && c.accuracy !== null).sort((a, b) => a.accuracy! - b.accuracy!).slice(0, 3);
  const next = recent[0] ?? chapters[0];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Welcome back, {user.name.split(" ")[0]}</h1>
        <p className="text-sm text-slate-500">Here is your study overview.</p>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Stat label="Completed" value={`${o.completed}/${totalQ}`} sub={`${pct(o.completed, totalQ)}% of the bank`} />
        <Stat label="Accuracy" value={o.accuracy === null ? "–" : `${o.accuracy}%`} sub={`${o.correct} correct, ${o.incorrect} incorrect`} />
        <Stat label="Today" value={o.answeredToday} sub="questions answered" />
        <Stat label="Study streak" value={`${o.streak} day${o.streak === 1 ? "" : "s"}`} />
      </div>

      {next && (
        <div className="card flex items-center justify-between gap-4">
          <div>
            <div className="text-xs uppercase tracking-wide text-slate-500">{recent[0] ? "Continue studying" : "Start studying"}</div>
            <div className="font-medium">{next.subjectName} · {next.name}</div>
          </div>
          <Link className="btn" href={`/study/${next.id}`}>{recent[0] ? "Continue" : "Start"}</Link>
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="font-medium">Recently studied</h2>
          {recent.length === 0 && <p className="text-sm text-slate-500">Nothing yet. Pick a chapter to begin.</p>}
          {recent.map((c) => (
            <Link key={c.id} href={`/study/${c.id}`} className="block space-y-1 rounded-lg p-2 hover:bg-slate-50">
              <div className="flex justify-between text-sm"><span>{c.name}</span><span className="text-slate-500">{c.completed}/{c.total}</span></div>
              <Bar value={pct(c.completed, c.total)} />
            </Link>
          ))}
        </section>
        <section className="card space-y-3">
          <h2 className="font-medium">Weakest chapters</h2>
          {weak.length === 0 && <p className="text-sm text-slate-500">Answer some questions to see where you need work.</p>}
          {weak.map((c) => (
            <Link key={c.id} href={`/study/${c.id}`} className="block space-y-1 rounded-lg p-2 hover:bg-slate-50">
              <div className="flex justify-between text-sm"><span>{c.name}</span><span className="text-slate-500">{c.accuracy}%</span></div>
              <Bar value={c.accuracy!} tone={c.accuracy! >= 70 ? "good" : "bad"} />
            </Link>
          ))}
        </section>
      </div>
    </div>
  );
}
