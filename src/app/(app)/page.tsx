import Link from "next/link";
import { listSessions } from "@/lib/sessions";
import { getTopicInsights, studyNext } from "@/lib/insights";
import { accessibleSubjectIds } from "@/lib/access";
import { ArrowRight, ChevronRight, Clock, Flame, Play, RotateCcw, Star, StickyNote, Target, Timer, Zap } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getChapterStats, getCounts, getOverview, pct, TZ } from "@/lib/stats";
import { Bar, ProgressRing } from "@/components/ui";
import ActivityChart from "@/components/ActivityChart";
import { setDailyGoal } from "../actions-study";

export const dynamic = "force-dynamic";

function greeting() {
  const h = Number(new Date().toLocaleString("en-GB", { hour: "2-digit", hour12: false, timeZone: TZ }));
  return h < 5 ? "Good night" : h < 12 ? "Good morning" : h < 18 ? "Good afternoon" : "Good evening";
}

export default async function Dashboard() {
  const user = (await requireUser());
  const o = await getOverview(user.id, user.dailyGoal);
  const counts = await getCounts(user.id);
  const allowed = await accessibleSubjectIds(user.id);
  // Only the subjects this student can study count towards their totals.
  const chapters = (await getChapterStats(user.id)).filter((c) => allowed.has(c.subjectId));
  const totalQ = chapters.reduce((s, c) => s + c.total, 0);
  const done = chapters.reduce((s, c) => s + c.completed, 0);
  const right = chapters.reduce((s, c) => s + c.correct, 0);
  const wrong = done - right;
  const acc = done ? Math.round((right / done) * 100) : null;
  const recent = chapters.filter((c) => c.lastAnsweredAt).sort((a, b) => b.lastAnsweredAt! - a.lastAnsweredAt!).slice(0, 3);
  const weak = chapters.filter((c) => c.completed >= 1 && c.accuracy !== null).sort((a, b) => a.accuracy! - b.accuracy!).slice(0, 3);
  const next = recent.find((c) => c.completed < c.total) ?? chapters.find((c) => c.completed < c.total) ?? chapters[0];
  const open = (await listSessions(user.id, 5)).filter((x) => !x.finishedAt);
  const next2 = studyNext(await getTopicInsights(user.id));
  const hasAccess = allowed.size > 0;
  const donePct = pct(done, totalQ);
  const resume = open[0];
  const subjects = [...new Map(chapters.map((c) => [c.subjectId, c.subjectName])).entries()].map(([id, name]) => {
    const cs = chapters.filter((c) => c.subjectId === id);
    const t = cs.reduce((s, c) => s + c.total, 0), d = cs.reduce((s, c) => s + c.completed, 0);
    return { id, name, total: t, done: d };
  });

  return (
    <div className="stagger space-y-5 lg:space-y-6">
      <div>
        <p className="text-sm font-medium text-muted">{new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}</p>
        <h1 className="mt-0.5 text-[28px] font-bold leading-tight tracking-tight sm:text-4xl">{greeting()}, {user.name.split(" ")[0]}</h1>
      </div>

      {!hasAccess && (
        <Link href="/plans" className="card card-hover flex items-center gap-4 !border-warn/40">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-warn/15 text-warn"><Star className="h-5 w-5" /></span>
          <div className="flex-1"><div className="font-semibold">Choose your subjects</div><div className="text-xs text-muted">Subscribe to a subject to unlock its questions.</div></div>
          <ArrowRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]">
        {(resume || next) && (
          <section className="relative overflow-hidden rounded-[26px] border border-brand/30 bg-gradient-to-br from-brand/25 via-brand/10 to-transparent p-5 shadow-lift sm:p-6">
            <div className="pointer-events-none absolute -right-16 -top-16 h-56 w-56 rounded-full bg-brand/20 blur-3xl" />
            <p className="relative text-[11px] font-bold uppercase tracking-[.14em] text-brand">{resume ? "Session in progress" : "Continue where you left"}</p>
            {resume ? (
              <>
                <h2 className="relative mt-1.5 text-xl font-semibold leading-snug">{resume.mode === "exam" ? "Exam session" : "Study session"}</h2>
                <p className="relative mt-1 text-sm text-muted">{resume.answered} of {resume.total} answered</p>
                <Bar value={pct(resume.answered, resume.total)} className="relative mt-4" />
                <Link href={`/session/${resume.id}`} className="btn relative mt-5 h-[52px] w-full !rounded-2xl text-base"><Play className="h-4 w-4 fill-current" />Resume</Link>
              </>
            ) : next && (
              <>
                <h2 className="relative mt-1.5 text-xl font-semibold leading-snug">{next.name}</h2>
                <p className="relative mt-1 text-sm text-muted">{next.subjectName} · {Math.max(0, next.total - next.completed)} of {next.total} questions left</p>
                <Bar value={pct(next.completed, next.total)} className="relative mt-4" />
                <Link href={`/study/${next.id}`} className="btn relative mt-5 h-[52px] w-full !rounded-2xl text-base"><Play className="h-4 w-4 fill-current" />{next.completed ? "Resume" : "Start"}</Link>
              </>
            )}
          </section>
        )}

        <div className="grid grid-cols-3 gap-3 lg:grid-cols-1">
          <Link href="/subjects" className="card card-hover flex flex-col justify-center !p-4 lg:flex-row lg:items-center lg:justify-start lg:gap-4">
            <span className="text-2xl font-bold tabular-nums">{donePct}%</span>
            <span className="mt-0.5 text-xs text-muted lg:mt-0">{done} / {totalQ} done</span>
          </Link>
          <Link href="/progress" className="card card-hover flex flex-col justify-center !p-4 lg:flex-row lg:items-center lg:justify-start lg:gap-4">
            <span className="text-2xl font-bold tabular-nums text-good">{acc ?? "–"}{acc === null ? "" : "%"}</span>
            <span className="mt-0.5 text-xs text-muted lg:mt-0">accuracy</span>
          </Link>
          <Link href="/incorrect" className="card card-hover flex flex-col justify-center !border-bad/30 !bg-bad/5 !p-4 lg:flex-row lg:items-center lg:justify-start lg:gap-4" data-testid="to-review">
            <span className="text-2xl font-bold tabular-nums text-bad">{wrong}</span>
            <span className="mt-0.5 text-xs text-muted lg:mt-0">to review</span>
          </Link>
        </div>
      </div>

      <section className="card flex flex-col gap-4 !p-4 sm:flex-row sm:items-center sm:!p-5" data-testid="daily-goal">
        <div className="flex items-center gap-4">
          <ProgressRing value={Math.min(100, pct(o.answeredToday, o.goal))} size={68} stroke={7} label={`${Math.min(o.answeredToday, o.goal)}/${o.goal}`} />
          <div className="min-w-0">
            <h2 className="text-base font-semibold">{o.answeredToday >= o.goal ? "Daily goal reached" : `${o.goal - o.answeredToday} more for today's goal`}</h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-warn"><Flame className="h-3.5 w-3.5" />{o.streak > 0 ? `${o.streak}-day streak` : "Reach your goal to start a streak"}</p>
            <div className="mt-2 flex gap-1.5" aria-label="Last 7 days">
              {o.week.map((d) => (
                <span key={d.key} title={`${d.key}: ${d.count} answered`} className={`h-1.5 w-6 rounded-full ${d.met ? "bg-good" : d.today ? "bg-warn" : "bg-raised"}`} />
              ))}
            </div>
          </div>
        </div>
        <form action={setDailyGoal} className="flex items-center gap-1.5 sm:ml-auto">
          <span className="mr-1 text-xs text-muted">Goal</span>
          {[10, 20, 30, 50].map((g) => (
            <button key={g} name="goal" value={g} data-active={o.goal === g} className="h-9 min-w-10 rounded-full border border-line px-3 text-xs font-semibold text-muted transition hover:text-ink data-[active=true]:border-brand data-[active=true]:bg-brand/10 data-[active=true]:text-brand">{g}</button>
          ))}
        </form>
      </section>

      <section>
        <h2 className="mb-3 text-lg font-semibold">Quick start</h2>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {[
            next2
              ? { href: `/session/new?topics=${next2.topic.topicId}`, label: "Study next", sub: next2.topic.topic, icon: Target, tone: "bg-brand/15 text-brand", test: "study-next" }
              : { href: "/session/new?mode=study", label: "Study", sub: "pick chapters", icon: Zap, tone: "bg-brand/15 text-brand" },
            { href: "/session/new?mode=exam", label: "Exam mode", sub: "timed or untimed", icon: Timer, tone: "bg-warn/15 text-warn" },
            { href: wrong ? "/practice/incorrect" : "/incorrect", label: "Retry mistakes", sub: `${wrong} question${wrong === 1 ? "" : "s"}`, icon: RotateCcw, tone: "bg-bad/15 text-bad" },
            { href: "/bookmarks", label: "Bookmarks", sub: `${counts.bookmarks} saved`, icon: Star, tone: "bg-sky-400/15 text-sky-500 dark:text-sky-300" },
          ].map((t) => (
            <Link key={t.label} href={t.href} data-testid={t.test} className="card card-hover flex min-h-[72px] items-center gap-3 !p-3.5">
              <span className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl ${t.tone}`}><t.icon className="h-5 w-5" /></span>
              <span className="min-w-0"><span className="block text-sm font-semibold">{t.label}</span><span className="block truncate text-xs text-muted">{t.sub}</span></span>
            </Link>
          ))}
        </div>
      </section>

      {open.length > (resume ? 1 : 0) && (
        <section className="space-y-2">
          <h2 className="text-lg font-semibold">Open sessions</h2>
          {open.slice(resume ? 1 : 0).map((x) => (
            <Link key={x.id} href={`/session/${x.id}`} className="card card-hover flex items-center gap-3 !p-3.5">
              <span className="grid h-10 w-10 place-items-center rounded-xl bg-warn/10 text-warn"><Clock className="h-5 w-5" /></span>
              <div className="flex-1"><div className="text-sm font-semibold">Resume {x.mode === "exam" ? "exam" : "study"} session</div><div className="text-xs text-muted">{x.answered}/{x.total} answered</div></div>
              <ChevronRight className="h-4 w-4 text-muted" />
            </Link>
          ))}
        </section>
      )}

      {subjects.length > 0 && (
        <section>
          <div className="mb-3 flex items-center justify-between"><h2 className="text-lg font-semibold">Your subjects</h2><Link href="/subjects" className="text-sm font-semibold">See all</Link></div>
          <div className="-mx-4 flex snap-x gap-3 overflow-x-auto px-4 pb-1 lg:mx-0 lg:grid lg:grid-cols-3 lg:overflow-visible lg:px-0">
            {subjects.map((s) => (
              <Link key={s.id} href={`/subjects#s-${s.id}`} className="card card-hover w-44 shrink-0 snap-start !p-4 lg:w-auto">
                <div className="truncate text-[15px] font-semibold">{s.name}</div>
                <div className="mt-1 text-xs text-muted">{pct(s.done, s.total)}% · {s.total} questions</div>
                <Bar value={pct(s.done, s.total)} className="mt-3 !h-1.5" />
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="card">
        <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Last 14 days</h2><span className="chip">{o.daily.reduce((s, d) => s + d.count, 0)} answers</span></div>
        <ActivityChart data={o.daily} />
      </section>

      <div className="grid gap-4 md:grid-cols-2">
        <section className="card space-y-1">
          <h2 className="mb-2 text-lg font-semibold">Recently studied</h2>
          {recent.length === 0 && <p className="text-sm text-muted">Nothing yet. Pick a chapter to begin.</p>}
          {recent.map((c) => (
            <Link key={c.id} href={`/study/${c.id}`} className="block space-y-2 rounded-xl p-3 transition hover:bg-raised">
              <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{c.name}</span><span className="shrink-0 text-muted">{c.completed}/{c.total}</span></div>
              <Bar value={pct(c.completed, c.total)} />
            </Link>
          ))}
        </section>
        <section className="card space-y-1">
          <h2 className="mb-2 text-lg font-semibold">Needs attention</h2>
          {weak.length === 0 && <p className="text-sm text-muted">Answer some questions to see where to focus.</p>}
          {weak.map((c) => (
            <Link key={c.id} href={`/study/${c.id}`} className="block space-y-2 rounded-xl p-3 transition hover:bg-raised">
              <div className="flex justify-between gap-3 text-sm"><span className="font-medium">{c.name}</span><span className="shrink-0 text-muted">{c.accuracy}%</span></div>
              <Bar value={c.accuracy!} tone={c.accuracy! >= 70 ? "good" : "bad"} />
            </Link>
          ))}
        </section>
      </div>

      <Link href="/notes" className="card card-hover flex items-center gap-3 !p-3.5">
        <span className="grid h-10 w-10 place-items-center rounded-xl bg-brand/10 text-brand"><StickyNote className="h-5 w-5" /></span>
        <div className="flex-1"><div className="text-sm font-semibold">Notes &amp; highlights</div><div className="text-xs text-muted">{counts.notes} saved</div></div>
        <ChevronRight className="h-4 w-4 text-muted" />
      </Link>
    </div>
  );
}
