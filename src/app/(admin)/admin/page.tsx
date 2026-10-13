import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, inArray, isNull, sql } from "drizzle-orm";
import { Check, ChevronRight, CircleCheck, Flag, Settings as Cog, ShieldCheck, Trash2, Users, Wallet, X } from "lucide-react";
import { db, subjects, subscriptions, users, reportedQuestions, questions, topics, chapters } from "@/db";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { mailProvider } from "@/lib/mail";
import { TZ } from "@/lib/stats";
import { approveSubscription, rejectSubscription, revokeSubscription, grantSubscription, resolveReport, deleteReport, saveSettings, setStudentPassword } from "../../actions-admin";
import { EmptyState } from "@/components/ui";
import ActivityChart from "@/components/ActivityChart";
import { getOverviewActivity, getOverviewLight } from "@/lib/adminStats";
import ConfirmButton from "@/components/ConfirmButton";
import AdminTabs from "../AdminTabs";

export const dynamic = "force-dynamic";
const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);
const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString("en", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const day = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }) : "");

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; all?: string; subject?: string; status?: string; sort?: string; page?: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const sp = await searchParams;
  const { tab = "overview", all } = sp;

  const [pendingN] = rows<{ n: number }>(await db.execute(sql`select count(*)::int n from subscriptions where status='pending'`));
  const [reportN] = rows<{ n: number }>(await db.execute(sql`select count(*)::int n from reported_questions where resolved_at is null`));
  return (
    <div className="space-y-6">
      <AdminTabs active={tab} counts={{ requests: pendingN.n, reports: reportN.n }} />

      {tab === "requests" && await Requests({ all: !!all })}
      {tab === "overview" && await Overview()}
      {tab === "students" && await Students({ sp })}
      {tab === "reports" && await Reports({ all: !!all })}
      {tab === "settings" && await SettingsTab()}
    </div>
  );
}

async function Requests({ all }: { all: boolean }) {
  const list = rows<{ id: string; status: string; reference: string; price: number; created_at: string; approved_at: string | null; expires_at: string | null; name: string; email: string; subject: string }>(await db.execute(sql`
    select s.id, s.status, s.reference, s.price, s.created_at, s.approved_at, s.expires_at, u.name, u.email, sb.name as subject
    from subscriptions s join users u on u.id = s.user_id join subjects sb on sb.id = s.subject_id
    where ${all ? sql`true` : sql`s.status = 'pending'`} order by (s.status = 'pending') desc, s.created_at desc limit 100`));
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{all ? "All requests" : "Waiting for approval"}</h2>
        <Link className="text-sm text-brand" href={`/admin?tab=requests${all ? "" : "&all=1"}`}>{all ? "Only pending" : "Show history"}</Link></div>
      {list.length === 0 && <EmptyState icon={<Wallet className="h-6 w-6" />} title="No pending requests" text="When a student requests a subject it will appear here. Check the WhatsApp receipt, then approve." />}
      {list.map((r) => (
        <div key={r.id} className="card flex flex-wrap items-center gap-4" data-testid="request-row">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{r.name} <span className="font-normal text-muted">· {r.email}</span></div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-xs">
              <span className="chip">{r.subject}</span><span className="chip">{r.price} LYD</span>
              <span className="chip tracking-widest">Ref {r.reference}</span><span className="chip">{when(r.created_at)}</span>
              {r.status === "active" && <span className="chip !bg-good/15 !text-good">Active until {day(r.expires_at)}</span>}
              {(r.status === "rejected" || r.status === "revoked") && <span className="chip !text-bad">{r.status}</span>}
            </div>
          </div>
          {r.status === "pending" && (
            <div className="flex gap-2">
              <form action={approveSubscription}><input type="hidden" name="id" value={r.id} /><ConfirmButton tone="brand" title="Approve this request?" confirmLabel="Approve" message={`Confirm that you received the payment from ${r.name} for ${r.subject}. Their access starts now.`} className="btn !py-2"><Check className="h-4 w-4" />Approve</ConfirmButton></form>
              <form action={rejectSubscription}><input type="hidden" name="id" value={r.id} /><ConfirmButton title="Decline this request?" confirmLabel="Decline" message={`Decline ${r.name}'s request for ${r.subject}? They will see it as declined and can request again.`} className="btn-ghost !py-2"><X className="h-4 w-4" />Decline</ConfirmButton></form>
            </div>
          )}
          {r.status === "active" && <form action={revokeSubscription}><input type="hidden" name="id" value={r.id} /><ConfirmButton title="Revoke access?" confirmLabel="Revoke" message={`${r.name} will lose access to ${r.subject} immediately.`} className="btn-ghost !py-2 text-xs">Revoke</ConfirmButton></form>}
        </div>
      ))}
    </section>
  );
}

