import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { db, subjects, chapters, topics, questions, questionGroups, answerChoices, bookmarks, notes, highlights, userAnswers } from "@/db";
import { latestCte } from "@/lib/stats";
import { accessibleSubjectIds } from "@/lib/access";
import { parseTags } from "@/lib/tags";
import { peerStats, type Peer } from "@/lib/peers";

/** A paper may accept more than one option ("G,S"), so the right answer is a list. */
export type Reveal = { choiceId: string; isCorrect: boolean; correctChoiceIds: string[]; explanation: string; peers?: Peer | null };
export type Hl = { id: string; target: "question" | "explanation"; start: number; end: number };
/** The block a question belongs to, with its position among the questions of that block in THIS session. */
export type QGroup = {
  id: string; kind: "case" | "emq" | "tf"; title: string; body: string;
  index: number; total: number;
  /** The shared option list, for an EMQ. Empty for a case, where each question has its own choices. */
  options: { label: string; text: string }[];
};
export type StudyQuestion = {
  id: string; subject: string; chapter: string; topic: string; text: string; tags: string[];
  choices: { id: string; label: string; text: string }[];
  group: QGroup | null;
  previous: Reveal | null;
  /** Exam sessions: the choice picked so far (no correctness is ever sent). */
  selected: string | null;
  bookmarked: boolean; note: string; highlights: Hl[];
};

/** Most recent answer per question, optionally only within one session. Only reads the rows it needs. */
export async function latestForQuestions(userId: string, ids: string[], testId?: string) {
  if (!ids.length) return new Map<string, typeof userAnswers.$inferSelect>();
  const rows = await db.selectDistinctOn([userAnswers.questionId]).from(userAnswers)
    .where(and(eq(userAnswers.userId, userId), inArray(userAnswers.questionId, ids), testId ? eq(userAnswers.testId, testId) : undefined))
    .orderBy(userAnswers.questionId, desc(userAnswers.answeredAt));
  return new Map(rows.map((r) => [r.questionId, r]));
}

/** Loads questions (in the given order) together with this student's own answers, bookmarks, notes and highlights. */
export async function loadStudyQuestions(userId: string, opts: { chapterId?: string; ids?: string[]; testId?: string; exam?: boolean }): Promise<StudyQuestion[]> {
  const base = db
    .select({ q: questions, topic: topics.name, chapter: chapters.name, subject: subjects.name, subjectId: subjects.id })
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

  const allowed = await accessibleSubjectIds(userId);
  rows = rows.filter((r) => allowed.has(r.subjectId));
  const ids = rows.map((r) => r.q.id);
  if (!ids.length) return [];
  const choices = await db.select().from(answerChoices).where(inArray(answerChoices.questionId, ids)).orderBy(asc(answerChoices.label));
  const latest = await latestForQuestions(userId, ids, opts.testId);
  const bms = await db.select({ id: bookmarks.questionId }).from(bookmarks).where(and(eq(bookmarks.userId, userId), inArray(bookmarks.questionId, ids)));
  const nts = opts.exam ? [] : await db.select().from(notes).where(and(eq(notes.userId, userId), inArray(notes.questionId, ids)));
  // Only highlights on explanations are saved. Highlights on the question text are temporary.
  const hls = opts.exam ? [] : await db.select().from(highlights).where(and(eq(highlights.userId, userId), eq(highlights.target, "explanation"), inArray(highlights.questionId, ids)));
  const bmSet = new Set(bms.map((b) => b.id));
  const peers = opts.exam ? new Map<string, Peer>() : await peerStats(ids.filter((id) => latest.has(id)));

  // Groups: a question's position is counted among the questions of its group that are in THIS
  // session, so "2 of 5" stays true in an incorrect-only session holding only part of a case.
  const gids = [...new Set(rows.map((r) => r.q.groupId).filter(Boolean))] as string[];
  const gRows = gids.length ? await db.select().from(questionGroups).where(inArray(questionGroups.id, gids)) : [];
  const gById = new Map(gRows.map((g) => [g.id, g]));
  const gMembers = new Map<string, string[]>();
  for (const r of rows) if (r.q.groupId) gMembers.set(r.q.groupId, [...(gMembers.get(r.q.groupId) ?? []), r.q.id]);

  return rows.map((r) => {
    const cs = choices.filter((c) => c.questionId === r.q.id);
    const prev = latest.get(r.q.id);
    const g = r.q.groupId ? gById.get(r.q.groupId) : null;
    const mates = r.q.groupId ? gMembers.get(r.q.groupId) ?? [] : [];
    return {
      id: r.q.id, subject: r.subject, chapter: r.chapter, topic: r.topic, text: r.q.questionText, tags: parseTags(r.q.tags),
      choices: cs.map((c) => ({ id: c.id, label: c.label, text: c.text })),
      group: g ? {
        id: g.id, kind: g.kind as QGroup["kind"], title: g.title, body: g.body,
        index: Math.max(0, mates.indexOf(r.q.id)), total: mates.length,
        // Only an EMQ needs its list spelled out above: a case and a true/false block show their
        // choices under the question like any other.
        options: g.kind === "emq" ? cs.map((c) => ({ label: c.label, text: c.text })) : [],
      } : null,
      // Correct answers/explanations are only sent for questions the student has already answered (never in exams).
      previous: prev && !opts.exam ? { choiceId: prev.choiceId!, isCorrect: prev.isCorrect, correctChoiceIds: cs.filter((c) => c.isCorrect).map((c) => c.id), explanation: r.q.explanation, peers: peers.get(r.q.id) ?? null } : null,
      selected: opts.exam ? prev?.choiceId ?? null : null,
      bookmarked: bmSet.has(r.q.id),
      note: nts.find((n) => n.questionId === r.q.id)?.body ?? "",
      highlights: hls.filter((h) => h.questionId === r.q.id).map((h) => ({ id: h.id, target: "explanation" as const, start: h.start, end: h.end })),
    };
  });
}

