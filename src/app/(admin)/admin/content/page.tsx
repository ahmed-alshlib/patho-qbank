import Link from "next/link";
import { redirect } from "next/navigation";
import { asc, sql } from "drizzle-orm";
import { Pencil, Plus, Search, ShieldCheck, Trash2, Upload } from "lucide-react";
import { db, subjects, chapters, topics } from "@/db";
import { getUser } from "@/lib/auth";
import AdminTabs from "../../AdminTabs";
import ConfirmButton from "@/components/ConfirmButton";
import Collapsible from "@/components/Collapsible";
import Popover from "@/components/Popover";
import ImportForm from "@/components/ImportForm";
import { saveSubject, deleteSubject, saveChapter, deleteChapter, saveTopic, deleteTopic, importJson } from "../../../actions-content";

export const dynamic = "force-dynamic";
const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);
const sample = `{
  "subject": "Patho 1",
  "chapter": "Cell Injury and Adaptation",
  "description": "Optional short description",
  "topics": [
    { "name": "Necrosis and apoptosis", "questions": [
      { "text": "Question text?",
        "choices": ["Choice A", "Choice B", "Choice C", "Choice D", "Choice E"],
        "correct": "C",
        "explanation": "In short, the answer.\\n\\nWhy it is right.\\n\\nExam tip: a short memory hook.",
        "why": ["Why A is wrong", "Why B is wrong", "", "Why D is wrong", "Why E is wrong"],
        "tags": "Final 01/2026" }
    ]}
  ]
}`;

const small = "input !py-1.5 text-sm";

function Edit({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <Popover label={label} triggerClass="grid h-8 w-8 place-items-center rounded-lg text-muted transition hover:bg-raised hover:text-ink" trigger={<Pencil className="h-3.5 w-3.5" />}>{children}</Popover>
  );
}

