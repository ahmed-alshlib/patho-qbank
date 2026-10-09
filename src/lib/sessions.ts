import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { db, subjects, chapters, topics, questions, answerChoices, tests, testQuestions } from "@/db";
import { latestCte, TZ } from "@/lib/stats";
import { latestForQuestions } from "@/lib/questions";
import { accessibleSubjectIds } from "@/lib/access";

const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);

export type Tree = { subjects: { id: string; name: string; chapters: { id: string; name: string; topics: { id: string; name: string }[] }[] }[] };
/** counts[topicId][difficulty] = [total, unanswered, incorrect, bookmarked, answered] */
export type Counts = Record<string, Record<string, number[]>>;

export async function getSessionTree(userId: string): Promise<{ tree: Tree; counts: Counts }> {
  const allowed = await accessibleSubjectIds(userId);
  const s = (await db.select().from(subjects).orderBy(asc(subjects.order))).filter((x) => allowed.has(x.id));
  const c = await db.select().from(chapters).orderBy(asc(chapters.order));
  const t = await db.select().from(topics).orderBy(asc(topics.order));
  const tree: Tree = {
    subjects: s.map((sub) => ({
      id: sub.id, name: sub.name,
      chapters: c.filter((ch) => ch.subjectId === sub.id).map((ch) => ({ id: ch.id, name: ch.name, topics: t.filter((tp) => tp.chapterId === ch.id).map((tp) => ({ id: tp.id, name: tp.name })) })),
    })),
  };
  const r = rows<{ topic_id: string; difficulty: string; total: number; unanswered: number; incorrect: number; bookmarked: number; answered: number }>(await db.execute(sql`
    select q.topic_id, q.difficulty, count(*)::int as total,
      (count(*) filter (where la.question_id is null))::int as unanswered,
      (count(*) filter (where la.is_correct = false))::int as incorrect,
      (count(*) filter (where b.id is not null))::int as bookmarked,
      (count(*) filter (where la.question_id is not null))::int as answered
    from questions q
    left join ${latestCte(userId)} la on la.question_id = q.id
    left join bookmarks b on b.question_id = q.id and b.user_id = ${userId}
    group by q.topic_id, q.difficulty`));
  const counts: Counts = {};
  for (const x of r) (counts[x.topic_id] ??= {})[x.difficulty] = [x.total, x.unanswered, x.incorrect, x.bookmarked, x.answered];
  return { tree, counts };
}

export async function getTest(userId: string, testId: string) {
  const [t] = await db.select().from(tests).where(and(eq(tests.id, testId), eq(tests.userId, userId))).limit(1);
  return t ?? null;
}

export async function getTestQuestionIds(testId: string) {
  const r = await db.select({ id: testQuestions.questionId }).from(testQuestions).where(eq(testQuestions.testId, testId)).orderBy(asc(testQuestions.position));
  return r.map((x) => x.id);
}

export type SessionRow = { id: string; mode: string; timed: boolean; timeLimitSec: number | null; startedAt: Date; finishedAt: Date | null; total: number; answered: number; correct: number };

export async function listSessions(userId: string, limit = 100): Promise<SessionRow[]> {
  const r = rows<{ id: string; mode: string; timed: boolean; time_limit_sec: number | null; started_at: string | Date; finished_at: string | Date | null; total: number; answered: number; correct: number }>(await db.execute(sql`
    select t.id, t.mode, t.timed, t.time_limit_sec, t.started_at, t.finished_at,
      (select count(*) from test_questions tq where tq.test_id = t.id)::int as total,
      (select count(*) from (select distinct question_id from user_answers ua where ua.test_id = t.id and ua.user_id = t.user_id) x)::int as answered,
      (select count(*) from (select distinct on (question_id) is_correct from user_answers ua where ua.test_id = t.id and ua.user_id = t.user_id order by question_id, answered_at desc) y where y.is_correct)::int as correct
    from tests t where t.user_id = ${userId}
    order by (t.finished_at is not null), t.started_at desc limit ${limit}`));
  return r.map((x) => ({ id: x.id, mode: x.mode, timed: x.timed, timeLimitSec: x.time_limit_sec, startedAt: new Date(x.started_at), finishedAt: x.finished_at ? new Date(x.finished_at) : null, total: x.total, answered: x.answered, correct: x.correct }));
}

export type ResultItem = {
  id: string; position: number; text: string; explanation: string; difficulty: string;
  subjectId: string; subject: string; chapterId: string; chapter: string; topicId: string; topic: string;
  choices: { id: string; label: string; text: string; isCorrect: boolean }[];
  chosenId: string | null; status: "correct" | "incorrect" | "unanswered";
};

export async function getResults(userId: string, testId: string) {
  const test = await getTest(userId, testId);
  if (!test) return null;
  const r = await db
    .select({ q: questions, position: testQuestions.position, topicId: topics.id, topic: topics.name, chapterId: chapters.id, chapter: chapters.name, subjectId: subjects.id, subject: subjects.name })
    .from(testQuestions)
    .innerJoin(questions, eq(testQuestions.questionId, questions.id))
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(eq(testQuestions.testId, testId)).orderBy(asc(testQuestions.position));
  const ids = r.map((x) => x.q.id);
  const choices = ids.length ? await db.select().from(answerChoices).where(inArray(answerChoices.questionId, ids)).orderBy(asc(answerChoices.label)) : [];
  const latest = await latestForQuestions(userId, ids, testId);

  const items: ResultItem[] = r.map((x) => {
    const a = latest.get(x.q.id);
    return {
      id: x.q.id, position: x.position, text: x.q.questionText, explanation: x.q.explanation, difficulty: x.q.difficulty,
      subjectId: x.subjectId, subject: x.subject, chapterId: x.chapterId, chapter: x.chapter, topicId: x.topicId, topic: x.topic,
      choices: choices.filter((c) => c.questionId === x.q.id).map((c) => ({ id: c.id, label: c.label, text: c.text, isCorrect: c.isCorrect })),
      chosenId: a?.choiceId ?? null, status: !a ? "unanswered" : a.isCorrect ? "correct" : "incorrect",
    };
  });
  return { test, items };
}

export { TZ };
