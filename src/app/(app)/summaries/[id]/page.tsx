import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, Lock } from "lucide-react";
import { requireUser } from "@/lib/auth";
import { getSummary } from "@/lib/summaries";
import RichText from "@/components/RichText";
import { EmptyState } from "@/components/ui";

export const dynamic = "force-dynamic";

export default async function SummaryPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requireUser();
  const { id } = await params;
  const s = await getSummary(user.id, id);
  if (!s) notFound();
  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href="/summaries" className="inline-flex items-center gap-1 text-sm text-muted hover:text-ink"><ArrowLeft className="h-4 w-4" />All summaries</Link>
      <div>
        <p className="eyebrow">{s.subject} · {s.chapter}</p>
        <h1 className="mt-1 text-3xl font-semibold" dir="auto">{s.title}</h1>
      </div>
      {s.open ? (
        <article className="card card-solid !p-6 sm:!p-8"><RichText text={s.body} /></article>
      ) : (
        <EmptyState icon={<Lock className="h-6 w-6" />} title="Subscribe to read this summary" text={`Summaries in ${s.subject} are included with the subject.`}><Link href={`/plans?need=${s.subjectId}`} className="btn mt-2">Subscribe</Link></EmptyState>
      )}
      {s.open && s.siblings.length > 1 && (
        <div className="card space-y-1"><p className="eyebrow mb-1">More in {s.chapter}</p>
          {s.siblings.filter((x) => x.id !== s.id).map((x) => <Link key={x.id} href={`/summaries/${x.id}`} className="block rounded-lg px-2 py-2 text-sm hover:bg-raised">{x.title}</Link>)}
        </div>
      )}
    </div>
  );
}
