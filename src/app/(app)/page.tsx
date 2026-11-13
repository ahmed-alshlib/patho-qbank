import Link from "next/link";
import { listSessions } from "@/lib/sessions";
import { getTopicInsights, studyNext } from "@/lib/insights";
import { accessibleSubjectIds } from "@/lib/access";
import { ArrowRight, Bookmark, ChevronRight, Clock, Flame, Lock, Play, Sparkles, Star, Target, Timer, TrendingUp, Zap } from "lucide-react";
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
  const done = chapters.reduce((s, c) => s + c.completed, 0);
  const right = chapters.reduce((s, c) => s + c.correct, 0);
  const acc = done ? Math.round((right / done) * 100) : null;
  const recent = chapters.filter((c) => c.lastAnsweredAt).sort((a, b) => b.lastAnsweredAt! - a.lastAnsweredAt!).slice(0, 3);
  const weak = chapters.filter((c) => c.completed >= 1 && c.accuracy !== null).sort((a, b) => a.accuracy! - b.accuracy!).slice(0, 3);
  const next = recent.find((c) => c.completed < c.total) ?? chapters.find((c) => c.completed < c.total) ?? chapters[0];
  const open = (await listSessions(user.id, 5)).filter((x) => !x.finishedAt);
  const next2 = studyNext(await getTopicInsights(user.id));
  const hasAccess = allowed.size > 0;
  const resume = open[0];
  const subjects = [...new Map(chapters.map((c) => [c.subjectId, c.subjectName])).entries()].map(([id, name]) => {
    const cs = chapters.filter((c) => c.subjectId === id);
    const t = cs.reduce((s, c) => s + c.total, 0), d = cs.reduce((s, c) => s + c.completed, 0);
    return { id, name, total: t, done: d };
  });

  // The one thing to do next: an open session first, otherwise the chapter being worked on.
  const hero = resume
    ? { eyebrow: "Session in progress", title: resume.mode === "exam" ? "Mock exam" : "Study session", sub: `${resume.answered} of ${resume.total} answered`, value: pct(resume.answered, resume.total), href: `/session/${resume.id}`, cta: "Resume" }
    : next
      ? { eyebrow: next.completed ? "Continue" : "Start here", title: next.name, sub: `${next.subjectName} · ${Math.max(0, next.total - next.completed)} question${next.total - next.completed === 1 ? "" : "s"} left`, value: pct(next.completed, next.total), href: `/study/${next.id}`, cta: next.completed ? "Resume" : "Start" }
      : null;
  const left = Math.max(0, o.goal - o.answeredToday);

  const quick = [
    { href: "/session/new?mode=exam", label: "Mock exam", sub: "Your chapters, your time", icon: Timer, tone: "text-warn lg:bg-warn/15" },
    next2
      ? { href: `/session/new?topics=${next2.topic.topicId}`, label: "Weak topic", sub: next2.topic.topic, icon: Target, tone: "text-info lg:bg-info/15", test: "study-next" }
      : { href: "/session/new?mode=study", label: "Study", sub: "Pick chapters", icon: Zap, tone: "text-info lg:bg-info/15" },
    { href: "/bookmarks", label: "Saved", sub: `${counts.bookmarks} question${counts.bookmarks === 1 ? "" : "s"}`, icon: Bookmark, tone: "text-brand lg:bg-brand/15" },
  ];
  const tile = "relative grid h-[58px] w-full place-items-center rounded-[20px] bg-surface shadow-card lg:h-[46px] lg:w-[46px] lg:shrink-0 lg:rounded-full lg:shadow-none";
  const tileWrap = "flex min-w-0 flex-col items-center gap-2 transition duration-200 lg:flex-row lg:gap-3.5 lg:rounded-[22px] lg:bg-surface lg:p-4 lg:shadow-card";

  return (
    <div className="stagger space-y-5 lg:space-y-6">
      <div>
        <div className="flex min-h-9 items-center justify-between gap-3">
          <p className="text-sm font-medium text-muted lg:text-[15px]">{new Date().toLocaleDateString("en", { weekday: "long", day: "numeric", month: "long", timeZone: TZ })}</p>
          {o.streak > 0 && (
            <Link href="/progress" aria-label={`${o.streak}-day streak`} data-testid="streak" className="inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full bg-warn/15 pl-2.5 pr-3 text-sm font-bold text-warn transition duration-200 active:scale-95 lg:h-11 lg:pl-3 lg:pr-4 lg:text-[15px]">
              <Flame className="h-[18px] w-[18px]" strokeWidth={2.2} />{o.streak}<span className="hidden lg:inline">days</span>
            </Link>
          )}
        </div>
        <h1 className="mt-0.5 text-[30px] font-extrabold leading-[1.15] lg:text-[38px]">{greeting()}, {user.name.split(" ")[0]}</h1>
      </div>

      {!hasAccess && (
        <Link href="/plans" className="card card-hover flex items-center gap-4 !border-warn/40">
          <span className="grid h-11 w-11 place-items-center rounded-full bg-warn/15 text-warn"><Star className="h-5 w-5" /></span>
          <div className="flex-1"><div className="font-semibold">Choose your subjects</div><div className="text-xs text-muted">Subscribe to a subject to unlock its questions.</div></div>
          <ArrowRight className="h-4 w-4 text-muted" />
        </Link>
      )}

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] lg:gap-5">
        {hero && (
          <section className="card relative overflow-hidden !rounded-[28px] lg:flex lg:items-center lg:!px-8 lg:!py-7" data-testid="continue">
            <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-60 w-72 bg-[radial-gradient(closest-side,rgb(var(--mint)/.17),transparent)] lg:-right-20 lg:-top-28 lg:h-96 lg:w-[28rem]" />
            <div className="relative flex items-start gap-4 lg:flex-1 lg:items-center lg:gap-8">
              <div className="min-w-0 flex-1">
                <p className="eyebrow !text-brand">{hero.eyebrow}</p>
                <h2 className="mt-2.5 text-xl font-bold leading-tight [text-wrap:balance] lg:mt-3 lg:text-[28px] lg:font-extrabold">{hero.title}</h2>
                <p className="mt-1.5 text-sm text-muted lg:mt-2 lg:text-[15.5px]">{hero.sub}</p>
                <div className="mt-6 hidden gap-3 lg:flex">
                  <Link href={hero.href} className="btn h-[54px] w-48 text-base"><Play className="h-4 w-4 fill-current" />{hero.cta}</Link>
                  <Link href="/subjects" className="btn-ghost h-[54px] px-6 text-base">All chapters</Link>
                </div>
              </div>
              <ProgressRing value={hero.value} size={72} stroke={7} className="lg:hidden" />
              <ProgressRing value={hero.value} size={140} stroke={12} sub="done" className="hidden lg:block" />
            </div>
            <Link href={hero.href} className="btn relative mt-4 h-[54px] w-full text-base lg:hidden"><Play className="h-4 w-4 fill-current" />{hero.cta}</Link>
          </section>
        )}

        <section className="card !px-[18px] !py-4 lg:!rounded-[28px] lg:!px-7 lg:!py-6" data-testid="daily-goal">
          <div className="flex items-center gap-4 lg:gap-5">
            <ProgressRing value={Math.min(100, pct(o.answeredToday, o.goal))} size={56} stroke={6} label={`${Math.min(o.answeredToday, o.goal)}/${o.goal}`} className="lg:hidden" />
            <ProgressRing value={Math.min(100, pct(o.answeredToday, o.goal))} size={84} stroke={8} label={`${Math.min(o.answeredToday, o.goal)}/${o.goal}`} className="hidden lg:block" />
            <div className="min-w-0 flex-1">
              <p className="eyebrow hidden lg:block">Today</p>
              <h2 className="font-sans text-[15px] font-semibold tracking-normal lg:mt-2 lg:font-display lg:text-xl lg:font-bold">{left === 0 ? "Daily goal reached" : `${left} more for today’s goal`}</h2>
              <div className="mt-2.5 flex items-start gap-[5px] lg:hidden" role="img" aria-label="Daily goal over the last 7 days">
                {o.week.map((d) => (
                  <span key={d.key} title={`${d.key}: ${d.count} answered`} className="flex-1 text-center">
                    <i className={`block h-1.5 rounded-full ${d.met ? "bg-mint" : d.today ? "bg-amber" : "bg-ink/[.09]"}`} />
                    <span className={`mt-1.5 block text-[11px] ${d.today ? "font-bold text-ink" : "font-medium text-muted"}`}>{d.label[0]}</span>
                  </span>
                ))}
              </div>
            </div>
          </div>
          <div className="mt-5 hidden items-start gap-[7px] lg:flex" role="img" aria-label="Daily goal over the last 7 days">
            {o.week.map((d) => (
              <span key={d.key} title={`${d.key}: ${d.count} answered`} className="flex-1 text-center">
                <i className={`block h-[7px] rounded-full ${d.met ? "bg-mint" : d.today ? "bg-amber" : "bg-ink/[.09]"}`} />
                <span className={`mt-1.5 block text-xs ${d.today ? "font-bold text-ink" : "font-medium text-muted"}`}>{d.label[0]}</span>
              </span>
            ))}
          </div>
          <form action={setDailyGoal} className="mt-3.5 flex items-center gap-1.5 border-t border-line pt-3 lg:mt-4 lg:gap-2 lg:border-0 lg:pt-0">
            <span className="mr-auto text-[13px] font-medium text-muted lg:mr-1">Daily goal</span>
            {[10, 20, 30, 50].map((g) => (
              <button key={g} name="goal" value={g} data-active={o.goal === g} aria-pressed={o.goal === g} className="pill !h-[34px] !bg-raised !px-3 text-[13px] !shadow-none data-[active=true]:!bg-ink">{g}</button>
            ))}
          </form>
        </section>
      </div>

      <div className="grid grid-cols-4 gap-2.5 lg:gap-4">
        {quick.map((t) => (
          <Link key={t.label} href={t.href} data-testid={t.test} className={`${tileWrap} active:scale-95 lg:hover:-translate-y-0.5`}>
            <span className={`${tile} ${t.tone}`}><t.icon className="h-6 w-6 lg:h-[22px] lg:w-[22px]" /></span>
            <span className="min-w-0 max-w-full text-center lg:text-left">
              <span className="block truncate text-[12.5px] font-semibold lg:text-[15.5px]">{t.label}</span>
              <span className="hidden truncate text-[13px] text-muted lg:mt-0.5 lg:block">{t.sub}</span>
            </span>
          </Link>
        ))}
        {/* Reserved for the next feature. It is deliberately not named yet. */}
        <div className={`${tileWrap} cursor-default`} aria-disabled="true" data-testid="soon-tile">
          <span className={`${tile} text-muted lg:bg-ink/[.07]`}>
            <Sparkles className="h-6 w-6 lg:h-[22px] lg:w-[22px]" />
            <span className="absolute -right-1 -top-1.5 grid h-6 w-6 place-items-center rounded-full bg-raised text-muted ring-[3px] ring-bg lg:hidden"><Lock className="h-3 w-3" strokeWidth={2.6} /></span>
          </span>
          <span className="min-w-0 max-w-full text-center lg:text-left">
            <span className="block truncate text-[12.5px] font-semibold text-muted lg:text-[15.5px] lg:text-ink">New feature</span>
            <span className="hidden items-center gap-1 text-[13px] text-muted lg:mt-0.5 lg:flex"><Lock className="h-3 w-3" />Coming soon</span>
          </span>
        </div>
      </div>

      {open.length > (resume ? 1 : 0) && (
        <section className="space-y-2">
          <h2 className="text-lg">Open sessions</h2>
          {open.slice(resume ? 1 : 0).map((x) => (
            <Link key={x.id} href={`/session/${x.id}`} className="card card-hover flex items-center gap-3 !rounded-[22px] !p-3.5">
              <span className="grid h-10 w-10 place-items-center rounded-full bg-warn/15 text-warn"><Clock className="h-5 w-5" /></span>
              <div className="flex-1"><div className="text-sm font-semibold">Resume {x.mode === "exam" ? "mock exam" : "study session"}</div><div className="text-xs text-muted">{x.answered}/{x.total} answered</div></div>
              <ChevronRight className="h-4 w-4 text-muted" />
            </Link>
          ))}
        </section>
      )}

      <div className="grid grid-cols-1 gap-6 pt-1 lg:grid-cols-[minmax(0,1.32fr)_minmax(0,1fr)_minmax(0,1fr)] lg:gap-5 lg:pt-2">
        {subjects.length > 0 && (
          <section className="min-w-0">
            <div className="flex h-8 items-center justify-between"><h2 className="text-lg lg:text-[19px]">Your subjects</h2><Link href="/subjects" className="py-1.5 pl-3 text-sm font-semibold text-brand">See all</Link></div>
            <div className="-mx-5 mt-2 flex snap-x gap-2.5 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:mt-3.5 lg:grid lg:grid-cols-2 lg:gap-3.5 lg:overflow-visible lg:px-0">
              {subjects.map((s) => (
                <Link key={s.id} href={`/subjects#s-${s.id}`} className="card card-hover w-[150px] shrink-0 snap-start !rounded-[22px] !p-3.5 lg:w-auto lg:!p-[18px]">
                  <div className="truncate text-[15px] font-semibold lg:text-[15.5px]">{s.name}</div>
                  <div className="mt-0.5 text-[12.5px] text-muted lg:text-[13px]">{s.done} of {s.total}</div>
                  <div className="mt-3.5 flex items-center gap-2"><Bar value={pct(s.done, s.total)} /><span className="text-xs font-bold tabular-nums">{pct(s.done, s.total)}%</span></div>
                </Link>
              ))}
            </div>
          </section>
        )}

        <section className="min-w-0">
          <div className="flex h-8 items-center"><h2 className="text-lg lg:text-[19px]">Needs attention</h2></div>
          <div className="card mt-2 divide-y divide-line !rounded-[24px] !px-[18px] !py-1 lg:mt-3.5">
            {weak.length === 0 && <p className="py-4 text-sm text-muted">Answer some questions to see where to focus.</p>}
            {weak.map((c) => (
              <div key={c.id} className="flex min-h-16 items-center gap-3 py-2.5">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[15px] font-semibold">{c.name}</div>
                  <div className="mt-0.5 truncate text-[12.5px] text-muted">{c.subjectName} · <span className={`font-semibold ${c.accuracy! < 60 ? "text-bad" : c.accuracy! < 75 ? "text-warn" : "text-muted"}`}>{c.accuracy}%</span></div>
                </div>
                <Link href={`/study/${c.id}`} className="shrink-0 rounded-full bg-raised px-3.5 py-2 text-[13px] font-semibold transition duration-200 hover:bg-ink/10 active:scale-95">Practise</Link>
              </div>
            ))}
          </div>
        </section>

        <section className="min-w-0">
          <div className="flex h-8 items-center justify-between"><h2 className="text-lg lg:text-[19px]">Last 14 days</h2><span className="text-sm font-medium text-muted">{o.daily.reduce((s, d) => s + d.count, 0)} answers</span></div>
          <div className="card mt-2 !rounded-[24px] !px-5 !pb-4 !pt-3 lg:mt-3.5">
            <ActivityChart data={o.daily} goal={o.goal} />
            <div className="mt-3 flex items-center justify-between border-t border-line pt-3 text-[13px]">
              <span className="text-muted">Overall accuracy</span>
              <span className="inline-flex items-center gap-1.5 font-bold text-brand"><TrendingUp className="h-4 w-4" />{acc === null ? "–" : `${acc}%`}</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
