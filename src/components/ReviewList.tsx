import Link from "next/link";
import { ArrowRight, Bookmark, Highlighter, Play, RotateCcw, Search, StickyNote, Trash2 } from "lucide-react";
import type { ReviewItem, ReviewKind } from "@/lib/questions";
import { removeFromReview } from "@/app/actions-study";
import { EmptyState } from "@/components/ui";

const COPY = {
  bookmarks: { title: "Saved", eyebrow: "Saved for later", icon: Bookmark, empty: "Tap the bookmark on any question to save it here." },
  incorrect: { title: "Mistakes", eyebrow: "To review", icon: RotateCcw, empty: "No mistakes to review. Nicely done. Any question you miss will appear here until you answer it correctly." },
  notes: { title: "Notes & highlights", eyebrow: "Your annotations", icon: StickyNote, empty: "Select text in a question to highlight it, or open the note icon to write one." },
} as const;

export default function ReviewList({ kind, items, subjects, q, subjectId }: {
  kind: ReviewKind; items: ReviewItem[]; subjects: { id: string; name: string }[]; q?: string; subjectId?: string;
}) {
  const c = COPY[kind];
  const Icon = c.icon;
  const filtered = !!(q || subjectId);
  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div><p className="eyebrow">{c.eyebrow}</p><h1 className="mt-1 text-[30px] font-extrabold leading-tight lg:text-[38px]">{c.title}</h1></div>
        {items.length > 0 && <Link href={`/practice/${kind}`} className="btn"><Play className="h-4 w-4" />{kind === "incorrect" ? "Retry all" : "Practice all"} ({items.length})</Link>}
      </div>

      <form className="flex flex-col gap-2 sm:flex-row" action={`/${kind}`}>
        <div className="relative flex-1"><Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" /><input name="q" defaultValue={q} placeholder="Search questions, notes, topics…" className="input !pl-10" /></div>
        <select name="subject" defaultValue={subjectId ?? ""} className="input sm:w-48"><option value="">All subjects</option>{subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select>
        <button className="btn-ghost">Filter</button>
        {filtered && <Link href={`/${kind}`} className="btn-ghost">Clear</Link>}
      </form>

      {items.length === 0 ? (
        <EmptyState icon={<Icon className="h-6 w-6" />} title={filtered ? "No matches" : "Nothing here yet"} text={filtered ? "Try a different search or subject." : c.empty} />
      ) : (
        <div className="stagger space-y-3">
          {items.map((it) => (
            <div key={it.id} className="card card-hover group !rounded-[22px] !p-[18px]">
              <div className="mb-2 flex flex-wrap items-center gap-1.5">
                <span className="chip">{it.subject} · {it.chapter}</span>
                <span className="chip">{it.topic}</span>
                {it.bookmarked && kind !== "bookmarks" && <span className="chip !text-brand"><Bookmark className="h-3 w-3 fill-current" />Saved</span>}
                {it.highlightCount > 0 && <span className="chip"><Highlighter className="h-3 w-3" />{it.highlightCount}</span>}
              </div>
              <p className="line-clamp-2 text-[15px] leading-relaxed">{it.text}</p>
              {kind === "notes" && it.note && <p className="mt-3 line-clamp-3 rounded-2xl bg-raised px-3.5 py-2.5 text-sm text-ink/85">{it.note}</p>}
              <div className="mt-4 flex items-center justify-between gap-2">
                <Link href={`/practice/${kind}?start=${it.id}`} className="inline-flex items-center gap-1.5 text-sm font-semibold text-brand">{kind === "incorrect" ? "Retry" : "Open"}<ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>
                {kind !== "incorrect" && (
                  <form action={removeFromReview}>
                    <input type="hidden" name="kind" value={kind} /><input type="hidden" name="questionId" value={it.id} />
                    <button className="btn-ghost !px-3 !py-1.5 text-xs text-muted hover:!text-bad"><Trash2 className="h-3.5 w-3.5" />Remove</button>
                  </form>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
