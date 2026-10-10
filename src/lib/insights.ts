import { sql } from "drizzle-orm";
import { db } from "@/db";
import { latestCte, TZ } from "@/lib/stats";
import { accessibleSubjectIds } from "@/lib/access";

const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);

export type TopicInsight = { topicId: string; topic: string; chapter: string; subject: string; total: number; answered: number; correct: number; accuracy: number | null };

export async function getTopicInsights(userId: string): Promise<TopicInsight[]> {
  const allowed = await accessibleSubjectIds(userId);
  const r = rows<{ topic_id: string; topic: string; chapter: string; subject_id: string; subject: string; total: number; answered: number; correct: number }>(await db.execute(sql`
    select t.id as topic_id, t.name as topic, c.name as chapter, s.id as subject_id, s.name as subject,
      count(q.id)::int as total, count(la.question_id)::int as answered, (count(*) filter (where la.is_correct))::int as correct
    from topics t join chapters c on c.id = t.chapter_id join subjects s on s.id = c.subject_id join questions q on q.topic_id = t.id
    left join ${latestCte(userId)} la on la.question_id = q.id
    group by t.id, t.name, c.id, c.name, s.id, s.name`));
  return r.filter((x) => allowed.has(x.subject_id)).map((x) => ({
    topicId: x.topic_id, topic: x.topic, chapter: x.chapter, subject: x.subject, total: x.total, answered: x.answered, correct: x.correct,
    accuracy: x.answered ? Math.round((x.correct / x.answered) * 100) : null,
  }));
}

/** Weakest topics first (at least 3 answered, under 75%). */
export const weakTopics = (t: TopicInsight[], n = 6) => t.filter((x) => x.answered >= 3 && x.accuracy! < 75).sort((a, b) => a.accuracy! - b.accuracy! || b.answered - a.answered).slice(0, n);

/** One suggestion: the weakest topic, else the topic with the most unanswered questions. */
export function studyNext(t: TopicInsight[]): { topic: TopicInsight; reason: string } | null {
  const w = weakTopics(t, 1)[0];
  if (w) return { topic: w, reason: `${w.accuracy}% accuracy, worth another pass` };
  const u = [...t].filter((x) => x.total - x.answered > 0).sort((a, b) => (b.total - b.answered) - (a.total - a.answered))[0];
  return u ? { topic: u, reason: `${u.total - u.answered} questions not yet attempted` } : null;
}

export type Week = { label: string; answers: number; accuracy: number | null };
export async function getWeeklyTrend(userId: string, weeks = 8): Promise<Week[]> {
  const r = rows<{ wk: string; answers: number; correct: number }>(await db.execute(sql`
    select to_char(date_trunc('week', answered_at at time zone ${TZ}), 'YYYY-MM-DD') as wk, count(*)::int as answers, (count(*) filter (where is_correct))::int as correct
    from user_answers where user_id = ${userId} and answered_at > now() - (${weeks}::int * interval '1 week')
    group by 1 order by 1`));
  return r.map((x) => ({ label: new Date(x.wk + "T00:00:00Z").toLocaleDateString("en", { month: "short", day: "numeric", timeZone: "UTC" }), answers: x.answers, accuracy: x.answers ? Math.round((x.correct / x.answers) * 100) : null }));
}
