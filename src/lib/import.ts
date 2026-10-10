import { and, asc, eq } from "drizzle-orm";
import { db, subjects, chapters, topics, questions, answerChoices } from "@/db";

export type ImportQ = { text: string; choices: string[]; correct: string; explanation: string; difficulty?: string; tags?: string };
export type ImportChapter = {
  subject: string; subjectOrder?: number; chapter: string; chapterOrder?: number; description?: string;
  topics?: { name: string; questions: ImportQ[] }[];
  /** Shortcut for chapters without topics: questions go into one topic named like the chapter. */
  questions?: ImportQ[];
};
export const LABELS = ["A", "B", "C", "D", "E", "F"];

/** Validates one question; returns an error message or null. */
export function checkQuestion(q: ImportQ): string | null {
  if (!q?.text?.trim()) return "a question has no text";
  if (!Array.isArray(q.choices) || q.choices.filter((c) => String(c).trim()).length < 2) return `"${q.text.slice(0, 40)}" needs at least 2 choices`;
  if (q.choices.length > 6) return `"${q.text.slice(0, 40)}" has more than 6 choices`;
  const i = LABELS.indexOf(String(q.correct).toUpperCase());
  if (i < 0 || i >= q.choices.length) return `"${q.text.slice(0, 40)}" has an invalid correct answer`;
  if (!q.explanation?.trim()) return `"${q.text.slice(0, 40)}" has no explanation`;
  if (q.difficulty && !["easy", "medium", "hard"].includes(q.difficulty)) return `"${q.text.slice(0, 40)}" has an invalid difficulty`;
  return null;
}

/** Adds content without deleting anything: matching subject/chapter/topic are reused and questions already present (same text) are skipped, so student progress is kept. */
export async function importChapters(input: ImportChapter[]): Promise<{ added: number; skipped: number }> {
  const list = input.map((c) => {
    if (!Array.isArray(c.topics) && Array.isArray(c.questions) && c.chapter?.trim()) {
      return { ...c, topics: [{ name: c.chapter.trim(), questions: c.questions }] };
    }
    return c;
  });
  for (const c of list) {
    if (!c.subject?.trim() || !c.chapter?.trim() || !Array.isArray(c.topics)) throw new Error("Each item needs subject, chapter and either topics or questions.");
    for (const t of c.topics) {
      if (!t.name?.trim() || !Array.isArray(t.questions)) throw new Error(`Topic "${t.name ?? ""}" is invalid.`);
      for (const q of t.questions) { const e = checkQuestion(q); if (e) throw new Error(e); }
    }
  }
  let added = 0, skipped = 0;
  for (const c of list) {
    let [subj] = await db.select().from(subjects).where(eq(subjects.name, c.subject.trim())).limit(1);
    if (!subj) [subj] = await db.insert(subjects).values({ name: c.subject.trim(), order: c.subjectOrder ?? 0 }).returning();
    let [ch] = await db.select().from(chapters).where(and(eq(chapters.name, c.chapter.trim()), eq(chapters.subjectId, subj.id))).limit(1);
    if (!ch) [ch] = await db.insert(chapters).values({ subjectId: subj.id, name: c.chapter.trim(), description: c.description ?? "", order: c.chapterOrder ?? 0 }).returning();
    for (const [ti, t] of c.topics!.entries()) {
      let [tp] = await db.select().from(topics).where(and(eq(topics.name, t.name.trim()), eq(topics.chapterId, ch.id))).limit(1);
      if (!tp) [tp] = await db.insert(topics).values({ chapterId: ch.id, name: t.name.trim(), order: ti }).returning();
      const have = await db.select({ text: questions.questionText, order: questions.order }).from(questions).where(eq(questions.topicId, tp.id)).orderBy(asc(questions.order));
      const seen = new Set(have.map((h) => h.text.trim()));
      let order = have.length ? have[have.length - 1].order + 1 : 0;
      for (const q of t.questions) {
        if (seen.has(q.text.trim())) { skipped++; continue; }
        const [qr] = await db.insert(questions).values({ topicId: tp.id, questionText: q.text.trim(), explanation: q.explanation.trim(), difficulty: q.difficulty ?? "medium", tags: q.tags ?? "", order: order++ }).returning();
        const correct = LABELS.indexOf(String(q.correct).toUpperCase());
        await db.insert(answerChoices).values(q.choices.map((text, i) => ({ questionId: qr.id, label: LABELS[i], text: String(text).trim(), isCorrect: i === correct })));
        seen.add(q.text.trim()); added++;
      }
    }
  }
  return { added, skipped };
}
