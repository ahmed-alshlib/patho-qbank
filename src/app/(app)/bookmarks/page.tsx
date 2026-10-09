import { getUser } from "@/lib/auth";
import { getReviewItems } from "@/lib/questions";
import ReviewList from "@/components/ReviewList";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string }> }) {
  const { q, subject } = await searchParams;
  const user = (await getUser())!;
  const { items, subjects } = await getReviewItems(user.id, "bookmarks", { q, subjectId: subject });
  return <ReviewList kind="bookmarks" items={items} subjects={subjects} q={q} subjectId={subject} />;
}
