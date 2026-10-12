import { redirect } from "next/navigation";
import { desc } from "drizzle-orm";
import { Eye, EyeOff, Megaphone, Plus, Trash2 } from "lucide-react";
import { db, announcements } from "@/db";
import { getUser } from "@/lib/auth";
import AdminTabs from "../../AdminTabs";
import ConfirmButton from "@/components/ConfirmButton";
import { saveAnnouncement, toggleAnnouncement, deleteAnnouncement } from "../../../actions-announcements";

export const dynamic = "force-dynamic";
const TZ = process.env.APP_TZ ?? "Africa/Tripoli";
const LEVELS = [["info", "Information"], ["warning", "Important"], ["urgent", "Urgent (cannot be dismissed)"]] as const;
const dateOnly = (d: Date | null) => (d ? d.toLocaleDateString("en-CA", { timeZone: TZ }) : "");

function Form({ a }: { a?: { id: string; message: string; level: string; expiresAt: Date | null } }) {
  return (
    <form action={saveAnnouncement} className="space-y-3">
      {a && <input type="hidden" name="id" value={a.id} />}
      <textarea name="message" rows={3} className="input" dir="auto" maxLength={600} required defaultValue={a?.message} placeholder="Write the message every student will see, e.g. Pathology mid-term is on 20 Oct. New chapters were added." />
      <div className="flex flex-wrap items-center gap-3">
        <select name="level" defaultValue={a?.level ?? "info"} className="input !w-auto !py-2">{LEVELS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}</select>
        <label className="flex items-center gap-2 text-sm text-muted">Hide after <input type="date" name="expires" defaultValue={dateOnly(a?.expiresAt ?? null)} className="input !w-auto !py-2" /></label>
        <button className="btn !py-2">{a ? "Save changes" : <><Plus className="h-4 w-4" />Publish</>}</button>
      </div>
    </form>
  );
}

export default async function AdminAnnouncements({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const sp = await searchParams;
  const list = await db.select().from(announcements).orderBy(desc(announcements.createdAt)).limit(100);
  const now = Date.now();
  return (
    <div className="space-y-6">
      <AdminTabs active="announcements" />
      <p className="max-w-2xl text-sm text-muted">Messages appear at the top of every student page. Students can close normal and important messages; urgent ones stay until you hide them. Up to 3 live messages are shown, newest first.</p>
      {sp.error && <div className="card !border-bad/40 text-sm text-bad" role="alert">{sp.error}</div>}
      {sp.saved && <div className="card !border-good/40 text-sm text-good">Saved. Students see it within a few seconds.</div>}

      <section className="card space-y-3"><h3 className="text-lg font-semibold">New announcement</h3><Form /></section>

      <h3 className="text-lg font-semibold">All announcements ({list.length})</h3>
      {list.length === 0 && <p className="text-sm text-muted">Nothing yet.</p>}
      {list.map((a) => {
        const expired = !!a.expiresAt && a.expiresAt.getTime() < now;
        const live = a.active && !expired;
        return (
          <details key={a.id} className="card !p-0" data-testid="announcement-row">
            <summary className="flex cursor-pointer items-start gap-3 p-4">
              <Megaphone className="mt-0.5 h-4 w-4 shrink-0 text-brand" />
              <span dir="auto" className="flex-1 whitespace-pre-line text-sm">{a.message}</span>
              <span className={`chip shrink-0 ${live ? "!bg-good/15 !text-good" : ""}`}>{live ? "Live" : expired ? "Expired" : "Hidden"}</span>
            </summary>
            <div className="space-y-4 border-t border-line p-4">
              <Form a={{ id: a.id, message: a.message, level: a.level, expiresAt: a.expiresAt }} />
              <div className="flex flex-wrap gap-2">
                <form action={toggleAnnouncement}><input type="hidden" name="id" value={a.id} />
                  <button className="btn-ghost !py-1.5 text-xs">{a.active ? <><EyeOff className="h-3.5 w-3.5" />Hide</> : <><Eye className="h-3.5 w-3.5" />Show again</>}</button></form>
                <form action={deleteAnnouncement}><input type="hidden" name="id" value={a.id} />
                  <ConfirmButton message="Delete this announcement?" className="btn-ghost !py-1.5 text-xs !text-bad"><Trash2 className="h-3.5 w-3.5" />Delete</ConfirmButton></form>
              </div>
            </div>
          </details>
        );
      })}
    </div>
  );
}
