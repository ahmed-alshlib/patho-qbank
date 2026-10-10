import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, desc, eq, sql } from "drizzle-orm";
import { ArrowLeft, Check, KeyRound, LogOut, Monitor, X } from "lucide-react";
import { db, subjects, subscriptions, users } from "@/db";
import { getUser } from "@/lib/auth";
import { latestCte, TZ } from "@/lib/stats";
import { approveSubscription, rejectSubscription, revokeSubscription, grantSubscription, setStudentPassword, signOutDevices } from "../../../../actions-admin";
import ConfirmButton from "@/components/ConfirmButton";
import AdminTabs from "../../../AdminTabs";

export const dynamic = "force-dynamic";
const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);
const day = (d: Date | string | null) => (d ? new Date(d).toLocaleDateString("en", { timeZone: TZ, day: "numeric", month: "short", year: "numeric" }) : "–");
const when = (d: Date | string | null) => (d ? new Date(d).toLocaleString("en", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" }) : "–");

const BADGE: Record<string, string> = { active: "!bg-good/15 !text-good", pending: "!bg-warn/15 !text-warn", rejected: "!text-bad", revoked: "!text-bad" };

export default async function StudentDetail({ params }: { params: Promise<{ id: string }> }) {
  const me = await getUser();
  if (!me?.isAdmin) redirect("/");
  const { id } = await params;
  const [u] = await db.select().from(users).where(eq(users.id, id)).limit(1);
  if (!u || u.isAdmin) notFound();

  const [subs, subjectList] = await Promise.all([
    db.select({ id: subscriptions.id, subject: subjects.name, status: subscriptions.status, reference: subscriptions.reference, price: subscriptions.price,
      createdAt: subscriptions.createdAt, approvedAt: subscriptions.approvedAt, expiresAt: subscriptions.expiresAt })
      .from(subscriptions).innerJoin(subjects, eq(subscriptions.subjectId, subjects.id)).where(eq(subscriptions.userId, id)).orderBy(desc(subscriptions.createdAt)),
    db.select().from(subjects).orderBy(asc(subjects.order)),
  ]);
  const [tot] = rows<{ attempts: number; first: string | null; last: string | null }>(await db.execute(sql`
    select count(*)::int as attempts, min(answered_at) as first, max(answered_at) as last from user_answers where user_id = ${id}`));
  const [acc] = rows<{ done: number; correct: number }>(await db.execute(sql`
    select count(*)::int as done, (count(*) filter (where is_correct))::int as correct from ${latestCte(id)} la`));
  const perSubject = rows<{ name: string; done: number; correct: number }>(await db.execute(sql`
    select s.name, count(*)::int as done, (count(*) filter (where la.is_correct))::int as correct
    from ${latestCte(id)} la join questions q on q.id = la.question_id join topics t on t.id = q.topic_id
    join chapters c on c.id = t.chapter_id join subjects s on s.id = c.subject_id group by s.id order by s."order"`));
  const devices = rows<{ id: string; device: string; created_at: string }>(await db.execute(sql`select id, device, created_at from user_sessions where user_id = ${id} order by created_at desc`));
  const now = Date.now();
  const stat = (label: string, value: string | number, sub = "") => <div className="card !p-4"><div className="eyebrow">{label}</div><div className="mt-1 font-display text-2xl font-semibold">{value}</div>{sub && <div className="text-xs text-muted">{sub}</div>}</div>;

  return (
    <div className="space-y-6" data-testid="student-detail">
      <div><p className="eyebrow">Admin</p><h1 className="mt-1 text-4xl font-semibold">{u.name}</h1>
        <p className="mt-1 text-sm text-muted">{u.email} · joined {day(u.createdAt)} · {u.emailVerifiedAt ? "email verified" : <span className="text-warn">email not verified</span>}</p></div>
      <AdminTabs active="students" />
      <Link href="/admin?tab=students" className="inline-flex items-center gap-1 text-sm text-brand"><ArrowLeft className="h-4 w-4" />All students</Link>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {stat("Questions answered", acc?.done ?? 0, `${tot.attempts} attempts in total`)}
        {stat("Accuracy", acc?.done ? `${Math.round((acc.correct / acc.done) * 100)}%` : "–", "latest answer per question")}
        {stat("Last active", tot.last ? when(tot.last) : "Never")}
        {stat("Daily goal", u.dailyGoal, "questions a day")}
      </div>

      <section className="card space-y-3">
        <h2 className="text-lg font-semibold">Subscription history</h2>
        {subs.length === 0 ? <p className="text-sm text-muted">No subscriptions or requests yet.</p> : (
          <div className="overflow-x-auto"><table className="w-full min-w-[34rem] text-sm" data-testid="sub-history">
            <thead><tr className="text-left text-xs text-muted"><th className="pb-2 font-medium">Subject</th><th className="pb-2 font-medium">Status</th><th className="pb-2 font-medium">Requested</th><th className="pb-2 font-medium">Approved</th><th className="pb-2 font-medium">Ends</th><th className="pb-2 font-medium">Paid</th><th /></tr></thead>
            <tbody className="divide-y divide-line">{subs.map((s) => {
              const ended = s.status === "active" && s.expiresAt && s.expiresAt.getTime() <= now;
              return (
                <tr key={s.id}>
                  <td className="py-2 font-medium">{s.subject}</td>
                  <td className="py-2"><span className={`chip ${ended ? "" : BADGE[s.status] ?? ""}`}>{ended ? "expired" : s.status}</span></td>
                  <td className="py-2 text-muted">{day(s.createdAt)}</td><td className="py-2 text-muted">{day(s.approvedAt)}</td><td className="py-2 text-muted">{day(s.expiresAt)}</td>
                  <td className="py-2 text-muted">{s.price ? s.price : s.reference === "FREE" ? "free" : s.reference === "ADMIN" ? "granted" : "–"}</td>
                  <td className="py-2 text-right">
                    {s.status === "pending" && <span className="inline-flex gap-1">
                      <form action={approveSubscription}><input type="hidden" name="id" value={s.id} /><ConfirmButton tone="brand" title="Approve this request?" confirmLabel="Approve" message={`Confirm you received the payment for ${s.subject}.`} className="btn !py-1 text-xs"><Check className="h-3 w-3" />Approve</ConfirmButton></form>
                      <form action={rejectSubscription}><input type="hidden" name="id" value={s.id} /><ConfirmButton title="Decline this request?" confirmLabel="Decline" message={`Decline the request for ${s.subject}?`} className="btn-ghost !py-1 text-xs"><X className="h-3 w-3" />Decline</ConfirmButton></form></span>}
                    {s.status === "active" && !ended && <form action={revokeSubscription}><input type="hidden" name="id" value={s.id} /><ConfirmButton title="Revoke access?" confirmLabel="Revoke" message={`${u.name} will lose access to ${s.subject} immediately.`} className="btn-ghost !py-1 text-xs">Revoke</ConfirmButton></form>}
                  </td>
                </tr>);
            })}</tbody></table></div>
        )}
        <form action={grantSubscription} className="flex flex-wrap gap-2 border-t border-line pt-3"><input type="hidden" name="userId" value={u.id} />
          <select name="subjectId" className="input !w-52 !py-2">{subjectList.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.durationMonths} mo)</option>)}</select>
          <ConfirmButton tone="brand" title="Give access?" confirmLabel="Grant access" message={`Give ${u.name} access to the selected subject for its full duration, without payment?`} className="btn-ghost !py-2 text-xs">Grant access</ConfirmButton></form>
      </section>

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="card space-y-3">
          <h2 className="text-lg font-semibold">Progress by subject</h2>
          {perSubject.length === 0 ? <p className="text-sm text-muted">No answers yet.</p> : (
            <ul className="divide-y divide-line text-sm">{perSubject.map((s) => (
              <li key={s.name} className="flex items-center justify-between py-2"><span>{s.name}</span><span className="text-muted">{s.done} answered · <b className="text-ink">{Math.round((s.correct / s.done) * 100)}%</b> correct</span></li>))}</ul>
          )}
          <p className="text-xs text-muted">First answer: {tot.first ? day(tot.first) : "–"}</p>
        </section>

        <section className="card space-y-3">
          <h2 className="flex items-center gap-2 text-lg font-semibold"><Monitor className="h-4 w-4" />Signed-in devices <span className="text-sm font-normal text-muted">(max 2)</span></h2>
          {devices.length === 0 ? <p className="text-sm text-muted">Not signed in anywhere.</p> : (
            <ul className="divide-y divide-line text-sm" data-testid="devices">{devices.map((d) => <li key={d.id} className="flex justify-between py-2"><span>{d.device || "Unknown device"}</span><span className="text-xs text-muted">since {when(d.created_at)}</span></li>)}</ul>
          )}
          <form action={signOutDevices}><input type="hidden" name="userId" value={u.id} />
            <ConfirmButton title="Sign out everywhere?" confirmLabel="Sign out" message={`${u.name} will be signed out on all devices and must log in again.`} className="btn-ghost !py-2 text-xs"><LogOut className="h-3.5 w-3.5" />Sign out all devices</ConfirmButton></form>
          <div className="border-t border-line pt-3">
            <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold"><KeyRound className="h-4 w-4" />Set a new password</h3>
            <form action={setStudentPassword} className="flex gap-2"><input type="hidden" name="userId" value={u.id} />
              <input name="password" type="text" minLength={8} required placeholder="New password (8+ characters)" className="input !py-2" autoComplete="off" />
              <button className="btn-ghost !py-2 text-xs">Save</button></form>
            <p className="mt-1 text-xs text-muted">This also signs the student out on all devices.</p>
          </div>
        </section>
      </div>
    </div>
  );
}
