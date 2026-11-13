"use server";
import { and, asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, subjects, chapters, topics, questions, answerChoices } from "@/db";
import { getUser } from "@/lib/auth";
import { checkQuestion, importChapters, LABELS, type ImportChapter } from "@/lib/import";

async function admin() {
  const u = await getUser();
  if (!u?.isAdmin) throw new Error("Not allowed");
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const num = (f: FormData, k: string) => Math.max(0, Math.min(9999, Math.floor(Number(f.get(k))) || 0));
const name = (f: FormData, k = "name") => { const v = str(f, k).slice(0, 160); if (!v) throw new Error("Name is required."); return v; };
const done = () => { revalidatePath("/admin/content", "layout"); revalidatePath("/subjects"); };

export async function saveSubject(f: FormData) {
  await admin();
  const id = str(f, "id");
  if (id) await db.update(subjects).set({ name: name(f), order: num(f, "order") }).where(eq(subjects.id, id));
  else await db.insert(subjects).values({ name: name(f), order: num(f, "order") });
  done();
}
export async function deleteSubject(f: FormData) { await admin(); await db.delete(subjects).where(eq(subjects.id, str(f, "id"))); done(); }

export async function saveChapter(f: FormData) {
  await admin();
  const id = str(f, "id");
  if (id) await db.update(chapters).set({ name: name(f), description: str(f, "description").slice(0, 500), order: num(f, "order") }).where(eq(chapters.id, id));
  else await db.insert(chapters).values({ subjectId: str(f, "subjectId"), name: name(f), description: str(f, "description").slice(0, 500), order: num(f, "order") });
  done();
}
export async function deleteChapter(f: FormData) { await admin(); await db.delete(chapters).where(eq(chapters.id, str(f, "id"))); done(); }

export async function saveTopic(f: FormData) {
  await admin();
  const id = str(f, "id");
  if (id) await db.update(topics).set({ name: name(f), order: num(f, "order") }).where(eq(topics.id, id));
  else await db.insert(topics).values({ chapterId: str(f, "chapterId"), name: name(f), order: num(f, "order") });
  done();
}
export async function deleteTopic(f: FormData) { await admin(); await db.delete(topics).where(eq(topics.id, str(f, "id"))); done(); }

const cleanTags = (s: string) => s.split(/[,،;]/).map((t) => t.trim()).filter(Boolean).join(", ");

/** Create or edit one question from the form. Answer choices are rewritten (labels A-F in order, blanks skipped). */
export async function saveQuestion(f: FormData) {
  await admin();
  const id = str(f, "id"), topicId = str(f, "topicId");
  const raw = LABELS.map((l) => ({ l, t: str(f, `choice_${l}`) })).filter((c) => c.t);
  const correctLabel = str(f, "correct");
  const ci = raw.findIndex((c) => c.l === correctLabel);
  const q = { text: str(f, "text"), choices: raw.map((c) => c.t), correct: ci >= 0 ? LABELS[ci] : "", explanation: str(f, "explanation") };
  const err = checkQuestion(q);
  if (err) redirect(`/admin/content/${topicId}?error=${encodeURIComponent(err)}`);
  if (id) {
    await db.update(questions).set({ questionText: q.text, explanation: q.explanation, tags: cleanTags(str(f, "tags")) }).where(eq(questions.id, id));
    // The "why" lines are not on this form: keep each one with the choice whose wording did not change.
    const before = await db.select({ text: answerChoices.text, note: answerChoices.note }).from(answerChoices).where(eq(answerChoices.questionId, id));
    const noteOf = (text: string) => before.find((b) => b.text.trim().toLowerCase() === text.trim().toLowerCase())?.note ?? "";
    await db.delete(answerChoices).where(eq(answerChoices.questionId, id));
    await db.insert(answerChoices).values(q.choices.map((text, i) => ({ questionId: id, label: LABELS[i], text, isCorrect: LABELS[i] === q.correct, note: noteOf(text) })));
  } else {
    const last = await db.select({ o: questions.order }).from(questions).where(eq(questions.topicId, topicId)).orderBy(asc(questions.order));
    const [qr] = await db.insert(questions).values({ topicId, questionText: q.text, explanation: q.explanation, tags: cleanTags(str(f, "tags")), order: last.length ? last[last.length - 1].o + 1 : 0 }).returning();
    await db.insert(answerChoices).values(q.choices.map((text, i) => ({ questionId: qr.id, label: LABELS[i], text, isCorrect: LABELS[i] === q.correct })));
  }
  done();
  redirect(`/admin/content/${topicId}?saved=1`);
}

export async function deleteQuestion(f: FormData) {
  await admin();
  await db.delete(questions).where(and(eq(questions.id, str(f, "id"))));
  done();
  redirect(`/admin/content/${str(f, "topicId")}`);
}

export async function importJson(f: FormData) {
  await admin();
  let text = str(f, "json");
  const file = f.get("file");
  if (file instanceof File && file.size) text = await file.text();
  try {
    text = text.replace(/^\uFEFF/, "").trim();
    if (!text) throw new Error("Nothing to import: paste the JSON or choose a file.");
    let data: unknown;
    try { data = JSON.parse(text); } catch (e) {
      const m = /position (\d+)/.exec(e instanceof Error ? e.message : "");
      const pos = m ? Number(m[1]) : -1;
      const where = pos >= 0 ? ` Problem near line ${text.slice(0, pos).split("\n").length}: "${text.slice(Math.max(0, pos - 25), pos + 25).replace(/\s+/g, " ")}"` : "";
      throw new Error(`That is not valid JSON.${where} The text starts with: "${text.slice(0, 20).replace(/\s+/g, " ")}"`);
    }
    const r = await importChapters(Array.isArray(data) ? (data as ImportChapter[]) : [data as ImportChapter], { subject: str(f, "subject").trim() || undefined, chapter: str(f, "chapter").trim() || undefined, topic: str(f, "topic").trim() || undefined });
    done();
    redirect(`/admin/content?imported=${r.added}&skipped=${r.skipped}&merged=${r.merged}&groups=${r.groups}&explained=${r.explained}`);
  } catch (e) {
    if (e instanceof Error && e.message === "NEXT_REDIRECT") throw e;
    const m = e instanceof Error ? e.message : "Import failed.";
    redirect(`/admin/content?importError=${encodeURIComponent(m.slice(0, 300))}`);
  }
}
