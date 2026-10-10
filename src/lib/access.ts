import { cache } from "react";
import { and, desc, eq, gt } from "drizzle-orm";
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

export type Notice = { subjectId: string; subject: string; kind: "ending" | "ended"; days: number };

/** Subjects ending within 7 days (or ended within the last 14) that the student has not already asked to renew. */
export async function getExpiryNotices(userId: string): Promise<Notice[]> {
  const rows = await db.select({ subjectId: subscriptions.subjectId, subject: subjects.name, status: subscriptions.status, expiresAt: subscriptions.expiresAt })
    .from(subscriptions).innerJoin(subjects, eq(subscriptions.subjectId, subjects.id))
    .where(eq(subscriptions.userId, userId)).orderBy(desc(subscriptions.createdAt));
  const now = Date.now(), DAY = 86400000, out: Notice[] = [];
  const ids = new Set(rows.map((r) => r.subjectId));
  for (const id of ids) {
    const mine = rows.filter((r) => r.subjectId === id);
    if (mine.some((r) => r.status === "pending")) continue;
    const act = mine.filter((r) => r.status === "active" && r.expiresAt);
    if (!act.length) continue;
    const exp = Math.max(...act.map((r) => r.expiresAt!.getTime()));
    const days = Math.ceil((exp - now) / DAY);
    if (exp > now && days <= 7) out.push({ subjectId: id, subject: mine[0].subject, kind: "ending", days });
    else if (exp <= now && now - exp <= 14 * DAY) out.push({ subjectId: id, subject: mine[0].subject, kind: "ended", days: 0 });
  }
  return out;
}
