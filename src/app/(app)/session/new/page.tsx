import { getUser, requireUser } from "@/lib/auth";
import { getSessionTree } from "@/lib/sessions";
import NewSessionForm from "@/components/NewSessionForm";
import { EmptyState } from "@/components/ui";
import { Lock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewSession({ searchParams }: { searchParams: Promise<{ topics?: string; mode?: string }> }) {
  const sp = await searchParams;
  const user = (await requireUser());
  const { tree, counts } = await getSessionTree(user.id);
  if (!tree.subjects.length) return <EmptyState icon={<Lock className="h-6 w-6" />} title="No subjects unlocked" text="Subscribe to a subject to create study and exam sessions."><Link href="/plans" className="btn mt-2">Choose subjects</Link></EmptyState>;
  const valid = new Set(tree.subjects.flatMap((x) => x.chapters.flatMap((c) => c.topics.map((t) => t.id))));
  const initialTopics = (sp.topics ?? "").split(",").filter((id) => valid.has(id));
  const initialMode = sp.mode === "exam" || sp.mode === "study" ? sp.mode : null;
  return <NewSessionForm tree={tree} counts={counts} initialTopics={initialTopics} initialMode={initialMode} />;
}
