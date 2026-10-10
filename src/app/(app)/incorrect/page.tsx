import { getUser, requireUser } from "@/lib/auth";
import { getReviewItems } from "@/lib/questions";
import ReviewList from "@/components/ReviewList";

export const dynamic = "force-dynamic";

export default async function Page({ searchParams }: { searchParams: Promise<{ q?: string; subject?: string }> }) {
  const { q, subject } = await searchParams;
  const user = (await requireUser());
  const { items, subjects } = await getReviewItems(user.id, "incorrect", { q, subjectId: subject });
  return <ReviewList kind="incorrect" items={items} subjects={subjects} q={q} subjectId={subject} />;
}