export type ReviewKind = "bookmarks" | "incorrect" | "notes";

/** Question ids for a review list, most relevant first. */
export async function reviewIds(userId: string, kind: ReviewKind): Promise<string[]> {
  if (kind === "bookmarks") {
    const r = await db.select().from(bookmarks).where(eq(bookmarks.userId, userId)).orderBy(desc(bookmarks.createdAt));
    return r.map((x) => x.questionId);
  }
  if (kind === "notes") {
    const n = await db.select({ id: notes.questionId }).from(notes).where(eq(notes.userId, userId));
    const h = await db.select({ id: highlights.questionId }).from(highlights).where(and(eq(highlights.userId, userId), eq(highlights.target, "explanation")));
    return [...new Set([...n.map((x) => x.id), ...h.map((x) => x.id)])];
  }
  const r = Array.from(await db.execute(sql`select la.question_id from ${latestCte(userId)} la where la.is_correct = false order by la.answered_at desc`)) as unknown as { question_id: string }[];
  return r.map((x) => x.question_id);
}

export type ReviewItem = {
  id: string; text: string; subjectId: string; subject: string; chapter: string; topic: string; tags: string[];
  note: string; highlightCount: number; bookmarked: boolean;
};

export async function getReviewItems(userId: string, kind: ReviewKind, filter: { q?: string; subjectId?: string }): Promise<{ items: ReviewItem[]; ids: string[]; subjects: { id: string; name: string }[] }> {
  const ids = await reviewIds(userId, kind);
  const allowed = await accessibleSubjectIds(userId);
  const allSubjects = (await db.select({ id: subjects.id, name: subjects.name }).from(subjects).orderBy(asc(subjects.order))).filter((x) => allowed.has(x.id));
  if (!ids.length) return { items: [], ids: [], subjects: allSubjects };

  const rows = await db
    .select({ q: questions, topic: topics.name, chapter: chapters.name, subject: subjects.name, subjectId: subjects.id })
    .from(questions).innerJoin(topics, eq(questions.topicId, topics.id)).innerJoin(chapters, eq(topics.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id))
    .where(inArray(questions.id, ids));
  const nts = await db.select().from(notes).where(and(eq(notes.userId, userId), inArray(notes.questionId, ids)));
  const hls = await db.select({ id: highlights.questionId }).from(highlights).where(and(eq(highlights.userId, userId), eq(highlights.target, "explanation"), inArray(highlights.questionId, ids)));
  const bms = await db.select({ id: bookmarks.questionId }).from(bookmarks).where(and(eq(bookmarks.userId, userId), inArray(bookmarks.questionId, ids)));
  const bmSet = new Set(bms.map((b) => b.id));
  const pos = new Map(ids.map((id, i) => [id, i]));

  const needle = filter.q?.trim().toLowerCase();
  const items = rows
    .filter((r) => allowed.has(r.subjectId))
    .map((r): ReviewItem => ({
      id: r.q.id, text: r.q.questionText, subjectId: r.subjectId, subject: r.subject, chapter: r.chapter, topic: r.topic, tags: parseTags(r.q.tags),
      note: nts.find((n) => n.questionId === r.q.id)?.body ?? "", highlightCount: hls.filter((h) => h.id === r.q.id).length, bookmarked: bmSet.has(r.q.id),
    }))
    .filter((i) => !filter.subjectId || i.subjectId === filter.subjectId)
    .filter((i) => !needle || `${i.text} ${i.note} ${i.chapter} ${i.topic}`.toLowerCase().includes(needle))
    .sort((a, b) => pos.get(a.id)! - pos.get(b.id)!);
  return { items, ids: items.map((i) => i.id), subjects: allSubjects };
}
