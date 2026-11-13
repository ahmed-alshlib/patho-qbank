"use client";
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Check, ChevronDown, ChevronRight, FileText, Play, Search, Timer, X } from "lucide-react";
import { ProgressRing } from "@/components/ui";

export type SubjectChapter = { id: string; name: string; total: number; completed: number; accuracy: number | null };
export type SubjectCard = { id: string; name: string; total: number; done: number; acc: number | null; nextId: string | null; chapters: SubjectChapter[] };

type Filter = "all" | "progress" | "new" | "done";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "all", label: "All" }, { key: "progress", label: "In progress" }, { key: "new", label: "Not started" }, { key: "done", label: "Done" },
];
const statusOf = (c: SubjectChapter): Exclude<Filter, "all"> => (c.completed === 0 ? "new" : c.completed < c.total ? "progress" : "done");
const pct = (n: number, d: number) => (d ? Math.round((n / d) * 100) : 0);

function Dot({ c }: { c: SubjectChapter }) {
  const s = statusOf(c);
  if (s === "new") return <span className="h-[30px] w-[30px] shrink-0 rounded-full border-2 border-dashed border-ink/15" aria-hidden />;
  if (s === "progress") return <ProgressRing value={pct(c.completed, c.total)} size={30} stroke={4} label="" />;
  return <span className="grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full bg-mint/15 text-brand" aria-hidden><Check className="h-[17px] w-[17px]" strokeWidth={2.6} /></span>;
}

