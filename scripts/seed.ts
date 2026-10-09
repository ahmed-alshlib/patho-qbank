import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { and, eq } from "drizzle-orm";
import { db, client, subjects, chapters, topics, questions, answerChoices, approvedEmails } from "../src/db";

type Q = { text: string; choices: string[]; correct: string; explanation: string; difficulty?: string; tags?: string };
type Chapter = {
  subject: string; subjectOrder?: number; chapter: string; chapterOrder?: number; description?: string;
  topics: { name: string; questions: Q[] }[];
};

const dir = path.join(process.cwd(), "content");
const LABELS = ["A", "B", "C", "D", "E", "F"];

async function seedChapter(c: Chapter) {
  let [subj] = await db.select().from(subjects).where(eq(subjects.name, c.subject)).limit(1);
  if (!subj) [subj] = await db.insert(subjects).values({ name: c.subject, order: c.subjectOrder ?? 0 }).returning();

  // Re-seeding a chapter replaces its content (cascades to topics/questions/answers).
  await db.delete(chapters).where(and(eq(chapters.name, c.chapter), eq(chapters.subjectId, subj.id)));

  const [ch] = await db.insert(chapters).values({ subjectId: subj.id, name: c.chapter, description: c.description ?? "", order: c.chapterOrder ?? 0 }).returning();
  let qCount = 0;
  for (const [ti, t] of c.topics.entries()) {
    const [tp] = await db.insert(topics).values({ chapterId: ch.id, name: t.name, order: ti }).returning();
    for (const [qi, q] of t.questions.entries()) {
      if (!LABELS.includes(q.correct) || LABELS.indexOf(q.correct) >= q.choices.length)
        throw new Error(`Bad correct answer in "${q.text.slice(0, 40)}"`);
      const [qr] = await db.insert(questions).values({
        topicId: tp.id, questionText: q.text, explanation: q.explanation,
        difficulty: q.difficulty ?? "medium", tags: q.tags ?? "", order: qi,
      }).returning();
      await db.insert(answerChoices).values(q.choices.map((text, i) => ({ questionId: qr.id, label: LABELS[i], text, isCorrect: LABELS[i] === q.correct })));
      qCount++;
    }
  }
  console.log(`  ${c.subject} / ${c.chapter}: ${qCount} questions`);
}

async function main() {
  console.log("Seeding content...");
  for (const f of fs.readdirSync(dir).filter((f) => f.endsWith(".json")).sort())
    await seedChapter(JSON.parse(fs.readFileSync(path.join(dir, f), "utf8")));

  const emailFile = path.join(dir, "approved-emails.txt");
  if (fs.existsSync(emailFile)) {
    const list = fs.readFileSync(emailFile, "utf8").split("\n").map((l) => l.trim().toLowerCase()).filter((l) => l && !l.startsWith("#"));
    if (list.length) await db.insert(approvedEmails).values(list.map((email) => ({ email }))).onConflictDoNothing();
    console.log(`Approved emails: ${list.length}`);
  }
  await client.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
