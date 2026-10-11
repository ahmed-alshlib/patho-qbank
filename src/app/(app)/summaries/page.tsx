import Link from "next/link";
import { FileText, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { listSummaryGroups } from "@/lib/summaries";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function Summaries() {
  const user = await requireUser();
  const groups = await listSummaryGroups(user.id);
  return (
    <div className="space-y-10">
      <div><p className="eyebrow">Study notes</p><h1 className="mt-1 text-4xl font-semibold">Summaries</h1></div>
      {groups.length === 0 && <EmptyState icon={<FileText className="h-6 w-6" />} title="No summaries yet" text="Chapter summaries will appear here once they are added." />}
      {groups.map((g) => (
        <section key={g.subjectId} className="space-y-4">
          <div className="flex items-end justify-between border-b border-line pb-3">
            <h2 className="flex items-center gap-2 text-2xl font-semibold">{g.subject}{!g.open && <Lock className="h-5 w-5 text-muted" />}</h2>
            {!g.open && <Link href={`/plans?need=${g.subjectId}`} className="btn !py-2 text-xs">Subscribe</Link>}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {g.chapters.map((c) => (
              <div key={c.id} className="card space-y-2">
                <h3 className="font-display text-lg font-semibold">{c.name}</h3>
                <div className="space-y-1">
                  {c.items.map((it) => (
                    <Link key={it.id} href={`/summaries/${it.id}`} className="flex items-center gap-2 rounded-lg px-2 py-2 text-sm transition hover:bg-raised">
                      <FileText className="h-4 w-4 shrink-0 text-brand" /><span className="flex-1">{it.title}</span>{!g.open && <Lock className="h-3.5 w-3.5 text-muted" />}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}
