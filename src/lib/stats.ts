import { eq, asc } from "drizzle-orm";
import { db, subjects, chapters, topics, questions, userAnswers } from "@/db";

export type ChapterStat = {
  id: string; name: string; description: string; subjectId: string; subjectName: string;
  total: number; completed: number; correct: number; incorrect: number; accuracy: number | null;
  lastAnsweredAt: number | null;
};

/** Per-chapter progress. A question counts by its most recent attempt. */
export async function getChapterStats(userId: string): Promise<ChapterStat[]> {
  const qs = await db
    .select({
      qid: questions.id, cid: chapters.id, cname: chapters.name, cdesc: chapters.description, corder: chapters.order,
      sid: subjects.id, sname: subjects.name, sorder: subjects.order,
    })
    .from(questions)
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id));

  const latest = await latestAnswers(userId);
  const map = new Map<string, ChapterStat & { _s: number; _c: number }>();
  for (const q of qs) {
    let c = map.get(q.cid);
    if (!c) {
      c = { id: q.cid, name: q.cname, description: q.cdesc, subjectId: q.sid, subjectName: q.sname,
        total: 0, completed: 0, correct: 0, incorrect: 0, accuracy: null, lastAnsweredAt: null, _s: q.sorder, _c: q.corder };
      map.set(q.cid, c);
    }
    c.total++;
    const a = latest.get(q.qid);
    if (a) {
      c.completed++;
      if (a.isCorrect) c.correct++; else c.incorrect++;
      const t = a.answeredAt.getTime();
      if (!c.lastAnsweredAt || t > c.lastAnsweredAt) c.lastAnsweredAt = t;
    }
  }
  const out = [...map.values()].sort((a, b) => a._s - b._s || a._c - b._c);
  for (const c of out) c.accuracy = c.completed ? Math.round((c.correct / c.completed) * 100) : null;
  return out;
}

export async function latestAnswers(userId: string) {
  const rows = await db.select().from(userAnswers).where(eq(userAnswers.userId, userId)).orderBy(asc(userAnswers.answeredAt));
  const m = new Map<string, (typeof rows)[number]>();
  for (const r of rows) m.set(r.questionId, r); // later rows overwrite earlier ones
  return m;
}

export async function getOverview(userId: string) {
  const rows = await db.select().from(userAnswers).where(eq(userAnswers.userId, userId));
  const latest = await latestAnswers(userId);
  const completed = latest.size;
  const correct = [...latest.values()].filter((a) => a.isCorrect).length;

  const dayKey = (d: Date) => d.toLocaleDateString("en-CA"); // YYYY-MM-DD, local
  const today = dayKey(new Date());
  const days = new Set(rows.map((r) => dayKey(r.answeredAt)));
  const answeredToday = rows.filter((r) => dayKey(r.answeredAt) === today).length;

  // Study streak: consecutive days ending today (or yesterday if nothing yet today).
  let streak = 0;
  const cursor = new Date();
  if (!days.has(dayKey(cursor))) cursor.setDate(cursor.getDate() - 1);
  while (days.has(dayKey(cursor))) { streak++; cursor.setDate(cursor.getDate() - 1); }

  const totalAttempts = rows.length;
  const avgTime = totalAttempts ? Math.round(rows.reduce((s, r) => s + r.timeSpentSec, 0) / totalAttempts) : 0;

  return { completed, correct, incorrect: completed - correct, accuracy: completed ? Math.round((correct / completed) * 100) : null,
    answeredToday, streak, totalAttempts, avgTime };
}

export function pct(n: number, d: number) { return d ? Math.round((n / d) * 100) : 0; }
