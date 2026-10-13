import { and, asc, count, eq, sql } from "drizzle-orm";
import { db, subjects, chapters, summaries, summaryLikes } from "@/db";
import { accessibleSubjectIds } from "@/lib/access";

export type SummaryGroup = { subjectId: string; subject: string; open: boolean; chapters: { id: string; name: string; items: { id: string; title: string; chars: number; url: string; likes: number; liked: boolean }[] }[] };

/** All subjects with summaries. Titles are listed for everyone; the text itself is only readable by subscribed students. */
export async function listSummaryGroups(userId: string): Promise<SummaryGroup[]> {
  const allowed = await accessibleSubjectIds(userId);
  const rows = await db.select({ id: summaries.id, title: summaries.title, chars: summaries.body, url: summaries.url, chapterId: chapters.id, chapter: chapters.name, chOrder: chapters.order, subjectId: subjects.id, subject: subjects.name, sOrder: subjects.order, order: summaries.order })
    .from(summaries).innerJoin(chapters, eq(summaries.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .orderBy(asc(subjects.order), asc(chapters.order), asc(summaries.order));
  const likeRows = await db.select({ id: summaryLikes.summaryId, n: count(), mine: sql<number>`count(*) filter (where ${summaryLikes.userId} = ${userId})::int` }).from(summaryLikes).groupBy(summaryLikes.summaryId);
  const likes = new Map(likeRows.map((l) => [l.id, l]));
  const groups: SummaryGroup[] = [];
  for (const r of rows) {
    let g = groups.find((x) => x.subjectId === r.subjectId);
    if (!g) groups.push((g = { subjectId: r.subjectId, subject: r.subject, open: allowed.has(r.subjectId), chapters: [] }));
    let c = g.chapters.find((x) => x.id === r.chapterId);
    if (!c) g.chapters.push((c = { id: r.chapterId, name: r.chapter, items: [] }));
    c.items.push({ id: r.id, title: r.title, chars: r.chars.length, url: g.open ? r.url : "", likes: likes.get(r.id)?.n ?? 0, liked: (likes.get(r.id)?.mine ?? 0) > 0 });
  }
  return groups;
}

export async function getSummary(userId: string, id: string) {
  const [r] = await db.select({ s: summaries, chapterId: chapters.id, chapter: chapters.name, subjectId: subjects.id, subject: subjects.name })
    .from(summaries).innerJoin(chapters, eq(summaries.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(eq(summaries.id, id)).limit(1);
  if (!r) return null;
  const open = (await accessibleSubjectIds(userId)).has(r.subjectId);
  const [lk] = await db.select({ n: count(), mine: sql<number>`count(*) filter (where ${summaryLikes.userId} = ${userId})::int` }).from(summaryLikes).where(eq(summaryLikes.summaryId, id));
  const siblings = await db.select({ id: summaries.id, title: summaries.title }).from(summaries).where(eq(summaries.chapterId, r.chapterId)).orderBy(asc(summaries.order));
  return { id: r.s.id, title: r.s.title, body: open ? r.s.body : "", url: open ? r.s.url : "", likes: lk.n, liked: lk.mine > 0, open, chapter: r.chapter, subject: r.subject, subjectId: r.subjectId, updatedAt: r.s.updatedAt, siblings };
}