export default async function Content({ searchParams }: { searchParams: Promise<{ imported?: string; skipped?: string; merged?: string; groups?: string; explained?: string; importError?: string; q?: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const sp = await searchParams;
  const q = (sp.q ?? "").trim().toLowerCase();
  const [subs, chs, tps] = await Promise.all([
    db.select().from(subjects).orderBy(asc(subjects.order), asc(subjects.name)),
    db.select().from(chapters).orderBy(asc(chapters.order), asc(chapters.name)),
    db.select().from(topics).orderBy(asc(topics.order), asc(topics.name)),
  ]);
  const qn = new Map(rows<{ topic_id: string; n: number }>(await db.execute(sql`select topic_id, count(*)::int n from questions group by topic_id`)).map((r) => [r.topic_id, r.n]));
  const topicsOf = (cid: string) => tps.filter((t) => t.chapterId === cid);
  const countQ = (cid: string) => topicsOf(cid).reduce((a, t) => a + (qn.get(t.id) ?? 0), 0);
  const totalQ = [...qn.values()].reduce((a, b) => a + b, 0);
  const hit = (txt: string) => !q || txt.toLowerCase().includes(q);

  const Stat = ({ n, l }: { n: number; l: string }) => <div className="card !p-4"><div className="font-display text-2xl font-semibold">{n}</div><div className="text-xs text-muted">{l}</div></div>;

  return (
    <div className="space-y-6">
      <AdminTabs active="content" />

      {sp.imported && <div className="card !border-good/40 text-sm text-good">Imported {sp.imported} new question(s){Number(sp.merged) ? `, added new exam tags to ${sp.merged} existing question(s)` : ""}{Number(sp.skipped) ? `, ${sp.skipped} already existed with the same tags` : ""}{Number(sp.groups) ? `, in ${sp.groups} new block(s)` : ""}{Number(sp.explained) ? `, added "why" lines to ${sp.explained} existing question(s)` : ""}.</div>}
      {sp.importError && <div className="card !border-bad/40 text-sm text-bad" role="alert">Import failed: {sp.importError}</div>}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4"><Stat n={subs.length} l="Subjects" /><Stat n={chs.length} l="Chapters" /><Stat n={tps.length} l="Topics" /><Stat n={totalQ} l="Questions" /></div>

      <div className="flex flex-wrap items-center gap-2">
        <form className="relative min-w-52 flex-1"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input name="q" defaultValue={sp.q} placeholder="Search subjects, chapters, topics" className="input !pl-9" aria-label="Search content" /></form>
        <Popover label="New subject" triggerClass="btn" trigger={<><Plus className="h-4 w-4" />New subject</>}>
          <form action={saveSubject} className="space-y-3">
            <input className={small} name="name" placeholder="Subject name, e.g. Anatomy" required />
            <input className={small} name="order" type="number" min={0} placeholder="Order (0, 1, 2…)" />
            <button className="btn w-full !py-2">Add subject</button><p className="text-xs text-muted">Set its price, free option and duration in Settings after adding.</p></form>
        </Popover>
        <Popover label="Import JSON" width={560} triggerClass="btn-ghost" trigger={<><Upload className="h-4 w-4" />Import JSON</>}>
          <ImportForm sample={sample} tree={subs.map((s) => ({ name: s.name, chapters: chs.filter((c) => c.subjectId === s.id).map((c) => ({ name: c.name, topics: topicsOf(c.id).map((t) => t.name) })) }))} />
        </Popover>
      </div>

      {subs.length === 0 && <div className="card text-sm text-muted">No subjects yet. Use "New subject" to start.</div>}

      <div className="space-y-3">
        {subs.map((s) => {
          const sc = chs.filter((c) => c.subjectId === s.id);
          const visible = sc.filter((c) => !q || hit(s.name) || hit(c.name) || topicsOf(c.id).some((t) => hit(t.name)));
          if (q && !visible.length && !hit(s.name)) return null;
          const sTopics = sc.reduce((a, c) => a + topicsOf(c.id).length, 0), sQ = sc.reduce((a, c) => a + countQ(c.id), 0);
          return (
            <Collapsible key={s.id} defaultOpen={!!q} className="card !p-0" testId="subject-block" title={s.name}
              meta={`${sc.length} chapters · ${sTopics} topics · ${sQ} questions${s.isFree ? ` · Free · ${s.durationMonths} mo` : s.price ? ` · ${s.price} LYD · ${s.durationMonths} mo` : " · no price yet"}`}
              action={(
                  <Edit label="Edit subject">
                    <form action={saveSubject} className="space-y-2"><input type="hidden" name="id" value={s.id} />
                      <label className="block text-xs text-muted">Name<input className={small} name="name" defaultValue={s.name} required /></label>
                      <label className="block text-xs text-muted">Order<input className={small} name="order" type="number" min={0} defaultValue={s.order} /></label>
                      <button className="btn w-full !py-2">Save</button></form>
                    <form action={deleteSubject}><input type="hidden" name="id" value={s.id} />
                      <ConfirmButton message={`Delete the subject "${s.name}" with ALL its chapters, topics, questions and student answers? This cannot be undone.`} className="btn-ghost w-full !py-2 text-xs !text-bad"><Trash2 className="h-3.5 w-3.5" />Delete subject</ConfirmButton></form>
                  </Edit>
              )}>
              <div className="space-y-2 border-t border-line p-3 sm:p-4">
                {visible.map((c) => (
                  <Collapsible key={c.id} defaultOpen={!!q} size="md" className="rounded-2xl border border-line" title={c.name}
                    meta={`${topicsOf(c.id).length} topics · ${countQ(c.id)} questions`}
                    action={(
                        <Edit label="Edit chapter">
                          <form action={saveChapter} className="space-y-2"><input type="hidden" name="id" value={c.id} />
                            <label className="block text-xs text-muted">Name<input className={small} name="name" defaultValue={c.name} required /></label>
                            <label className="block text-xs text-muted">Description<input className={small} name="description" defaultValue={c.description} /></label>
                            <label className="block text-xs text-muted">Order<input className={small} name="order" type="number" min={0} defaultValue={c.order} /></label>
                            <button className="btn w-full !py-2">Save</button></form>
                          <form action={deleteChapter}><input type="hidden" name="id" value={c.id} />
                            <ConfirmButton message={`Delete the chapter "${c.name}" with all its topics and questions?`} className="btn-ghost w-full !py-2 text-xs !text-bad"><Trash2 className="h-3.5 w-3.5" />Delete chapter</ConfirmButton></form>
                        </Edit>
                    )}>
                    <div className="divide-y divide-line border-t border-line">
                      {topicsOf(c.id).filter((t) => !q || hit(t.name) || hit(c.name) || hit(s.name)).map((t) => (
                        <div key={t.id} className="flex items-center gap-2 px-3 py-2">
                          <Link href={`/admin/content/${t.id}`} className="min-w-0 flex-1 truncate text-sm hover:text-brand">{t.name}</Link>
                          <Link href={`/admin/content/${t.id}`} className="chip">{qn.get(t.id) ?? 0} questions</Link>
                          <Edit label="Edit topic">
                            <form action={saveTopic} className="space-y-2"><input type="hidden" name="id" value={t.id} />
                              <label className="block text-xs text-muted">Name<input className={small} name="name" defaultValue={t.name} required /></label>
                              <label className="block text-xs text-muted">Order<input className={small} name="order" type="number" min={0} defaultValue={t.order} /></label>
                              <button className="btn w-full !py-2">Save</button></form>
                            <form action={deleteTopic}><input type="hidden" name="id" value={t.id} />
                              <ConfirmButton message={`Delete the topic "${t.name}" with its questions?`} className="btn-ghost w-full !py-2 text-xs !text-bad"><Trash2 className="h-3.5 w-3.5" />Delete topic</ConfirmButton></form>
                          </Edit>
                        </div>
                      ))}
                      <form action={saveTopic} className="flex gap-2 p-3"><input type="hidden" name="chapterId" value={c.id} />
                        <input className={`${small} flex-1`} name="name" placeholder="New topic name" required /><button className="btn-ghost !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" />Topic</button></form>
                    </div>
                  </Collapsible>
                ))}
                {!q && (
                  <form action={saveChapter} className="flex gap-2 pt-1"><input type="hidden" name="subjectId" value={s.id} />
                    <input className={`${small} flex-1`} name="name" placeholder="New chapter name" required /><button className="btn-ghost !py-1.5 text-xs"><Plus className="h-3.5 w-3.5" />Chapter</button></form>
                )}
              </div>
            </Collapsible>
          );
        })}
      </div>
    </div>
  );
}
