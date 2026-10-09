import { sql } from "drizzle-orm";
import { db } from "@/db";

export const TZ = process.env.APP_TZ ?? "Africa/Tripoli";

export type ChapterStat = {
  id: string; name: string; description: string; subjectId: string; subjectName: string;
  total: number; completed: number; correct: number; incorrect: number; accuracy: number | null;
  lastAnsweredAt: number | null;
};

export function pct(n: number, d: number) { return d ? Math.round((n / d) * 100) : 0; }

/** Each student's most recent answer per question, computed inside the database. */
export const latestCte = (userId: string) => sql`(select distinct on (question_id) question_id, is_correct, answered_at from user_answers where user_id = ${userId} order by question_id, answered_at desc)`;

const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);

export async function getChapterStats(userId: string): Promise<ChapterStat[]> {
  const r = rows<{ id: string; name: string; description: string; subject_id: string; subject_name: string; total: number; completed: number; correct: number; incorrect: number; last_answered: string | Date | null }>(
    await db.execute(sql`
      select c.id, c.name, c.description, s.id as subject_id, s.name as subject_name,
        count(q.id)::int as total,
        count(la.question_id)::int as completed,
        (count(*) filter (where la.is_correct))::int as correct,
        (count(*) filter (where la.is_correct = false))::int as incorrect,
        max(la.answered_at) as last_answered
      from chapters c
      join subjects s on s.id = c.subject_id
      left join topics t on t.chapter_id = c.id
      left join questions q on q.topic_id = t.id
      left join ${latestCte(userId)} la on la.question_id = q.id
      group by c.id, s.id
      order by s."order", c."order"`));
  return r.map((x) => ({
    id: x.id, name: x.name, description: x.description, subjectId: x.subject_id, subjectName: x.subject_name,
    total: x.total, completed: x.completed, correct: x.correct, incorrect: x.incorrect,
    accuracy: x.completed ? Math.round((x.correct / x.completed) * 100) : null,
    lastAnsweredAt: x.last_answered ? new Date(x.last_answered).getTime() : null,
  }));
}

const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD in the app's timezone

export async function getOverview(userId: string) {
  const [lat] = rows<{ completed: number; correct: number }>(await db.execute(sql`
    select count(*)::int as completed, (count(*) filter (where is_correct))::int as correct from ${latestCte(userId)} la`));
  const [tot] = rows<{ attempts: number; avg: number }>(await db.execute(sql`
    select count(*)::int as attempts, coalesce(avg(time_spent_sec), 0)::float as avg from user_answers where user_id = ${userId}`));
  const perDay = rows<{ d: string; n: number }>(await db.execute(sql`
    select to_char(answered_at at time zone ${TZ}::text, 'YYYY-MM-DD') as d, count(*)::int as n
    from user_answers where user_id = ${userId} and answered_at > now() - interval '400 days' group by 1`));

  const byDay = new Map(perDay.map((x) => [x.d, x.n]));
  const day = (offset: number) => new Date(Date.now() - offset * 86400000);
  const today = dayKey(day(0));

  let streak = 0, off = byDay.has(today) ? 0 : 1;
  while (byDay.has(dayKey(day(off)))) { streak++; off++; }

  const daily = Array.from({ length: 14 }, (_, i) => {
    const d = day(13 - i), key = dayKey(d);
    return { key, label: d.toLocaleDateString("en", { weekday: "short", timeZone: TZ }), count: byDay.get(key) ?? 0 };
  });

  return {
    daily, completed: lat.completed, correct: lat.correct, incorrect: lat.completed - lat.correct,
    accuracy: lat.completed ? Math.round((lat.correct / lat.completed) * 100) : null,
    answeredToday: byDay.get(today) ?? 0, streak, totalAttempts: tot.attempts, avgTime: Math.round(tot.avg),
  };
}

export async function getCounts(userId: string) {
  const [r] = rows<{ b: number; n: number; i: number }>(await db.execute(sql`
    select (select count(*) from bookmarks where user_id = ${userId})::int as b,
           (select count(*) from notes where user_id = ${userId})::int as n,
           (select count(*) from ${latestCte(userId)} la where la.is_correct = false)::int as i`));
  return { bookmarks: r.b, notes: r.n, incorrect: r.i };
}
