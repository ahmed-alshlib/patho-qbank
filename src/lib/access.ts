import { cache } from "react";
import { and, eq, gt } from "drizzle-orm";
import { db, subjects, subscriptions, users, questions, topics, chapters } from "@/db";

/** Subjects the student may study right now (active, unexpired subscription). Admins see everything. */
export const accessibleSubjectIds = cache(async (userId: string): Promise<Set<string>> => {
  const [u] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  if (u?.isAdmin) return new Set((await db.select({ id: subjects.id }).from(subjects)).map((s) => s.id));
  const r = await db.select({ id: subscriptions.subjectId }).from(subscriptions)
    .where(and(eq(subscriptions.userId, userId), eq(subscriptions.status, "active"), gt(subscriptions.expiresAt, new Date())));
  return new Set(r.map((x) => x.id));
});

/** Throws unless the student has an active subscription for the question's subject. */
export async function assertQuestionAccess(userId: string, questionId: string) {
  const [r] = await db.select({ subjectId: chapters.subjectId }).from(questions)
    .innerJoin(topics, eq(questions.topicId, topics.id)).innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .where(eq(questions.id, questionId)).limit(1);
  if (!r) throw new Error("Question not found");
  if (!(await accessibleSubjectIds(userId)).has(r.subjectId)) throw new Error("Subscription required for this subject.");
}

export function addMonths(d: Date, n: number) { const x = new Date(d); x.setMonth(x.getMonth() + n); return x; }
