import { notFound } from "next/navigation";
import { CircleX, Star, StickyNote } from "lucide-react";
import { getUser } from "@/lib/auth";
import { loadStudyQuestions, reviewIds, type ReviewKind } from "@/lib/questions";
import StudyClient from "@/components/StudyClient";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

const META: Record<ReviewKind, { title: string; back: string; label: string }> = {
  incorrect: { title: "Retry incorrect questions", back: "/incorrect", label: "Incorrect" },
  bookmarks: { title: "Bookmarked questions", back: "/bookmarks", label: "Bookmarks" },
  notes: { title: "Questions with notes & highlights", back: "/notes", label: "Notes & highlights" },
};

export default async function Practice({ params, searchParams }: { params: Promise<{ source: string }>; searchParams: Promise<{ start?: string }> }) {
  const { source } = await params;
  const { start } = await searchParams;
  if (!(source in META)) notFound();
  const kind = source as ReviewKind, meta = META[kind];
  const user = (await getUser())!;
  const ids = await reviewIds(user.id, kind);
  const data = await loadStudyQuestions(user.id, { ids });
  if (!data.length)
    return <EmptyState icon={kind === "incorrect" ? <CircleX className="h-6 w-6" /> : kind === "bookmarks" ? <Star className="h-6 w-6" /> : <StickyNote className="h-6 w-6" />} title="Nothing here" text="There are no questions in this list right now." />;
  const startAt = Math.max(0, data.findIndex((q) => q.id === start));
  return <StudyClient questions={data} startAt={startAt} title={meta.title} backHref={meta.back} backLabel={meta.label} fresh={kind === "incorrect"} />;
}
