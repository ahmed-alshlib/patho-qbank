"use client";
import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Check, ChevronDown, Clock, GraduationCap, Minus, Play, Shuffle, Timer } from "lucide-react";
import { createSession } from "@/app/actions-session";
import type { Counts, Tree } from "@/lib/sessions";
import { parseTags, sortTags } from "@/lib/tags";

type Pool = "all" | "unanswered" | "incorrect" | "bookmarked" | "answered";
const POOLS: { id: Pool; label: string; idx: number }[] = [
  { id: "all", label: "All questions", idx: 0 }, { id: "unanswered", label: "Unanswered", idx: 1 }, { id: "incorrect", label: "Incorrect", idx: 2 },
  { id: "bookmarked", label: "Bookmarked", idx: 3 }, { id: "answered", label: "Already done", idx: 4 },
];
const MAX = 200;

function Box({ state }: { state: "none" | "some" | "all" }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${state === "none" ? "border-line bg-surface" : "border-brand bg-brand text-white"}`}>
      {state === "all" && <Check className="h-3.5 w-3.5" />}{state === "some" && <Minus className="h-3.5 w-3.5" />}
    </span>
  );
}

export default function NewSessionForm({ tree, counts, initialTopics = [] }: { tree: Tree; counts: Counts; initialTopics?: string[] }) {
  const router = useRouter();
  const [mode, setMode] = useState<"study" | "exam" | null>(null);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialTopics));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pool, setPool] = useState<Pool>("all");
  const [tagSel, setTagSel] = useState<Set<string>>(new Set()); // empty = every question
  const [count, setCount] = useState(20);
  const [randomize, setRandomize] = useState(true);
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(20);
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const idx = POOLS.find((p) => p.id === pool)!.idx;
  const allTags = useMemo(() => {
    const set = new Set<string>(); let none = false;
    for (const byTags of Object.values(counts)) for (const k of Object.keys(byTags)) { const t = parseTags(k); if (t.length) t.forEach((x) => set.add(x)); else none = true; }
    return { list: sortTags([...set]), none };
  }, [counts]);
  const matches = (key: string) => { if (!tagSel.size) return true; const t = parseTags(key); return t.length ? t.some((x) => tagSel.has(x)) : tagSel.has("__none"); };
  const topicAvail = (topicId: string) => Object.entries(counts[topicId] ?? {}).reduce((s, [k, v]) => s + (matches(k) ? v[idx] ?? 0 : 0), 0);
  const available = useMemo(() => [...selected].reduce((s, t) => s + topicAvail(t), 0), [selected, tagSel, pool, counts]); // eslint-disable-line react-hooks/exhaustive-deps
  const effective = Math.max(0, Math.min(count, available, MAX));

  const toggleTopics = (ids: string[], on: boolean) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const stateOf = (ids: string[]) => { const k = ids.filter((id) => selected.has(id)).length; return k === 0 ? "none" : k === ids.length ? "all" : "some"; };
  const toggleSet = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); fn(n); };

  function go() {
    if (!mode) return;
    setError("");
    start(async () => {
      const res = await createSession({ mode, topicIds: [...selected], count: effective, pool, tags: [...tagSel], randomize, timed, minutes });
      if (res.error) setError(res.error); else router.push(`/session/${res.id}`);
    });
  }

  const sectionTitle = "mb-3 flex items-center gap-2 font-display text-xl font-semibold";

  return (
    <div className="space-y-8 pb-32">
      <div><p className="eyebrow">Create session</p><h1 className="mt-1 text-4xl font-semibold">What do you want to do?</h1></div>

      <div className="grid gap-4 sm:grid-cols-2">
        {([["study", "Study mode", "See the correct answer and explanation right after each question. Best for learning.", BookOpenCheck],
           ["exam", "Exam mode", "Answer everything first. Results and explanations come at the end. Optional timer.", GraduationCap]] as const).map(([id, title, text, Icon]) => (
          <button key={id} onClick={() => setMode(id)} className={`card card-hover flex items-start gap-4 text-left ${mode === id ? "!border-brand shadow-glow" : ""}`}>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${mode === id ? "bg-brand text-white" : "bg-brand/10 text-brand"}`}><Icon className="h-6 w-6" /></span>
            <span><span className="block font-display text-xl font-semibold">{title}</span><span className="mt-1 block text-sm text-muted">{text}</span></span>
          </button>
        ))}
      </div>

      {mode && (
        <div className="animate-rise space-y-8">
          <section>
            <h2 className={sectionTitle}>Chapters and topics</h2>
            <div className="space-y-4">
              {tree.subjects.map((sub) => {
                const subIds = sub.chapters.flatMap((c) => c.topics.map((t) => t.id));
                const st = stateOf(subIds);
                return (
                  <div key={sub.id} className="card !p-0">
                    <button className="flex w-full items-center gap-3 border-b border-line p-4 text-left" onClick={() => toggleTopics(subIds, st !== "all")}>
                      <Box state={st} /><span className="font-display text-lg font-semibold">{sub.name}</span>
                      <span className="ml-auto text-xs text-muted">{subIds.reduce((s, id) => s + topicAvail(id), 0)} available</span>
                    </button>
                    <div className="divide-y divide-line">
                      {sub.chapters.map((ch) => {
                        const ids = ch.topics.map((t) => t.id), cs = stateOf(ids), isOpen = open.has(ch.id);
                        return (
                          <div key={ch.id}>
                            <div className="flex items-center gap-3 px-4 py-3">
                              <button onClick={() => toggleTopics(ids, cs !== "all")} className="flex flex-1 items-center gap-3 text-left"><Box state={cs} /><span className="text-sm font-medium">{ch.name}</span></button>
                              <span className="text-xs text-muted">{ids.reduce((s, id) => s + topicAvail(id), 0)}</span>
                              <button aria-label="Show topics" onClick={() => toggleSet(open, ch.id, setOpen)} className="grid h-7 w-7 place-items-center rounded-lg text-muted hover:bg-raised"><ChevronDown className={`h-4 w-4 transition ${isOpen ? "rotate-180" : ""}`} /></button>
                            </div>
                            {isOpen && (
                              <div className="animate-reveal space-y-0.5 bg-raised/40 px-4 py-2 pl-12">
                                {ch.topics.map((tp) => (
                                  <button key={tp.id} onClick={() => toggleTopics([tp.id], !selected.has(tp.id))} className="flex w-full items-center gap-3 rounded-lg px-2 py-2 text-left hover:bg-raised">
                                    <Box state={selected.has(tp.id) ? "all" : "none"} /><span className="text-sm">{tp.name}</span><span className="ml-auto text-xs text-muted">{topicAvail(tp.id)}</span>
                                  </button>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </section>

          <section className="grid gap-6 lg:grid-cols-2">
            <div className="card space-y-5">
              <div>
                <h2 className={sectionTitle}>Question pool</h2>
                <div className="flex flex-wrap gap-2">
                  {POOLS.map((p) => <button key={p.id} onClick={() => setPool(p.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${pool === p.id ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}>{p.label}</button>)}
                </div>
              </div>
              {(allTags.list.length > 0 || allTags.none) && (
                <div>
                  <h2 className={sectionTitle}>Exams and years</h2>
                  <div className="flex flex-wrap gap-2">
                    <button onClick={() => setTagSel(new Set())} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${tagSel.size === 0 ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}>All</button>
                    {allTags.list.map((t) => <button key={t} onClick={() => toggleSet(tagSel, t, setTagSel)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${tagSel.has(t) ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}>{t}</button>)}
                    {allTags.none && <button onClick={() => toggleSet(tagSel, "__none", setTagSel)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${tagSel.has("__none") ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}>No tag</button>}
                  </div>
                  <p className="mt-2 text-xs text-muted">Pick one or more. Nothing picked means all questions.</p>
                </div>
              )}
            </div>

            <div className="card space-y-5">
              <div>
                <h2 className={sectionTitle}>Number of questions</h2>
                <div className="flex items-center gap-4">
                  <input type="range" min={1} max={Math.max(1, Math.min(available, MAX))} value={Math.max(1, effective)} disabled={available === 0}
                    onChange={(e) => setCount(Number(e.target.value))} className="h-2 flex-1 cursor-pointer accent-[rgb(var(--brand))]" />
                  <input type="number" min={1} max={MAX} value={count} onChange={(e) => setCount(Number(e.target.value))} className="input !w-20 text-center" />
                </div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {[10, 20, 40, 100].map((n) => <button key={n} onClick={() => setCount(n)} className="chip hover:text-ink">{n}</button>)}
                  <button onClick={() => setCount(Math.min(available, MAX))} className="chip hover:text-ink">All ({Math.min(available, MAX)})</button>
                </div>
              </div>
              <button onClick={() => setRandomize((r) => !r)} className="flex w-full items-center gap-3 text-left">
                <Shuffle className="h-4 w-4 text-muted" /><span className="flex-1 text-sm font-medium">Randomize question order</span>
                <span className={`relative h-6 w-11 rounded-full transition ${randomize ? "bg-brand" : "bg-raised"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${randomize ? "left-[22px]" : "left-0.5"}`} /></span>
              </button>
              {mode === "exam" && (
                <div className="space-y-3 border-t border-line pt-5">
                  <button onClick={() => { setTimed((t) => !t); setMinutes(Math.max(1, effective)); }} className="flex w-full items-center gap-3 text-left">
                    <Timer className="h-4 w-4 text-muted" /><span className="flex-1 text-sm font-medium">Timed exam</span>
                    <span className={`relative h-6 w-11 rounded-full transition ${timed ? "bg-brand" : "bg-raised"}`}><span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${timed ? "left-[22px]" : "left-0.5"}`} /></span>
                  </button>
                  {timed && (
                    <div className="animate-reveal flex items-center gap-3">
                      <Clock className="h-4 w-4 text-muted" />
                      <input type="number" min={1} max={360} value={minutes} onChange={(e) => setMinutes(Number(e.target.value))} className="input !w-24 text-center" />
                      <span className="text-sm text-muted">minutes{effective > 0 && ` (about ${(minutes / effective).toFixed(1)} min per question)`}</span>
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>
      )}

      {mode && (
        <div className="fixed inset-x-0 bottom-16 z-20 px-4 lg:bottom-4 lg:left-64">
          <div className="mx-auto flex max-w-3xl items-center gap-4 glass-float !rounded-2xl p-3 pl-5">
            <div className="min-w-0 flex-1 text-sm">
              <div className="font-semibold">{effective} question{effective === 1 ? "" : "s"} · {mode === "study" ? "Study mode" : timed ? `Exam · ${minutes} min` : "Exam · untimed"}</div>
              <div className="truncate text-xs text-muted">{error ? <span className="text-bad">{error}</span> : selected.size === 0 ? "Select chapters or topics above" : `${available} available in your selection`}</div>
            </div>
            <button className="btn !px-5 !py-3" disabled={pending || effective === 0} onClick={go}><Play className="h-4 w-4" />{pending ? "Creating…" : "Start"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
