import Link from "next/link";
import { BookOpen } from "lucide-react";
import { accessibleSubjectIds } from "@/lib/access";
import { requireUser } from "@/lib/auth";
import { getChapterStats } from "@/lib/stats";
import { EmptyState } from "@/components/ui";
import SubjectsClient, { type SubjectCard } from "@/components/SubjectsClient";

export const dynamic = "force-dynamic";

export default async function Subjects() {
  const user = (await requireUser());
  const allowed = await accessibleSubjectIds(user.id);
  // Only the subjects this student has an active subscription for. Everything else is on the Subscriptions page.
  const stats = (await getChapterStats(user.id)).filter((c) => allowed.has(c.subjectId));
  const subjects: SubjectCard[] = [...new Map(stats.map((c) => [c.subjectId, c.subjectName])).entries()].map(([id, name]) => {
    const chapters = stats.filter((c) => c.subjectId === id);
    const total = chapters.reduce((s, c) => s + c.total, 0), done = chapters.reduce((s, c) => s + c.completed, 0);
    const right = chapters.reduce((s, c) => s + c.correct, 0);
    const next = chapters.find((c) => c.completed > 0 && c.completed < c.total) ?? chapters.find((c) => c.completed < c.total) ?? chapters[0];
    return {
      id, name, total, done, acc: done ? Math.round((right / done) * 100) : null, nextId: next?.id ?? null,
      chapters: chapters.map((c) => ({ id: c.id, name: c.name, total: c.total, completed: c.completed, accuracy: c.accuracy })),
    };
  });

  if (subjects.length === 0)
    return (
      <div className="space-y-4">
        <h1 className="text-[30px] font-extrabold leading-[44px] lg:text-[38px]">Subjects</h1>
        <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No active subjects yet" text="Subscribe to a subject to see its chapters and start practising.">
          <Link href="/plans" className="btn mt-2">Browse subscriptions</Link>
        </EmptyState>
      </div>
    );
  return <SubjectsClient subjects={subjects} />;
}
