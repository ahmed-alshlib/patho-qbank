import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { parseTags } from "@/lib/tags";
import { db, subjects, chapters, topics, questions, answerChoices } from "@/db";

export type ImportQ = { text: string; choices: string[]; correct: string; explanation: string; tags?: string | string[] };
export type ImportChapter = {
  subject: string; subjectOrder?: number; chapter: string; chapterOrder?: number; description?: string;
  topics?: { name: string; questions: ImportQ[] }[];
  /** Shortcut for chapters without topics: questions go into one topic named like the chapter. */
  questions?: ImportQ[];
};
export const LABELS = ["A", "B", "C", "D", "E", "F"];

const norm = (s: unknown) => String(s ?? "").replace(/\s+/g, " ").trim().toLowerCase();

/**
 * Identity of a question: its stem AND its set of choices.
 * Exams reuse a stem from an older paper with different options and a different answer —
 * those are two different questions, so the stem alone must not decide. Choices are sorted
 * so a paper that merely shuffles the options still counts as the same question.
 */
export const questionKey = (text: string, choices: unknown[]) =>
  norm(text) + "\u0000" + choices.map(norm).sort().join("\u001f");

/** Validates one question; returns an error message or null. */
export function checkQuestion(q: ImportQ): string | null {
  if (!q?.text?.trim()) return "a question has no text";
  if (!Array.isArray(q.choices) || q.choices.filter((c) => String(c).trim()).length < 2) return `"${q.text.slice(0, 40)}" needs at least 2 choices`;
  if (q.choices.length > 6) return `"${q.text.slice(0, 40)}" has more than 6 choices`;
  const i = LABELS.indexOf(String(q.correct).toUpperCase());
  if (i < 0 || i >= q.choices.length) return `"${q.text.slice(0, 40)}" has an invalid correct answer`;
  if (!q.explanation?.trim()) return `"${q.text.slice(0, 40)}" has no explanation`;
  return null;
}

/** Adds content without deleting anything: matching subject/chapter/topic are reused and questions already present (same stem and same choices) are skipped, so student progress is kept. */
export async function importChapters(input: ImportChapter[], opts: { subject?: string; chapter?: string; topic?: string } = {}): Promise<{ added: number; skipped: number; merged: number }> {
  const list = input.map((c0) => {
    const c: ImportChapter = { ...c0 };
    if (opts.subject) c.subject = opts.subject;
    if (opts.chapter) c.chapter = opts.chapter;
    let tps = c.topics;
    if (!Array.isArray(tps) && Array.isArray(c.questions) && c.chapter?.trim()) tps = [{ name: c.chapter.trim(), questions: c.questions }];
    if (opts.topic && Array.isArray(tps)) tps = [{ name: opts.topic, questions: tps.flatMap((t) => (Array.isArray(t.questions) ? t.questions : [])) }];
    return { ...c, topics: tps };
  });
  for (const c of list) {
    if (!c.subject?.trim() || !c.chapter?.trim() || !Array.isArray(c.topics)) throw new Error("Each item needs subject, chapter and either topics or questions.");
    for (const t of c.topics) {
      if (!t.name?.trim() || !Array.isArray(t.questions)) throw new Error(`Topic "${t.name ?? ""}" is invalid.`);
      for (const q of t.questions) { const e = checkQuestion(q); if (e) throw new Error(e); }
    }
  }
  let added = 0, skipped = 0, merged = 0;
  for (const c of list) {
    let [subj] = await db.select().from(subjects).where(sql`lower(${subjects.name}) = ${c.subject.trim().toLowerCase()}`).limit(1);
    if (!subj) [subj] = await db.insert(subjects).values({ name: c.subject.trim(), order: c.subjectOrder ?? 0 }).returning();
    let [ch] = await db.select().from(chapters).where(and(sql`lower(${chapters.name}) = ${c.chapter.trim().toLowerCase()}`, eq(chapters.subjectId, subj.id))).limit(1);
    if (!ch) [ch] = await db.insert(chapters).values({ subjectId: subj.id, name: c.chapter.trim(), description: c.description ?? "", order: c.chapterOrder ?? 0 }).returning();
    for (const [ti, t] of c.topics!.entries()) {
      let [tp] = await db.select().from(topics).where(and(sql`lower(${topics.name}) = ${t.name.trim().toLowerCase()}`, eq(topics.chapterId, ch.id))).limit(1);
      if (!tp) [tp] = await db.insert(topics).values({ chapterId: ch.id, name: t.name.trim(), order: ti }).returning();
      const have = await db.select({ id: questions.id, text: questions.questionText, tags: questions.tags, order: questions.order }).from(questions).where(eq(questions.topicId, tp.id)).orderBy(asc(questions.order));
      // The key spans both tables, so the existing questions' choices are loaded with them.
      const prior = have.length
        ? await db.select({ questionId: answerChoices.questionId, text: answerChoices.text }).from(answerChoices).where(inArray(answerChoices.questionId, have.map((h) => h.id)))
        : [];
      const choicesOf = new Map<string, string[]>();
      for (const r of prior) { const got = choicesOf.get(r.questionId); if (got) got.push(r.text); else choicesOf.set(r.questionId, [r.text]); }
      const seen = new Map(have.map((h) => [questionKey(h.text, choicesOf.get(h.id) ?? []), { id: h.id, tags: parseTags(h.tags) }]));
      let order = have.length ? have[have.length - 1].order + 1 : 0;
      for (const q of t.questions) {
        const key = questionKey(q.text, q.choices);
        const dup = seen.get(key);
        if (dup) {
          // Same question already exists: keep it, but add any exam tags it did not have yet.
          const add = parseTags(Array.isArray(q.tags) ? q.tags.join(",") : q.tags ?? "").filter((t) => !dup.tags.some((x) => x.toLowerCase() === t.toLowerCase()));
          if (add.length) { dup.tags = [...dup.tags, ...add]; await db.update(questions).set({ tags: dup.tags.join(", ") }).where(eq(questions.id, dup.id)); merged++; } else skipped++;
          continue;
        }
        const [qr] = await db.insert(questions).values({ topicId: tp.id, questionText: q.text.trim(), explanation: q.explanation.trim(), tags: parseTags(Array.isArray(q.tags) ? q.tags.join(",") : q.tags ?? "").join(", "), order: order++ }).returning();
        const correct = LABELS.indexOf(String(q.correct).toUpperCase());
        await db.insert(answerChoices).values(q.choices.map((text, i) => ({ questionId: qr.id, label: LABELS[i], text: String(text).trim(), isCorrect: i === correct })));
        seen.set(key, { id: qr.id, tags: parseTags(qr.tags) }); added++;
      }
    }
  }
  return { added, skipped, merged };
}
