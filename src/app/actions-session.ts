"use server";
import { and, asc, eq, inArray, isNull } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, answerChoices, bookmarks, chapters, questions, testQuestions, tests, topics, userAnswers } from "@/db";
import { getUser } from "@/lib/auth";
import { latestForQuestions, type Reveal } from "@/lib/questions";
import { peerStats } from "@/lib/peers";
import { accessibleSubjectIds, assertQuestionAccess } from "@/lib/access";

async function me() {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

export type SessionInput = {
  mode: "study" | "exam";
  topicIds: string[];
  count: number;
  pool: "all" | "unanswered" | "incorrect" | "bookmarked" | "answered";
  difficulties: string[];
  randomize: boolean;
  timed: boolean;
  minutes: number;
};

const MAX_QUESTIONS = 200;

function shuffle<T>(a: T[]) {
  for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
  return a;
}

async function insertSession(userId: string, mode: "study" | "exam", questionIds: string[], opts: { timed: boolean; minutes: number; randomize: boolean; filters: object }) {
  const [t] = await db.insert(tests).values({
    userId, mode, timed: mode === "exam" && opts.timed, timeLimitSec: mode === "exam" && opts.timed ? Math.round(opts.minutes * 60) : null,
    randomized: opts.randomize, filters: JSON.stringify(opts.filters),
  }).returning({ id: tests.id });
  await db.insert(testQuestions).values(questionIds.map((questionId, position) => ({ testId: t.id, questionId, position })));
  return t.id;
}

export async function createSession(input: SessionInput): Promise<{ id?: string; error?: string }> {
  const user = await me();
  if (!["study", "exam"].includes(input.mode)) return { error: "Choose study or exam mode." };
  if (!input.topicIds?.length) return { error: "Choose at least one topic." };
  const diffs = (input.difficulties ?? []).filter((d) => ["easy", "medium", "hard"].includes(d));
  if (!diffs.length) return { error: "Choose at least one difficulty." };
  const count = Math.max(1, Math.min(MAX_QUESTIONS, Math.floor(input.count) || 0));
  const minutes = Math.max(1, Math.min(360, Math.floor(input.minutes) || 0));

  const allowed = [...(await accessibleSubjectIds(user.id))];
  if (!allowed.length) return { error: "Subscribe to a subject first to create a session." };
  let cands = await db.select({ id: questions.id })
    .from(questions).innerJoin(topics, eq(questions.topicId, topics.id)).innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .where(and(inArray(questions.topicId, input.topicIds.slice(0, 500)), inArray(questions.difficulty, diffs), inArray(chapters.subjectId, allowed)))
    .orderBy(asc(chapters.order), asc(topics.order), asc(questions.order));
  let ids = cands.map((c) => c.id);

  if (input.pool !== "all" && ids.length) {
    const latest = await latestForQuestions(user.id, ids);
    if (input.pool === "bookmarked") {
      const bm = new Set((await db.select({ id: bookmarks.questionId }).from(bookmarks).where(and(eq(bookmarks.userId, user.id), inArray(bookmarks.questionId, ids)))).map((b) => b.id));
      ids = ids.filter((id) => bm.has(id));
    } else if (input.pool === "unanswered") ids = ids.filter((id) => !latest.has(id));
    else if (input.pool === "answered") ids = ids.filter((id) => latest.has(id));
    else if (input.pool === "incorrect") ids = ids.filter((id) => latest.get(id)?.isCorrect === false);
  }
  if (!ids.length) return { error: "No questions match these choices. Try a different pool or more topics." };

  if (input.randomize) shuffle(ids);
  ids = ids.slice(0, count);
  const id = await insertSession(user.id, input.mode, ids, { timed: input.timed, minutes, randomize: input.randomize, filters: { topicIds: input.topicIds, pool: input.pool, difficulties: diffs } });
  return { id };
}

/** Study sessions return the correct answer straight away; exam sessions only record the choice. */
export async function answerInSession(testId: string, questionId: string, choiceId: string, timeSpentSec: number): Promise<Reveal | null> {
  const user = await me();
  const [t] = await db.select().from(tests).where(and(eq(tests.id, testId), eq(tests.userId, user.id))).limit(1);
  if (!t || t.finishedAt) throw new Error("This session is finished.");
  if (t.timed && t.timeLimitSec && Date.now() > t.startedAt.getTime() + (t.timeLimitSec + 15) * 1000) throw new Error("Time is up.");
  const [tq] = await db.select({ id: testQuestions.id }).from(testQuestions).where(and(eq(testQuestions.testId, testId), eq(testQuestions.questionId, questionId))).limit(1);
  if (!tq) throw new Error("Question is not part of this session.");

  await assertQuestionAccess(user.id, questionId);
  const choices = await db.select().from(answerChoices).where(eq(answerChoices.questionId, questionId));
  const picked = choices.find((c) => c.id === choiceId), correct = choices.find((c) => c.isCorrect);
  if (!picked || !correct) throw new Error("Invalid choice");

  // In an exam the student may change an answer until they finish, so keep only the latest choice.
  if (t.mode === "exam") await db.delete(userAnswers).where(and(eq(userAnswers.userId, user.id), eq(userAnswers.questionId, questionId), eq(userAnswers.testId, testId)));
  await db.insert(userAnswers).values({ userId: user.id, questionId, choiceId, isCorrect: picked.isCorrect, testId, timeSpentSec: Math.max(0, Math.min(3600, Math.round(timeSpentSec))) });

  if (t.mode === "exam") return null;
  const [q] = await db.select({ explanation: questions.explanation }).from(questions).where(eq(questions.id, questionId)).limit(1);
  const peers = (await peerStats([questionId])).get(questionId) ?? null;
  return { choiceId, isCorrect: picked.isCorrect, correctChoiceId: correct.id, explanation: q.explanation, peers };
}

export async function finishSession(testId: string) {
  const user = await me();
  await db.update(tests).set({ finishedAt: new Date() }).where(and(eq(tests.id, testId), eq(tests.userId, user.id), isNull(tests.finishedAt)));
}

/** Starts a new study session containing only the questions missed in a finished session. */
export async function retryIncorrect(formData: FormData) {
  const user = await me();
  const testId = String(formData.get("testId"));
  const [t] = await db.select({ id: tests.id }).from(tests).where(and(eq(tests.id, testId), eq(tests.userId, user.id))).limit(1);
  if (!t) throw new Error("Session not found");
  const tqs = await db.select({ id: testQuestions.questionId, position: testQuestions.position }).from(testQuestions).where(eq(testQuestions.testId, testId)).orderBy(asc(testQuestions.position));
  const latest = await latestForQuestions(user.id, tqs.map((x) => x.id), testId);
  const wrong = tqs.filter((x) => latest.get(x.id)?.isCorrect === false).map((x) => x.id);
  if (!wrong.length) redirect(`/results/${testId}`);
  const id = await insertSession(user.id, "study", wrong, { timed: false, minutes: 0, randomize: false, filters: { retryOf: testId } });
  redirect(`/session/${id}`);
}
