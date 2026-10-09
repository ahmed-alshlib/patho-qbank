import { getUser } from "@/lib/auth";
import { getSessionTree } from "@/lib/sessions";
import NewSessionForm from "@/components/NewSessionForm";
import { EmptyState } from "@/components/ui";
import { Lock } from "lucide-react";
import Link from "next/link";

export const dynamic = "force-dynamic";

export default async function NewSession() {
  const user = (await getUser())!;
  const { tree, counts } = await getSessionTree(user.id);
  if (!tree.subjects.length) return <EmptyState icon={<Lock className="h-6 w-6" />} title="No subjects unlocked" text="Subscribe to a subject to create study and exam sessions."><Link href="/plans" className="btn mt-2">Choose subjects</Link></EmptyState>;
  return <NewSessionForm tree={tree} counts={counts} />;
}
