"use server";
import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { db, users, answerChoices, questions, userAnswers, bookmarks, notes, highlights, reportedQuestions } from "@/db";
import { getUser } from "@/lib/auth";
import type { Reveal } from "@/lib/questions";
import { assertQuestionAccess } from "@/lib/access";
import { peerStats } from "@/lib/peers";

async function me() {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");
  return user;
}

/** Grades on the server so correct answers are never sent to the browser before a student answers. */
export async function submitAnswer(questionId: string, choiceId: string, timeSpentSec: number): Promise<Reveal> {
  const user = await me();
  await assertQuestionAccess(user.id, questionId);
  const [q] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (!q) throw new Error("Question not found");
  const choices = await db.select().from(answerChoices).where(eq(answerChoices.questionId, questionId));
  const picked = choices.find((c) => c.id === choiceId);
  // A question may accept more than one option, so every correct one is sent back.
  const correct = choices.filter((c) => c.isCorrect);
  if (!picked || !correct.length) throw new Error("Invalid choice");
  await db.insert(userAnswers).values({
    userId: user.id, questionId, choiceId, isCorrect: picked.isCorrect,
    timeSpentSec: Math.max(0, Math.min(3600, Math.round(timeSpentSec))),
  });
  const peers = (await peerStats([questionId])).get(questionId) ?? null;
  return { choiceId, isCorrect: picked.isCorrect, correctChoiceIds: correct.map((c) => c.id), explanation: q.explanation, peers };
}

export async function toggleBookmark(questionId: string): Promise<boolean> {
  const user = await me();
  const where = and(eq(bookmarks.userId, user.id), eq(bookmarks.questionId, questionId));
  const [existing] = await db.select({ id: bookmarks.id }).from(bookmarks).where(where).limit(1);
  if (existing) { await db.delete(bookmarks).where(where); return false; }
  await db.insert(bookmarks).values({ userId: user.id, questionId }).onConflictDoNothing();
  return true;
}

export async function saveNote(questionId: string, body: string) {
  const user = await me();
  const text = body.slice(0, 5000);
  if (!text.trim()) {
    await db.delete(notes).where(and(eq(notes.userId, user.id), eq(notes.questionId, questionId)));
    return;
  }
  await db.insert(notes).values({ userId: user.id, questionId, body: text })
    .onConflictDoUpdate({ target: [notes.userId, notes.questionId], set: { body: text, updatedAt: new Date() } });
}

export async function addHighlight(questionId: string, target: "explanation", start: number, end: number): Promise<string> {
  const user = await me();
  // Only explanation highlights are saved; highlights on the question text stay in the browser.
  if (target !== "explanation" || !Number.isInteger(start) || !Number.isInteger(end) || start < 0 || end <= start || end > 20000)
    throw new Error("Invalid highlight");
  const [h] = await db.insert(highlights).values({ userId: user.id, questionId, target, start, end }).returning({ id: highlights.id });
  return h.id;
}

export async function removeHighlights(ids: string[]) {
  const user = await me();
  for (const id of ids.slice(0, 50)) await db.delete(highlights).where(and(eq(highlights.id, id), eq(highlights.userId, user.id)));
}

export async function reportQuestion(questionId: string, reason: string) {
  const user = await me();
  const text = reason.trim().slice(0, 1000);
  if (!text) throw new Error("Please describe the problem");
  await db.insert(reportedQuestions).values({ userId: user.id, questionId, reason: text });
}

/** Used by the Review pages' "Remove" buttons. */
export async function removeFromReview(formData: FormData) {
  const user = await me();
  const kind = String(formData.get("kind"));
  const questionId = String(formData.get("questionId"));
  if (kind === "bookmarks") await db.delete(bookmarks).where(and(eq(bookmarks.userId, user.id), eq(bookmarks.questionId, questionId)));
  if (kind === "notes") {
    await db.delete(notes).where(and(eq(notes.userId, user.id), eq(notes.questionId, questionId)));
    await db.delete(highlights).where(and(eq(highlights.userId, user.id), eq(highlights.questionId, questionId)));
  }
  revalidatePath("/bookmarks"); revalidatePath("/notes"); revalidatePath("/incorrect");
}

export async function setDailyGoal(formData: FormData) {
  const user = await me();
  const n = Math.floor(Number(formData.get("goal")));
  if (![5, 10, 20, 30, 50, 100].includes(n)) return;
  await db.update(users).set({ dailyGoal: n }).where(eq(users.id, user.id));
  revalidatePath("/");
}
