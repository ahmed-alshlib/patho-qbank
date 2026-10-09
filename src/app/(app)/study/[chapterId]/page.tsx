import { notFound } from "next/navigation";
import { eq } from "drizzle-orm";
import { db, chapters, subjects } from "@/db";
import { getUser } from "@/lib/auth";
import { loadStudyQuestions } from "@/lib/questions";
import StudyClient from "@/components/StudyClient";
import { EmptyState } from "@/components/ui";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function StudyPage({ params }: { params: Promise<{ chapterId: string }> }) {
  const { chapterId } = await params;
  const user = (await getUser())!;
  const [ch] = await db.select({ id: chapters.id, name: chapters.name, subject: subjects.name })
    .from(chapters).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(eq(chapters.id, chapterId)).limit(1);
  if (!ch) notFound();

  const data = await loadStudyQuestions(user.id, { chapterId });
  if (!data.length) return <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No questions yet" text="This chapter has no questions yet." />;
  const first = data.findIndex((q) => !q.previous);
  return <StudyClient questions={data} startAt={first === -1 ? 0 : first} title={`${ch.subject} · ${ch.name}`} backHref="/subjects" backLabel="All chapters" />;
}
