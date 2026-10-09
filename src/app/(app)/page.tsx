import Link from "next/link";
import { listSessions } from "@/lib/sessions";
import { ArrowRight, Plus, CircleX, Clock, Flame, Star, StickyNote, Target, Zap } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getChapterStats, getCounts, getOverview, pct } from "@/lib/stats";
import { Bar, ProgressRing, Stat } from "@/components/ui";
import ActivityChart from "@/components/ActivityChart";

export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const user = (await getUser())!;
  const o = await getOverview(user.id);
  const counts = await getCounts(user.id);
  const chapters = await getChapterStats(user.id);
  const totalQ = chapters.reduce((s, c) => s + c.total, 0);
  const recent = chapters.filter((c) => c.lastAnsweredAt).sort((a, b) => b.lastAnsweredAt! - a.lastAnsweredAt!).slice(0, 3);
  const weak = chapters.filter((c) => c.completed >= 1 && c.accuracy !== null).sort((a, b) => a.accuracy! - b.accuracy!).slice(0, 3);
  const next = recent.find((c) => c.completed < c.total) ?? chapters.find((c) => c.completed < c.total) ?? chapters[0];
  const open = (await listSessions(user.id, 5)).filter((x) => !x.finishedAt);
  const donePct = pct(o.completed, totalQ);

  return (
    <div className="space-y-6">
      <div className="stagger space-y-6">
        <div>
          <p className="eyebrow">{new Date().toLocaleDateString("en", { weekday: "long", month: "long", day: "numeric" })}</p>
          <h1 className="mt-1 text-4xl font-semibold">Welcome back, {user.name.split(" ")[0]}</h1>
        </div>

        <section className="card relative flex flex-col items-center gap-6 overflow-hidden !p-6 sm:flex-row sm:!p-8">
          <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand/10 blur-3xl" />
          <ProgressRing value={donePct} size={132} stroke={11} sub="complete" />
          <div className="relative flex-1 text-center sm:text-left">
            <p className="eyebrow">Your progress</p>
            <p className="mt-1 font-display text-2xl font-semibold">{o.completed} of {totalQ} questions completed</p>
            <p className="mt-1 text-sm text-muted">{o.accuracy === null ? "Answer your first question to start tracking accuracy." : `${o.accuracy}% accuracy so far. ${o.incorrect ? `${o.incorrect} to review.` : "No mistakes to review."}`}</p>
          </div>
          {next && (
            <Link href={`/study/${next.id}`} className="btn relative !px-5 !py-3">
              {o.completed ? "Continue" : "Start"}: {next.name.length > 22 ? next.name.slice(0, 22) + "…" : next.name}<ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </section>

        <section className="grid gap-3 sm:grid-cols-2">
          <Link href="/session/new" className="card card-hover group flex items-center gap-4 !border-brand/30 !bg-brand/5 !p-4">
            <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand text-white"><Plus className="h-5 w-5" /></span>
            <div className="flex-1"><div className="font-semibold">Create a session</div><div className="text-xs text-muted">Study or exam mode, pick chapters, topics and count</div></div>
            <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
          </Link>
          {open.map((x) => (
            <Link key={x.id} href={`/session/${x.id}`} className="card card-hover group flex items-center gap-4 !p-4">
              <span className="grid h-11 w-11 place-items-center rounded-xl bg-warn/10 text-warn"><Clock className="h-5 w-5" /></span>
              <div className="flex-1"><div className="font-semibold">Resume {x.mode === "exam" ? "exam" : "study"} session</div><div className="text-xs text-muted">{x.answered}/{x.total} answered</div></div>
              <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
            </Link>
          ))}
        </section>

        <section className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat label="Accuracy" value={o.accuracy ?? "–"} suffix={o.accuracy === null ? "" : "%"} sub={`${o.correct} correct`} icon={<Target className="h-4 w-4" />} tone="good" />
          <Stat label="Today" value={o.answeredToday} sub="questions answered" icon={<Zap className="h-4 w-4" />} tone="brand" />
          <Stat label="Streak" value={o.streak} sub={o.streak === 1 ? "day in a row" : "days in a row"} icon={<Flame className="h-4 w-4" />} tone="warn" />
          <Stat label="Avg time" value={o.avgTime} suffix="s" sub="per question" icon={<Clock className="h-4 w-4" />} tone="brand" />
        </section>

        <section className="grid gap-3 sm:grid-cols-3">
          {[{ href: "/incorrect", label: "Incorrect questions", n: counts.incorrect, icon: CircleX, tone: "text-bad bg-bad/10" },
            { href: "/bookmarks", label: "Bookmarks", n: counts.bookmarks, icon: Star, tone: "text-warn bg-warn/10" },
            { href: "/notes", label: "Notes & highlights", n: counts.notes, icon: StickyNote, tone: "text-brand bg-brand/10" }].map(({ href, label, n, icon: Icon, tone }) => (
            <Link key={href} href={href} className="card card-hover group flex items-center gap-4 !p-4">
              <span className={`grid h-11 w-11 place-items-center rounded-xl ${tone}`}><Icon className="h-5 w-5" /></span>
              <div className="flex-1"><div className="font-display text-2xl font-semibold leading-none">{n}</div><div className="mt-1 text-xs text-muted">{label}</div></div>
              <ArrowRight className="h-4 w-4 text-muted transition group-hover:translate-x-1 group-hover:text-brand" />
            </Link>
          ))}
        </section>

        <section className="card">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-xl font-semibold">Last 14 days</h2><span className="chip">{o.daily.reduce((s, d) => s + d.count, 0)} answers</span></div>
          <ActivityChart data={o.daily} />
        </section>

        <div className="grid gap-4 md:grid-cols-2">
          <section className="card space-y-2">
            <h2 className="mb-2 text-xl font-semibold">Recently studied</h2>
            {recent.length === 0 && <p className="text-sm text-muted">Nothing yet. Pick a chapter to begin.</p>}
            {recent.map((c) => (
              <Link key={c.id} href={`/study/${c.id}`} className="block space-y-2 rounded-xl p-3 transition hover:bg-raised">
                <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{c.name}</span><span className="shrink-0 text-muted">{c.completed}/{c.total}</span></div>
                <Bar value={pct(c.completed, c.total)} />
              </Link>
            ))}
          </section>
          <section className="card space-y-2">
            <h2 className="mb-2 text-xl font-semibold">Needs attention</h2>
            {weak.length === 0 && <p className="text-sm text-muted">Answer some questions to see where to focus.</p>}
            {weak.map((c) => (
              <Link key={c.id} href={`/study/${c.id}`} className="block space-y-2 rounded-xl p-3 transition hover:bg-raised">
                <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{c.name}</span><span className="shrink-0 text-muted">{c.accuracy}%</span></div>
                <Bar value={c.accuracy!} tone={c.accuracy! >= 70 ? "good" : "bad"} />
              </Link>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
}
