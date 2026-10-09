import { notFound, redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { loadStudyQuestions } from "@/lib/questions";
import { getTest, getTestQuestionIds } from "@/lib/sessions";
import StudyClient from "@/components/StudyClient";
import ExamClient from "@/components/ExamClient";

export const dynamic = "force-dynamic";

export default async function SessionPage({ params }: { params: Promise<{ testId: string }> }) {
  const { testId } = await params;
  const user = (await getUser())!;
  const t = await getTest(user.id, testId);
  if (!t) notFound();
  if (t.finishedAt) redirect(`/results/${testId}`);

  const exam = t.mode === "exam";
  const ids = await getTestQuestionIds(testId);
  const data = await loadStudyQuestions(user.id, { ids, testId, exam });
  if (!data.length) notFound();

  if (exam) {
    const remaining = t.timed && t.timeLimitSec ? Math.max(0, t.timeLimitSec - Math.floor((Date.now() - t.startedAt.getTime()) / 1000)) : null;
    const first = data.findIndex((q) => !q.selected);
    return <ExamClient testId={testId} questions={data} startAt={first === -1 ? 0 : first} remainingSec={remaining} />;
  }
  const first = data.findIndex((q) => !q.previous);
  return <StudyClient testId={testId} questions={data} startAt={first === -1 ? 0 : first} title="Study session" backHref="/history" backLabel="History" />;
}
