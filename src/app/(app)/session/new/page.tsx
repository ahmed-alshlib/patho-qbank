import { getUser } from "@/lib/auth";
import { getSessionTree } from "@/lib/sessions";
import NewSessionForm from "@/components/NewSessionForm";
import { EmptyState } from "@/components/ui";
import { BookOpen } from "lucide-react";

export const dynamic = "force-dynamic";

export default async function NewSession() {
  const user = (await getUser())!;
  const { tree, counts } = await getSessionTree(user.id);
  if (!tree.subjects.length) return <EmptyState icon={<BookOpen className="h-6 w-6" />} title="No content yet" text="Questions will appear here once they are loaded." />;
  return <NewSessionForm tree={tree} counts={counts} />;
}