/** Subjects with their chapters: search by chapter name, filter by status, fold a subject away. */
export default function SubjectsClient({ subjects }: { subjects: SubjectCard[] }) {
  const [q, setQ] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  // Everything is open with one or two subjects; with more, only the first starts open.
  const [open, setOpen] = useState<Record<string, boolean>>(() => Object.fromEntries(subjects.map((s, i) => [s.id, subjects.length <= 2 || i === 0])));

  // A link from Home (/subjects#s-<id>) opens that subject and brings it into view.
  useEffect(() => {
    const id = window.location.hash.replace("#s-", "");
    if (!id || !subjects.some((s) => s.id === id)) return;
    setOpen((m) => ({ ...m, [id]: true }));
    const t = setTimeout(() => document.getElementById(`s-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" }), 80);
    return () => clearTimeout(t);
  }, [subjects]);

  const needle = q.trim().toLowerCase();
  const narrowed = !!needle || filter !== "all";
  const shown = useMemo(() => subjects.map((s) => {
    const whole = !!needle && s.name.toLowerCase().includes(needle);
    return { ...s, list: s.chapters.filter((c) => (filter === "all" || statusOf(c) === filter) && (!needle || whole || c.name.toLowerCase().includes(needle))) };
  }).filter((s) => !narrowed || s.list.length > 0), [subjects, needle, filter, narrowed]);

  return (
    <div className="space-y-3 lg:space-y-4">
      <h1 className="text-[30px] font-extrabold leading-[44px] lg:text-[38px] lg:leading-tight">Subjects</h1>

      <label className="flex h-12 items-center gap-2.5 rounded-2xl bg-surface px-3.5 shadow-card transition focus-within:shadow-glow lg:max-w-md">
        <Search className="h-[19px] w-[19px] shrink-0 text-muted" />
        <input type="search" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search chapters" aria-label="Search chapters" data-testid="chapter-search"
          className="min-w-0 flex-1 bg-transparent text-[15px] font-medium outline-none placeholder:font-normal placeholder:text-muted [&::-webkit-search-cancel-button]:hidden" />
        {q && <button onClick={() => setQ("")} aria-label="Clear search" className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-muted transition hover:bg-raised hover:text-ink"><X className="h-4 w-4" /></button>}
      </label>

      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0" role="group" aria-label="Filter chapters">
        {FILTERS.map((f) => <button key={f.key} className="pill" aria-pressed={filter === f.key} onClick={() => setFilter(f.key)} data-testid={`filter-${f.key}`}>{f.label}</button>)}
      </div>

      {shown.length === 0 && <p className="card text-center text-sm text-muted" data-testid="no-match">No chapters match. Try another word or filter.</p>}

      <div className="space-y-2.5 pt-1">
        {shown.map((s) => {
          const isOpen = narrowed || !!open[s.id];
          return (
            <section key={s.id} id={`s-${s.id}`} className="card scroll-mt-24 overflow-hidden !p-0" data-testid="subject-card">
              <button className="flex w-full items-center gap-3.5 py-4 pl-[18px] pr-4 text-left" aria-expanded={isOpen} disabled={narrowed}
                onClick={() => setOpen((m) => ({ ...m, [s.id]: !m[s.id] }))}>
                <ProgressRing value={pct(s.done, s.total)} size={44} stroke={5} />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-display text-[17px] font-bold">{s.name}</span>
                  <span className="mt-0.5 block truncate text-[13px] text-muted">{s.done} of {s.total}{s.acc === null ? " · not started" : ` · ${s.acc}% correct`}</span>
                </span>
                {!narrowed && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-ink/80"><ChevronDown className={`h-[18px] w-[18px] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} /></span>}
              </button>

              <div className={`grid transition-[grid-template-rows] duration-300 ease-out ${isOpen ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`}>
                <div className="min-h-0 overflow-hidden">
                  <div className="flex gap-2 overflow-x-auto px-[18px] pb-3.5 [scrollbar-width:none] [&>*]:shrink-0">
                    {s.nextId && <Link href={`/study/${s.nextId}`} className="inline-flex h-9 items-center gap-1.5 rounded-full bg-mint pl-3 pr-3.5 text-[13px] font-bold text-onmint transition duration-200 active:scale-95"><Play className="h-3.5 w-3.5 fill-current" />Practice</Link>}
                    <Link href="/session/new?mode=exam" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-raised pl-2.5 pr-3.5 text-[13px] font-semibold text-ink/85 transition duration-200 hover:bg-ink/10 active:scale-95"><Timer className="h-4 w-4" />Mock exam</Link>
                    <Link href="/summaries" className="inline-flex h-9 items-center gap-1.5 rounded-full bg-raised pl-2.5 pr-3.5 text-[13px] font-semibold text-ink/85 transition duration-200 hover:bg-ink/10 active:scale-95"><FileText className="h-4 w-4" />Summaries</Link>
                  </div>
                  <div className="border-t border-line">
                    {s.list.map((c, i) => {
                      const st = statusOf(c);
                      return (
                        <Link key={c.id} href={`/study/${c.id}`} data-testid="chapter-row" className="group relative flex min-h-[62px] items-center gap-3.5 py-2.5 pl-[18px] pr-3.5 transition hover:bg-ink/[.04]">
                          {i > 0 && <span className="absolute left-[62px] right-0 top-0 h-px bg-line" aria-hidden />}
                          <Dot c={c} />
                          <span className="min-w-0 flex-1">
                            <span className="block text-[15px] font-semibold leading-snug">{c.name}</span>
                            <span className="mt-0.5 block text-[12.5px] text-muted">
                              {st === "new" ? `${c.total} question${c.total === 1 ? "" : "s"} · not started`
                                : st === "progress" ? <>{c.completed} of {c.total} · <span className="font-semibold text-brand">{c.total - c.completed} left</span></>
                                : <>{c.total} of {c.total} · <span className={c.accuracy !== null && c.accuracy < 70 ? "font-semibold text-warn" : ""}>{c.accuracy}% correct</span></>}
                            </span>
                          </span>
                          {st === "progress"
                            ? <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-mint pl-0.5 text-onmint" aria-hidden><Play className="h-[15px] w-[15px] fill-current" /></span>
                            : <ChevronRight className="h-[18px] w-[18px] shrink-0 text-muted transition group-hover:translate-x-0.5" aria-hidden />}
                        </Link>
                      );
                    })}
                    {s.list.length === 0 && <p className="px-[18px] py-4 text-sm text-muted">No chapters yet.</p>}
                  </div>
                </div>
              </div>
            </section>
          );
        })}
      </div>
    </div>
  );
}
