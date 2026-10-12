import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, eq } from "drizzle-orm";
import { FileText, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { db, subjects, chapters, summaries } from "@/db";
import { getUser } from "@/lib/auth";
import AdminTabs from "../../AdminTabs";
import ConfirmButton from "@/components/ConfirmButton";
import { saveSummary, deleteSummary } from "../../../actions-summaries";

export const dynamic = "force-dynamic";

const HINT = "Formatting: # Big heading, ## Heading, - bullet, 1. numbered, > note box, **bold**, ==highlight==. Leave a blank line between paragraphs.";

function SummaryForm({ subjectId, chapterId, s }: { subjectId: string; chapterId: string; s?: { id: string; title: string; body: string } }) {
  return (
    <form action={saveSummary} className="space-y-3">
      <input type="hidden" name="subjectId" value={subjectId} /><input type="hidden" name="chapterId" value={chapterId} />
      {s && <input type="hidden" name="id" value={s.id} />}
      <input name="title" className="input" placeholder="Title, e.g. Cell injury: key points" defaultValue={s?.title} required maxLength={200} />
      <textarea name="body" rows={s ? 14 : 10} className="input font-mono text-sm leading-6" placeholder="Write or paste the summary here" defaultValue={s?.body} dir="auto" />
      <p className="text-xs text-muted">{HINT}</p>
      <button className="btn !py-2">{s ? "Save changes" : <><Plus className="h-4 w-4" />Add summary</>}</button>
    </form>
  );
}

export default async function AdminSummaries({ searchParams }: { searchParams: Promise<{ subject?: string; chapter?: string; saved?: string; error?: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const sp = await searchParams;
  const subs = await db.select().from(subjects).orderBy(asc(subjects.order), asc(subjects.name));
  const subject = subs.find((s) => s.id === sp.subject) ?? null;
  const chaps = subject ? await db.select().from(chapters).where(eq(chapters.subjectId, subject.id)).orderBy(asc(chapters.order), asc(chapters.name)) : [];
  const chapter = chaps.find((c) => c.id === sp.chapter) ?? null;
  const list = chapter ? await db.select().from(summaries).where(eq(summaries.chapterId, chapter.id)).orderBy(asc(summaries.order), asc(summaries.createdAt)) : [];
  const chip = (on: boolean) => `rounded-full border px-4 py-2 text-sm font-medium transition ${on ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`;

  return (
    <div className="space-y-6">
      <AdminTabs active="summaries" />

      {sp.error && <div className="card !border-bad/40 text-sm text-bad" role="alert">{sp.error}</div>}
      {sp.saved && <div className="card !border-good/40 text-sm text-good">Saved.</div>}

      <section className="card space-y-4">
        <div>
          <h2 className="mb-2 text-sm font-semibold text-muted">1. Subject</h2>
          <div className="flex flex-wrap gap-2">
            {subs.length === 0 && <p className="text-sm text-muted">Create a subject first in Content.</p>}
            {subs.map((s) => <Link key={s.id} href={`/admin/summaries?subject=${s.id}`} className={chip(subject?.id === s.id)}>{s.name}</Link>)}
          </div>
        </div>
        {subject && (
          <div>
            <h2 className="mb-2 text-sm font-semibold text-muted">2. Chapter</h2>
            <div className="flex flex-wrap gap-2">
              {chaps.length === 0 && <p className="text-sm text-muted">This subject has no chapters yet.</p>}
              {chaps.map((c) => <Link key={c.id} href={`/admin/summaries?subject=${subject.id}&chapter=${c.id}`} className={chip(chapter?.id === c.id)}>{c.name}</Link>)}
            </div>
          </div>
        )}
      </section>

      {subject && chapter && (
        <>
          <section className="card space-y-3"><h3 className="text-lg font-semibold">New summary for {chapter.name}</h3><SummaryForm subjectId={subject.id} chapterId={chapter.id} /></section>
          <h3 className="text-lg font-semibold">{list.length} summar{list.length === 1 ? "y" : "ies"} in {chapter.name}</h3>
          {list.map((s) => (
            <details key={s.id} className="card !p-0" data-testid="summary-row">
              <summary className="flex cursor-pointer items-center gap-3 p-4"><FileText className="h-4 w-4 text-brand" /><span className="flex-1 text-sm font-medium">{s.title}</span><span className="text-xs text-muted">{s.body.length.toLocaleString()} characters</span></summary>
              <div className="space-y-4 border-t border-line p-4">
                <SummaryForm subjectId={subject.id} chapterId={chapter.id} s={{ id: s.id, title: s.title, body: s.body }} />
                <form action={deleteSummary}><input type="hidden" name="id" value={s.id} /><input type="hidden" name="subjectId" value={subject.id} /><input type="hidden" name="chapterId" value={chapter.id} />
                  <ConfirmButton message="Delete this summary?" className="btn-ghost !py-1.5 text-xs !text-bad"><Trash2 className="h-3.5 w-3.5" />Delete summary</ConfirmButton></form>
              </div>
            </details>
          ))}
        </>
      )}
      {subject && !chapter && chaps.length > 0 && <p className="text-sm text-muted">Choose a chapter to add or edit its summaries.</p>}
    </div>
  );
}
