import { and, asc, eq, inArray } from "drizzle-orm";
import { db, subjects, chapters, topics, questions, answerChoices, bookmarks, notes, highlights } from "@/db";
import { latestAnswers } from "@/lib/stats";

export type Reveal = { choiceId: string; isCorrect: boolean; correctChoiceId: string; explanation: string };
export type Hl = { id: string; target: "question" | "explanation"; start: number; end: number };
export type StudyQuestion = {
  id: string; subject: string; chapter: string; topic: string; text: string; difficulty: string;
  choices: { id: string; label: string; text: string }[];
  previous: Reveal | null; explanation?: undefined;
  bookmarked: boolean; note: string; highlights: Hl[];
};

/** Loads questions (in the given order) together with this student's own answers, bookmarks, notes and highlights. */
export async function loadStudyQuestions(userId: string, opts: { chapterId?: string; ids?: string[] }): Promise<StudyQuestion[]> {
  const base = db
    .select({ q: questions, topic: topics.name, torder: topics.order, chapter: chapters.name, subject: subjects.name })
    .from(questions)
    .innerJoin(topics, eq(questions.topicId, topics.id))
    .innerJoin(chapters, eq(topics.chapterId, chapters.id))
    .innerJoin(subjects, eq(chapters.subjectId, subjects.id));

  let rows;
  if (opts.chapterId) rows = await base.where(eq(topics.chapterId, opts.chapterId)).orderBy(asc(topics.order), asc(questions.order));
  else if (opts.ids?.length) {
    const found = await base.where(inArray(questions.id, opts.ids));
    const pos = new Map(opts.ids.map((id, i) => [id, i]));
    rows = found.sort((a, b) => pos.get(a.q.id)! - pos.get(b.q.id)!);
  } else return [];

  const ids = rows.map((r) => r.q.id);
  if (!ids.length) return [];
  const choices = await db.select().from(answerChoices).where(inArray(answerChoices.questionId, ids)).orderBy(asc(answerChoices.label));
  const latest = await latestAnswers(userId);
  const bms = await db.select({ id: bookmarks.questionId }).from(bookmarks).where(and(eq(bookmarks.userId, userId), inArray(bookmarks.questionId, ids)));
  const nts = await db.select().from(notes).where(and(eq(notes.userId, userId), inArray(notes.questionId, ids)));
  const hls = await db.select().from(highlights).where(and(eq(highlights.userId, userId), inArray(highlights.questionId, ids)));
  const bmSet = new Set(bms.map((b) => b.id));

  return rows.map((r) => {
    const cs = choices.filter((c) => c.questionId === r.q.id);
    const prev = latest.get(r.q.id);
    return {
      id: r.q.id, subject: r.subject, chapter: r.chapter, topic: r.topic, text: r.q.questionText, difficulty: r.q.difficulty,
      choices: cs.map((c) => ({ id: c.id, label: c.label, text: c.text })),
      // Correct answers/explanations are only sent for questions the student has already attempted.
      previous: prev ? { choiceId: prev.choiceId!, isCorrect: prev.isCorrect, correctChoiceId: cs.find((c) => c.isCorrect)!.id, explanation: r.q.explanation } : null,
      bookmarked: bmSet.has(r.q.id),
      note: nts.find((n) => n.questionId === r.q.id)?.body ?? "",
      highlights: hls.filter((h) => h.questionId === r.q.id).map((h) => ({ id: h.id, target: h.target as Hl["target"], start: h.start, end: h.end })),
    };
  });
}

export type ReviewKind = "bookmarks" | "incorrect" | "notes";

/** Question ids for a review list, most relevant first. */
export async function reviewIds(userId: string, kind: ReviewKind): Promise<string[]> {
  if (kind === "bookmarks") {
    const r = await db.select().from(bookmarks).where(eq(bookmarks.userId, userId));
    return r.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).map((x) => x.questionId);
  }
  if (kind === "notes") {
    const n = await db.select({ id: notes.questionId }).from(notes).where(eq(notes.userId, userId));
    const h = await db.select({ id: highlights.questionId }).from(highlights).where(eq(highlights.userId, userId));
    return [...new Set([...n.map((x) => x.id), ...h.map((x) => x.id)])];
  }
  const latest = await latestAnswers(userId);
  return [...latest.values()].filter((a) => !a.isCorrect).sort((a, b) => b.answeredAt.getTime() - a.answeredAt.getTime()).map((a) => a.questionId);
}

export type ReviewItem = {
  id: string; text: string; subjectId: string; subject: string; chapter: string; topic: string; difficulty: string;
  note: string; highlightCount: number; bookmarked: boolean;
};

export async function getReviewItems(userId: string, kind: ReviewKind, filter: { q?: string; subjectId?: string }): Promise<{ items: ReviewItem[]; ids: string[]; subjects: { id: string; name: string }[] }> {
  const ids = await reviewIds(userId, kind);
  const allSubjects = await db.select({ id: subjects.id, name: subjects.name }).from(subjects).orderBy(asc(subjects.order));
  if (!ids.length) return { items: [], ids: [], subjects: allSubjects };

  const rows = await db
    .select({ q: questions, topic: topics.name, chapter: chapters.name, subject: subjects.name, subjectId: subjects.id })
    .from(questions).innerJoin(topics, eq(questions.topicId, topics.id)).innerJoin(chapters, eq(topics.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(inArray(questions.id, ids));
  const nts = await db.select().from(notes).where(and(eq(notes.userId, userId), inArray(notes.questionId, ids)));
  const hls = await db.select({ id: highlights.questionId }).from(highlights).where(and(eq(highlights.userId, userId), inArray(highlights.questionId, ids)));
  const bms = await db.select({ id: bookmarks.questionId }).from(bookmarks).where(and(eq(bookmarks.userId, userId), inArray(bookmarks.questionId, ids)));
  const bmSet = new Set(bms.map((b) => b.id));
  const pos = new Map(ids.map((id, i) => [id, i]));

  const needle = filter.q?.trim().toLowerCase();
  const items = rows
    .map((r): ReviewItem => ({
      id: r.q.id, text: r.q.questionText, subjectId: r.subjectId, subject: r.subject, chapter: r.chapter, topic: r.topic, difficulty: r.q.difficulty,
      note: nts.find((n) => n.questionId === r.q.id)?.body ?? "", highlightCount: hls.filter((h) => h.id === r.q.id).length, bookmarked: bmSet.has(r.q.id),
    }))
    .filter((i) => !filter.subjectId || i.subjectId === filter.subjectId)
    .filter((i) => !needle || `${i.text} ${i.note} ${i.chapter} ${i.topic}`.toLowerCase().includes(needle))
    .sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  return { items, ids: items.map((i) => i.id), subjects: allSubjects };
}
