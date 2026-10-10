import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { asc, eq, inArray } from "drizzle-orm";
import { ArrowLeft, Plus, ShieldCheck, Trash2 } from "lucide-react";
import { db, subjects, chapters, topics, questions, answerChoices } from "@/db";
import { getUser } from "@/lib/auth";
import AdminTabs from "../../../AdminTabs";
import ConfirmButton from "@/components/ConfirmButton";
import { LABELS } from "@/lib/import";
import { saveQuestion, deleteQuestion } from "../../../../actions-content";

export const dynamic = "force-dynamic";

type Q = { id: string; text: string; explanation: string; difficulty: string; tags: string; choices: { label: string; text: string; isCorrect: boolean }[] };

function QuestionForm({ topicId, q }: { topicId: string; q?: Q }) {
  return (
    <form action={saveQuestion} className="space-y-3">
      <input type="hidden" name="topicId" value={topicId} />{q && <input type="hidden" name="id" value={q.id} />}
      <textarea name="text" rows={3} className="input" placeholder="Question text" defaultValue={q?.text} required />
      <div className="space-y-2">
        {LABELS.map((l, i) => {
          const c = q?.choices.find((x) => x.label === l);
          return (
            <div key={l} className="flex items-center gap-2">
              <label className="flex shrink-0 items-center gap-2 text-sm font-semibold"><input type="radio" name="correct" value={l} defaultChecked={q ? !!c?.isCorrect : l === "A"} aria-label={`Correct answer is ${l}`} />{l}</label>
              <input name={`choice_${l}`} className="input !py-1.5" placeholder={i < 2 ? `Choice ${l} (required)` : `Choice ${l} (optional)`} defaultValue={c?.text} />
            </div>
          );
        })}
        <p className="text-xs text-muted">Select the radio button next to the correct answer. Leave unused choices empty.</p>
      </div>
      <textarea name="explanation" rows={4} className="input" placeholder="Explanation" defaultValue={q?.explanation} required />
      <div className="flex flex-wrap items-center gap-2">
        <select name="difficulty" defaultValue={q?.difficulty ?? "medium"} className="input !w-36 !py-1.5"><option value="easy">Easy</option><option value="medium">Medium</option><option value="hard">Hard</option></select>
        <input name="tags" className="input !w-56 !py-1.5" placeholder="Tags (comma separated)" defaultValue={q?.tags} />
        <button className="btn !py-2">{q ? "Save changes" : <><Plus className="h-4 w-4" />Add question</>}</button>
      </div>
    </form>
  );
}

export default async function TopicQuestions({ params, searchParams }: { params: Promise<{ topicId: string }>; searchParams: Promise<{ error?: string; saved?: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const { topicId } = await params;
  const sp = await searchParams;
  const [t] = await db.select({ id: topics.id, name: topics.name, chapter: chapters.name, subject: subjects.name }).from(topics)
    .innerJoin(chapters, eq(topics.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(eq(topics.id, topicId)).limit(1);
  if (!t) notFound();
  const qs = await db.select().from(questions).where(eq(questions.topicId, topicId)).orderBy(asc(questions.order));
  const ch = qs.length ? await db.select().from(answerChoices).where(inArray(answerChoices.questionId, qs.map((q) => q.id))).orderBy(asc(answerChoices.label)) : [];
  const list: Q[] = qs.map((q) => ({ id: q.id, text: q.questionText, explanation: q.explanation, difficulty: q.difficulty, tags: q.tags,
    choices: ch.filter((c) => c.questionId === q.id).map((c) => ({ label: c.label, text: c.text, isCorrect: c.isCorrect })) }));

  return (
    <div className="space-y-6">
      <div><p className="eyebrow">Admin</p><h1 className="mt-1 flex items-center gap-3 text-4xl font-semibold"><ShieldCheck className="h-8 w-8 text-brand" />Control panel</h1></div>
      <AdminTabs active="content" />
      <div>
        <Link href="/admin/content" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />All content</Link>
        <h2 className="mt-2 text-2xl font-semibold">{t.name}</h2>
        <p className="text-sm text-muted">{t.subject} · {t.chapter} · {list.length} questions</p>
      </div>
      {sp.error && <div className="card !border-bad/40 text-sm text-bad" role="alert">{sp.error}</div>}
      {sp.saved && <div className="card !border-good/40 text-sm text-good">Saved.</div>}

      <section className="card space-y-3"><h3 className="text-lg font-semibold">Add a question</h3><QuestionForm topicId={topicId} /></section>

      {list.map((q, i) => (
        <details key={q.id} className="card !p-0" data-testid="question-row">
          <summary className="flex cursor-pointer items-start gap-3 p-4">
            <span className="chip shrink-0">#{i + 1}</span><span className="flex-1 text-sm">{q.text}</span><span className="chip shrink-0">{q.difficulty}</span>
          </summary>
          <div className="space-y-4 border-t border-line p-4">
            <QuestionForm topicId={topicId} q={q} />
            <form action={deleteQuestion}><input type="hidden" name="id" value={q.id} /><input type="hidden" name="topicId" value={topicId} />
              <ConfirmButton message="Delete this question and all students' answers to it?" className="btn-ghost !py-1.5 text-xs !text-bad"><Trash2 className="h-3.5 w-3.5" />Delete question</ConfirmButton></form>
          </div>
        </details>
      ))}
    </div>
  );
}