type SP = { q?: string; subject?: string; status?: string; sort?: string; page?: string };
const PAGE = 20;
const STATUSES: [string, string][] = [["all", "Any status"], ["active", "Active access"], ["expiring", "Expiring in 7 days"], ["expired", "Expired"], ["none", "No access"], ["pending", "Waiting for approval"]];
const SORTS: [string, string][] = [["recent", "Newest first"], ["active", "Last active"], ["expiring", "Expiring soonest"], ["name", "Name A–Z"]];

async function Students({ sp }: { sp: SP }) {
  const q = (sp.q ?? "").trim().toLowerCase();
  const status = STATUSES.some(([k]) => k === sp.status) ? sp.status! : "all";
  const sort = SORTS.some(([k]) => k === sp.sort) ? sp.sort! : "recent";
  const page = Math.max(1, Math.floor(Number(sp.page)) || 1);
  const subs = await db.select().from(subjects).orderBy(asc(subjects.order));
  const subject = subs.some((s) => s.id === sp.subject) ? sp.subject! : "";

  const sub = subject ? sql` and s.subject_id = ${subject}` : sql``;
  const hasActive = sql`exists (select 1 from subscriptions s where s.user_id = u.id and s.status = 'active' and s.expires_at > now()${sub})`;
  const conds = [sql`not u.is_admin`];
  if (q) conds.push(sql`(lower(u.name) like ${`%${q}%`} or lower(u.email) like ${`%${q}%`})`);
  if (status === "active") conds.push(hasActive);
  else if (status === "expiring") conds.push(sql`exists (select 1 from subscriptions s where s.user_id = u.id and s.status = 'active' and s.expires_at > now() and s.expires_at < now() + interval '7 days'${sub})`);
  else if (status === "expired") conds.push(sql`exists (select 1 from subscriptions s where s.user_id = u.id and s.status = 'active' and s.expires_at <= now()${sub}) and not ${hasActive}`);
  else if (status === "none") conds.push(sql`not ${hasActive}`);
  else if (status === "pending") conds.push(sql`exists (select 1 from subscriptions s where s.user_id = u.id and s.status = 'pending'${sub})`);
  else if (subject) conds.push(sql`exists (select 1 from subscriptions s where s.user_id = u.id and s.status in ('active', 'pending')${sub})`);
  const where = sql.join(conds, sql` and `);
  const order = sort === "name" ? sql`lower(u.name)` : sort === "active" ? sql`last desc nulls last`
    : sort === "expiring" ? sql`(select min(s.expires_at) from subscriptions s where s.user_id = u.id and s.status = 'active' and s.expires_at > now()) asc nulls last` : sql`u.created_at desc`;

  const [total] = rows<{ n: number }>(await db.execute(sql`select count(*)::int n from users u where ${where}`));
  const list = rows<{ id: string; name: string; email: string; created_at: string; answers: number; last: string | null }>(await db.execute(sql`
    select u.id, u.name, u.email, u.created_at,
      (select count(*)::int from user_answers a where a.user_id = u.id) as answers,
      (select max(answered_at) from user_answers a where a.user_id = u.id) as last
    from users u where ${where} order by ${order} limit ${PAGE} offset ${(page - 1) * PAGE}`));
  const ids = list.map((u) => u.id);
  const subsAll = ids.length ? await db.select({ id: subscriptions.id, userId: subscriptions.userId, subject: subjects.name, expiresAt: subscriptions.expiresAt })
    .from(subscriptions).innerJoin(subjects, eq(subscriptions.subjectId, subjects.id))
    .where(and(inArray(subscriptions.userId, ids), eq(subscriptions.status, "active"), sql`${subscriptions.expiresAt} > now()`)) : [];
  const pages = Math.max(1, Math.ceil(total.n / PAGE));
  const link = (p: number) => `/admin?${new URLSearchParams({ tab: "students", ...(q ? { q } : {}), ...(subject ? { subject } : {}), ...(status !== "all" ? { status } : {}), ...(sort !== "recent" ? { sort } : {}), page: String(p) })}`;
  const filtered = !!(q || subject || status !== "all");

  return (
    <section className="space-y-3">
      <div className="flex items-end justify-between gap-3"><h2 className="text-xl font-semibold">Students <span className="text-base font-normal text-muted" data-testid="student-total">({total.n}{filtered ? " found" : " total"})</span></h2>
        {filtered && <Link href="/admin?tab=students" className="text-sm text-brand">Clear filters</Link>}</div>
      <form className="card grid gap-2 !p-3 sm:grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr_1fr_auto]" data-testid="student-filters">
        <input type="hidden" name="tab" value="students" />
        <input name="q" defaultValue={sp.q} placeholder="Search name or email" className="input !py-2" aria-label="Search students" />
        <select name="subject" defaultValue={subject} className="input !py-2" aria-label="Subject"><option value="">All subjects</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <select name="status" defaultValue={status} className="input !py-2" aria-label="Status">{STATUSES.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <select name="sort" defaultValue={sort} className="input !py-2" aria-label="Sort">{SORTS.map(([k, l]) => <option key={k} value={k}>{l}</option>)}</select>
        <button className="btn !py-2">Apply</button>
      </form>
      {list.map((u) => (
        <Link key={u.id} href={`/admin/students/${u.id}`} className="card card-hover flex flex-wrap items-center gap-3" data-testid="student-row">
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{u.name}</div>
            <div className="text-xs text-muted">{u.email} · joined {day(u.created_at)} · {u.answers} answers{u.last ? ` · last active ${when(u.last)}` : ""}</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {subsAll.filter((s) => s.userId === u.id).map((s) => <span key={s.id} className="chip !bg-good/15 !text-good">{s.subject} · until {day(s.expiresAt)}</span>)}
              {!subsAll.some((s) => s.userId === u.id) && <span className="text-xs text-muted">No active subjects</span>}
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted" />
        </Link>
      ))}
      {list.length === 0 && <div className="card text-sm text-muted">No students match these filters.</div>}
      {pages > 1 && (
        <div className="flex items-center justify-between pt-1 text-sm">
          {page > 1 ? <Link className="btn-ghost !py-2" href={link(page - 1)}>Previous</Link> : <span />}
          <span className="text-muted">Page {page} of {pages}</span>
          {page < pages ? <Link className="btn-ghost !py-2" href={link(page + 1)}>Next</Link> : <span />}
        </div>
      )}
    </section>
  );
}

const ago = (t: number) => { const m = Math.max(0, Math.round((Date.now() - t) / 60000)); return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`; };

async function Overview() {
  const [light, act, cfg] = await Promise.all([getOverviewLight(), getOverviewActivity(), getSettings()]);
  const byDay = new Map(act.daily.map((d) => [d.d, d]));
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(Date.now() - (13 - i) * 86400000), key = d.toLocaleDateString("en-CA", { timeZone: TZ });
    return { key, label: d.toLocaleDateString("en", { weekday: "short", timeZone: TZ }), count: byDay.get(key)?.answers ?? 0 };
  });
  const money = (n: number) => `${n.toLocaleString("en")} ${cfg.currency}`;
  const card = (label: string, value: string | number, sub: string, href?: string, tone = "") => {
    const inner = <><div className="eyebrow">{label}</div><div className={`mt-2 font-display text-3xl font-semibold ${tone}`}>{value}</div><div className="mt-1 text-xs text-muted">{sub}</div></>;
    return href ? <Link href={href} className="card card-hover">{inner}</Link> : <div className="card">{inner}</div>;
  };
  return (
    <section className="space-y-6" data-testid="overview">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-3">
        {card("Students", light.students, `+${light.new7} in the last 7 days`, "/admin?tab=students")}
        {card("With active access", light.subscribed, light.students ? `${Math.round((light.subscribed / light.students) * 100)}% of students` : "", "/admin?tab=students&status=active")}
        {card("Active in 24 hours", act.activeToday, `${act.activeWeek} different students in the last 7 days`)}
        {card("Revenue this month", money(light.revenue_month), `Last month: ${money(light.revenue_last)} · full report`, "/admin/revenue")}
        {card("Waiting for approval", light.pending, light.pending ? "Open the requests" : "All clear", "/admin?tab=requests", light.pending ? "text-warn" : "")}
        {card("Open reports", light.reports, light.reports ? "Questions students flagged" : "All clear", "/admin?tab=reports", light.reports ? "text-warn" : "")}
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <div className="mb-4 flex items-center justify-between"><h2 className="text-lg font-semibold">Answers per day</h2><span className="chip">{days.reduce((a, d) => a + d.count, 0)} in 14 days</span></div>
          <ActivityChart data={days} />
        </div>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Access ending in the next 7 days</h2>
          {light.expiring.length === 0 ? <p className="text-sm text-muted">Nobody's access ends this week.</p> : (
            <ul className="divide-y divide-line text-sm">
              {light.expiring.map((e, i) => (
                <li key={i}><Link href={`/admin/students/${e.user_id}`} className="flex items-center justify-between gap-3 py-2 hover:text-brand">
                  <span className="min-w-0 truncate">{e.name} <span className="text-muted">· {e.subject}</span></span><span className="shrink-0 text-xs text-warn">{day(e.expires_at)}</span></Link></li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Subjects</h2>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th className="pb-2 font-medium">Subject</th><th className="pb-2 font-medium">Active students</th><th className="pb-2 font-medium">Pending</th></tr></thead>
            <tbody className="divide-y divide-line">{light.perSubject.map((s) => (
              <tr key={s.name}><td className="py-2">{s.name}{s.is_free && <span className="chip ml-2">Free</span>}</td><td className="py-2">{s.active}</td><td className="py-2">{s.pending}</td></tr>))}</tbody></table>
        </div>
        <div className="card">
          <h2 className="mb-3 text-lg font-semibold">Revenue by month</h2>
          {act.months.length === 0 ? <p className="text-sm text-muted">No paid approvals yet.</p> : (
            <ul className="divide-y divide-line text-sm">{[...act.months].reverse().map((m) => (
              <li key={m.m} className="flex items-center justify-between py-2"><span>{m.m}</span><span><b>{money(m.total)}</b> <span className="text-xs text-muted">· {m.n} subscription{m.n === 1 ? "" : "s"}</span></span></li>))}</ul>
          )}
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold">Questions students miss most</h2>
        <p className="mb-3 text-xs text-muted">Last 14 days, questions with at least 15 answers. Check the answer key and the explanation of the lowest ones.</p>
        {act.missed.length === 0 ? <p className="text-sm text-muted">Not enough answers yet.</p> : (
          <ul className="divide-y divide-line text-sm">{act.missed.map((m) => (
            <li key={m.id}><Link href={`/admin/content/${m.topic_id}`} className="flex items-center gap-3 py-2 hover:text-brand"><span className="min-w-0 flex-1 truncate">{m.text}</span>
              <span className="chip shrink-0 !text-bad">{m.pct}% correct</span><span className="shrink-0 text-xs text-muted">{m.n} answers</span></Link></li>))}</ul>
        )}
      </div>
      <p className="text-center text-xs text-muted">Counts update every minute; activity and revenue every 10 minutes (last: {ago(act.at)}). Kept light on purpose so the dashboard never slows the site.</p>
    </section>
  );
}

async function Reports({ all }: { all: boolean }) {
  const list = await db.select({ id: reportedQuestions.id, reason: reportedQuestions.reason, at: reportedQuestions.createdAt, resolved: reportedQuestions.resolvedAt, text: questions.questionText,
    topic: topics.name, chapter: chapters.name, who: users.name, email: users.email })
    .from(reportedQuestions).innerJoin(questions, eq(reportedQuestions.questionId, questions.id)).innerJoin(topics, eq(questions.topicId, topics.id))
    .innerJoin(chapters, eq(topics.chapterId, chapters.id)).innerJoin(users, eq(reportedQuestions.userId, users.id))
    .where(all ? undefined : isNull(reportedQuestions.resolvedAt)).orderBy(desc(reportedQuestions.createdAt)).limit(100);
  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between"><h2 className="text-xl font-semibold">{all ? "All reports" : "Open reports"}</h2>
        <Link className="text-sm text-brand" href={`/admin?tab=reports${all ? "" : "&all=1"}`}>{all ? "Only open" : "Show resolved"}</Link></div>
      {list.length === 0 && <EmptyState icon={<CircleCheck className="h-6 w-6" />} title="No reports" text="Questions students flag as wrong or unclear show up here." />}
      {list.map((r) => (
        <div key={r.id} className="card space-y-2" data-testid="report-row">
          <div className="text-xs text-muted">{r.chapter} · {r.topic} · reported by {r.who} ({r.email}) · {when(r.at)}{r.resolved ? " · resolved" : ""}</div>
          <p className="text-sm">{r.text}</p>
          <p className="rounded-xl bg-raised p-3 text-sm"><b>Reason:</b> {r.reason}</p>
          <div className="flex gap-2">
            {!r.resolved && <form action={resolveReport}><input type="hidden" name="id" value={r.id} /><button className="btn !py-1.5 text-xs"><Check className="h-3.5 w-3.5" />Mark resolved</button></form>}
            <form action={deleteReport}><input type="hidden" name="id" value={r.id} /><ConfirmButton title="Delete this report?" confirmLabel="Delete" message="The report will be removed permanently." className="btn-ghost !py-1.5 text-xs"><Trash2 className="h-3.5 w-3.5" />Delete</ConfirmButton></form>
          </div>
        </div>
      ))}
    </section>
  );
}

async function SettingsTab() {
  const [cfg, subs] = await Promise.all([getSettings(), db.select().from(subjects).orderBy(asc(subjects.order))]);
  const field = (k: keyof typeof cfg, label: string, ph = "") => (
    <label className="block space-y-1"><span className="text-xs font-medium text-muted">{label}</span><input name={k} defaultValue={cfg[k]} placeholder={ph} className="input" /></label>
  );
  return (
    <form action={saveSettings} className="space-y-6">
      <section className="card space-y-4"><h2 className="text-xl font-semibold">Subjects: price, duration and free access</h2>
        <div className="space-y-3">{subs.map((s) => (
          <div key={s.id} className="grid items-end gap-3 rounded-2xl border border-line p-3 sm:grid-cols-[1fr_8rem_8rem_auto]" data-testid="subject-setting">
            <div className="font-medium">{s.name}</div>
            <label className="block space-y-1"><span className="text-xs font-medium text-muted">Price ({cfg.currency})</span>
              <input type="number" min={0} name={`price_${s.id}`} defaultValue={s.price} className="input !py-2" /></label>
            <label className="block space-y-1"><span className="text-xs font-medium text-muted">Access (months)</span>
              <input type="number" min={1} max={36} name={`months_${s.id}`} defaultValue={s.durationMonths} className="input !py-2" /></label>
            <label className="flex cursor-pointer items-center gap-2 pb-2 text-sm"><input type="checkbox" name={`free_${s.id}`} defaultChecked={s.isFree} className="h-4 w-4 accent-[rgb(var(--brand))]" />Free</label>
          </div>))}</div>
        <p className="text-xs text-muted">Free subjects: students tap "Enroll for free" and get access instantly for the chosen months, with no approval. Paid subjects need a price above 0.</p></section>
      <section className="card space-y-4"><h2 className="text-xl font-semibold">Payment details</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          {field("bank_name", "Bank name")}{field("account_name", "Account holder name")}{field("account_number", "Account number / IBAN")}
          {field("whatsapp", "WhatsApp number (with country code)", "218912345678")}{field("currency", "Currency", "LYD")}{field("payment_note", "Extra note shown to students")}
        </div></section>
      <section className="card space-y-1 text-sm"><h2 className="text-xl font-semibold">Email sending</h2>
        {mailProvider() === "none"
          ? <p className="text-warn">Not configured. Email verification and password reset are OFF (new accounts are verified automatically). Add SMTP_URL or RESEND_API_KEY in Vercel to turn them on.</p>
          : <p className="text-good">Configured ({mailProvider()}). New accounts must verify their email, and password reset works.</p>}</section>
      <button className="btn">Save settings</button>
    </form>
  );
}
