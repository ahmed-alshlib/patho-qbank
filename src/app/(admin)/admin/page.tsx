import Link from "next/link";
import { redirect } from "next/navigation";
import { and, asc, desc, eq, isNull, sql } from "drizzle-orm";
import { Check, CircleCheck, Flag, Settings as Cog, ShieldCheck, Trash2, Users, Wallet, X } from "lucide-react";
import { db, subjects, subscriptions, users, reportedQuestions, questions, topics, chapters } from "@/db";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { mailProvider } from "@/lib/mail";
import { TZ } from "@/lib/stats";
import { approveSubscription, rejectSubscription, revokeSubscription, grantSubscription, resolveReport, deleteReport, saveSettings, setStudentPassword } from "../../actions-admin";
import { EmptyState } from "@/components/ui";
import ConfirmButton from "@/components/ConfirmButton";
import AdminTabs from "../AdminTabs";

export const dynamic = "force-dynamic";
const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);
const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString("en", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "");
const day = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }) : "");

export default async function Admin({ searchParams }: { searchParams: Promise<{ tab?: string; q?: string; all?: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const { tab = "requests", q = "", all } = await searchParams;

  const [pendingN] = rows<{ n: number }>(await db.execute(sql`select count(*)::int n from subscriptions where status='pending'`));
  const [reportN] = rows<{ n: number }>(await db.execute(sql`select count(*)::int n from reported_questions where resolved_at is null`));
  return (
    <div className="space-y-6">
      <div><p className="eyebrow">Admin</p><h1 className="mt-1 flex items-center gap-3 text-4xl font-semibold"><ShieldCheck className="h-8 w-8 text-brand" />Control panel</h1></div>
      <AdminTabs active={tab} counts={{ requests: pendingN.n, reports: reportN.n }} />

      {tab === "requests" && await Requests({ all: !!all })}
      {tab === "students" && await Students({ q })}
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

async function Students({ q }: { q: string }) {
  const like = `%${q.trim().toLowerCase()}%`;
  const list = rows<{ id: string; name: string; email: string; created_at: string; answers: number; last: string | null }>(await db.execute(sql`
    select u.id, u.name, u.email, u.created_at,
      (select count(*)::int from user_answers a where a.user_id = u.id) as answers,
      (select max(answered_at) from user_answers a where a.user_id = u.id) as last
    from users u where lower(u.name) like ${like} or lower(u.email) like ${like} order by u.created_at desc limit 50`));
  const [total] = rows<{ n: number }>(await db.execute(sql`select count(*)::int n from users`));
  const subsAll = await db.select({ id: subscriptions.id, userId: subscriptions.userId, subject: subjects.name, expiresAt: subscriptions.expiresAt })
    .from(subscriptions).innerJoin(subjects, eq(subscriptions.subjectId, subjects.id))
    .where(and(eq(subscriptions.status, "active"), sql`${subscriptions.expiresAt} > now()`));
  const subs = await db.select().from(subjects).orderBy(asc(subjects.order));
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h2 className="text-xl font-semibold">Students <span className="text-base font-normal text-muted">({total.n} total)</span></h2>
        <form className="flex gap-2"><input type="hidden" name="tab" value="students" /><input name="q" defaultValue={q} placeholder="Search name or email" className="input !w-64" /><button className="btn-ghost">Search</button></form>
      </div>
      {list.map((u) => (
        <div key={u.id} className="card space-y-3" data-testid="student-row">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div><div className="font-semibold">{u.name}</div><div className="text-xs text-muted">{u.email} · joined {day(u.created_at)} · {u.answers} answers{u.last ? ` · last active ${when(u.last)}` : ""}</div></div>
            <form action={grantSubscription} className="flex gap-2"><input type="hidden" name="userId" value={u.id} />
              <select name="subjectId" className="input !w-40 !py-1.5">{subs.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMonths} mo)</option>)}</select>
              <ConfirmButton tone="brand" title="Give access?" confirmLabel="Grant access" message={`Give ${u.name} access to the selected subject for its full duration, without payment?`} className="btn-ghost !py-1.5 text-xs">Grant access</ConfirmButton></form>
          </div>
          <div className="flex flex-wrap gap-2">
            {subsAll.filter((s) => s.userId === u.id).map((s) => (
              <form key={s.id} action={revokeSubscription} className="chip !bg-good/15 !text-good"><input type="hidden" name="id" value={s.id} />
                {s.subject} until {day(s.expiresAt)}<ConfirmButton title="Revoke access?" confirmLabel="Revoke" message={`${u.name} will lose access to ${s.subject} immediately.`} className="ml-1 rounded-full p-0.5 hover:bg-good/20"><X className="h-3 w-3" aria-label={`Revoke ${s.subject}`} /></ConfirmButton></form>
            ))}
            {!subsAll.some((s) => s.userId === u.id) && <span className="text-xs text-muted">No active subjects</span>}
          </div>
          <details className="text-xs">
            <summary className="cursor-pointer text-muted hover:text-ink">Set new password</summary>
            <form action={setStudentPassword} className="mt-2 flex gap-2"><input type="hidden" name="userId" value={u.id} />
              <input name="password" type="text" minLength={8} required placeholder="New password (8+ characters)" className="input !w-64 !py-1.5" autoComplete="off" />
              <button className="btn-ghost !py-1.5 text-xs">Save</button></form>
          </details>
        </div>
      ))}
      {list.length === 0 && <div className="card text-sm text-muted">No students found.</div>}
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
