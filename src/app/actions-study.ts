"use server";
import { eq } from "drizzle-orm";
import { db, answerChoices, questions, userAnswers } from "@/db";
import { getUser } from "@/lib/auth";

export type Reveal = { choiceId: string; isCorrect: boolean; correctChoiceId: string; explanation: string };

/** Grades on the server so correct answers are never sent to the browser before a student answers. */
export async function submitAnswer(questionId: string, choiceId: string, timeSpentSec: number): Promise<Reveal> {
  const user = await getUser();
  if (!user) throw new Error("Not signed in");

  const [q] = await db.select().from(questions).where(eq(questions.id, questionId)).limit(1);
  if (!q) throw new Error("Question not found");
  const choices = await db.select().from(answerChoices).where(eq(answerChoices.questionId, questionId));
  const picked = choices.find((c) => c.id === choiceId);
  const correct = choices.find((c) => c.isCorrect);
  if (!picked || !correct) throw new Error("Invalid choice");

  await db.insert(userAnswers).values({
    userId: user.id, questionId, choiceId, isCorrect: picked.isCorrect,
    timeSpentSec: Math.max(0, Math.min(3600, Math.round(timeSpentSec))),
  });

  return { choiceId, isCorrect: picked.isCorrect, correctChoiceId: correct.id, explanation: q.explanation };
}
