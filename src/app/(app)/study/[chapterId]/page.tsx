import { notFound } from "next/navigation";
import Link from "next/link";
import { asc, eq, inArray } from "drizzle-orm";
import { db, chapters, subjects, topics, questions, answerChoices } from "@/db";
import { getUser } from "@/lib/auth";
import { latestAnswers } from "@/lib/stats";
import StudyClient, { type StudyQuestion } from "./StudyClient";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const user = (await getUser())!;

  const [ch] = await db.select({ id: chapters.id, name: chapters.name, subject: subjects.name })
    .from(chapters).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(eq(chapters.id, chapterId)).limit(1);
  if (!ch) notFound();

  const rows = await db.select({ q: questions, topic: topics.name, torder: topics.order })
    .from(questions).innerJoin(topics, eq(questions.topicId, topics.id))
    .where(eq(topics.chapterId, chapterId)).orderBy(asc(topics.order), asc(questions.order));
  const ids = rows.map((r) => r.q.id);
  const choices = ids.length ? await db.select().from(answerChoices).where(inArray(answerChoices.questionId, ids)).orderBy(asc(answerChoices.label)) : [];
  const latest = await latestAnswers(user.id);

  const data: StudyQuestion[] = rows.map((r) => {
    const cs = choices.filter((c) => c.questionId === r.q.id);
    const prev = latest.get(r.q.id);
    return {
      id: r.q.id, topic: r.topic, text: r.q.questionText, difficulty: r.q.difficulty,
      choices: cs.map((c) => ({ id: c.id, label: c.label, text: c.text })),
      // Only reveal answers for questions the student has already attempted.
      previous: prev ? {
        choiceId: prev.choiceId!, isCorrect: prev.isCorrect,
        correctChoiceId: cs.find((c) => c.isCorrect)!.id, explanation: r.q.explanation,
      } : null,
    };
  });
  const startAt = Math.max(0, data.findIndex((q) => !q.previous));

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between text-sm text-slate-500">
        <span>{ch.subject} · {ch.name}</span>
        <Link href="/subjects" className="hover:text-slate-900">← All chapters</Link>
      </div>
      {data.length === 0 ? <p>This chapter has no questions yet.</p> : <StudyClient questions={data} startAt={startAt === -1 ? 0 : startAt} />}
    </div>
  );
}
