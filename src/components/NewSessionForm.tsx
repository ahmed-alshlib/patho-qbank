"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { BookOpenCheck, Check, ChevronDown, Clock, GraduationCap, Minus, Play, Plus, Shuffle, Timer } from "lucide-react";
import { createSession } from "@/app/actions-session";
import type { Counts, Tree } from "@/lib/sessions";
import { parseTags, sortTags } from "@/lib/tags";

type Pool = "all" | "unanswered" | "incorrect" | "bookmarked" | "answered";
const POOLS: { id: Pool; label: string; idx: number }[] = [
  { id: "all", label: "All questions", idx: 0 }, { id: "unanswered", label: "Unanswered", idx: 1 }, { id: "incorrect", label: "Incorrect", idx: 2 },
  { id: "bookmarked", label: "Bookmarked", idx: 3 }, { id: "answered", label: "Already done", idx: 4 },
];
const MAX = 200;
/** Mock exam presets: total questions spread evenly over the chapters, and the time. */
const PRESETS = [{ id: "p20", q: 20, min: 30 }, { id: "p50", q: 50, min: 60 }] as const;

function Box({ state }: { state: "none" | "some" | "all" }) {
  return (
    <span className={`grid h-5 w-5 shrink-0 place-items-center rounded-md border transition ${state === "none" ? "border-line bg-surface" : "border-brand bg-brand text-white"}`}>
      {state === "all" && <Check className="h-3.5 w-3.5" />}{state === "some" && <Minus className="h-3.5 w-3.5" />}
    </span>
  );
}

export default function NewSessionForm({ tree, counts, initialTopics = [], initialMode = null }: { tree: Tree; counts: Counts; initialTopics?: string[]; initialMode?: "study" | "exam" | null }) {
  const router = useRouter();
  const [mode, setMode] = useState<"study" | "exam" | null>(initialMode);
  const [selected, setSelected] = useState<Set<string>>(new Set(initialTopics));
  const [open, setOpen] = useState<Set<string>>(new Set());
  const [pool, setPool] = useState<Pool>("all");
  const [tagSel, setTagSel] = useState<Set<string>>(new Set()); // keys are "subjectId::tag"; empty = every question
  const [count, setCount] = useState(20);
  const [randomize, setRandomize] = useState(true);
  const [timed, setTimed] = useState(false);
  const [minutes, setMinutes] = useState(20);
  const [perCh, setPerCh] = useState<Record<string, number>>({}); // mock exam: chapterId → questions wanted
  const [mockMin, setMockMin] = useState(30);
  const [preset, setPreset] = useState<string>("p20");
  const [error, setError] = useState("");
  const [pending, start] = useTransition();

  const idx = POOLS.find((p) => p.id === pool)!.idx;
  const subjectOf = useMemo(() => {
    const m: Record<string, string> = {};
    for (const s of tree.subjects) for (const c of s.chapters) for (const t of c.topics) m[t.id] = s.id;
    return m;
  }, [tree]);
  // Exams are offered only for the chapters picked above, grouped by subject, so one subject's
  // papers never crowd out another's and a choice in one subject never filters the others.
  // In a mock exam the chapters are chosen by count, so every chapter's exams are offered.
  const scope = useMemo(() => mode === "exam" ? new Set(tree.subjects.flatMap((s) => s.chapters.flatMap((c) => c.topics.map((t) => t.id)))) : selected, [mode, tree, selected]);
  const groups = useMemo(() => {
    return tree.subjects.flatMap((s) => {
      const tally = new Map<string, number>(); let none = 0;
      for (const c of s.chapters) for (const tp of c.topics) {
        if (!scope.has(tp.id)) continue;
        for (const [k, v] of Object.entries(counts[tp.id] ?? {})) {
          const t = parseTags(k), n = v[idx] ?? 0;
          if (t.length) t.forEach((x) => tally.set(x, (tally.get(x) ?? 0) + n)); else none += n;
        }
      }
      if (!tally.size) return [];
      return [{ id: s.id, name: s.name, tags: sortTags([...tally.keys()]).map((t) => ({ t, n: tally.get(t)! })), none }];
    });
  }, [tree, scope, counts, idx]);
  // Picks that no longer apply (their chapter was unticked) are ignored rather than silently filtering.
  const active = useMemo(() => {
    const ok = new Set<string>();
    for (const g of groups) { g.tags.forEach(({ t }) => ok.add(`${g.id}::${t}`)); if (g.none) ok.add(`${g.id}::__none`); }
    return new Set([...tagSel].filter((k) => ok.has(k)));
  }, [groups, tagSel]);
  const wantBySubject = useMemo(() => {
    const m = new Map<string, Set<string>>();
    for (const k of active) { const i = k.indexOf("::"), sid = k.slice(0, i); const set = m.get(sid) ?? new Set<string>(); set.add(k.slice(i + 2)); m.set(sid, set); }
    return m;
  }, [active]);
  const matches = (topicId: string, key: string) => {
    const want = wantBySubject.get(subjectOf[topicId]);
    if (!want) return true;
    const t = parseTags(key);
    return t.length ? t.some((x) => want.has(x)) : want.has("__none");
  };
  const topicAvail = (topicId: string) => Object.entries(counts[topicId] ?? {}).reduce((s, [k, v]) => s + (matches(topicId, k) ? v[idx] ?? 0 : 0), 0);
  const clearSubject = (sid: string) => setTagSel((prev) => new Set([...prev].filter((k) => !k.startsWith(`${sid}::`))));
  const available = useMemo(() => [...selected].reduce((s, t) => s + topicAvail(t), 0), [selected, wantBySubject, pool, counts]); // eslint-disable-line react-hooks/exhaustive-deps
  const effective = Math.max(0, Math.min(count, available, MAX));

  // Mock exam: each chapter's count is capped by what is available under the current pool and exam picks.
  const chAvail = (ch: { topics: { id: string }[] }) => ch.topics.reduce((s, t) => s + topicAvail(t.id), 0);
  const allChapters = tree.subjects.flatMap((s) => s.chapters);
  const mockPlan = Object.fromEntries(allChapters.map((c) => [c.id, Math.min(perCh[c.id] ?? 0, chAvail(c))]).filter(([, n]) => (n as number) > 0)) as Record<string, number>;
  const mockTotal = Math.min(MAX, Object.values(mockPlan).reduce((a, b) => a + b, 0));
  const bump = (id: string, d: number, cap: number) => { setPreset("custom"); setPerCh((p) => ({ ...p, [id]: Math.max(0, Math.min(cap, Math.min(p[id] ?? 0, cap) + d)) })); };
  // A preset goes to the subjects already in the exam, or the first subject when nothing is picked yet.
  const applyPreset = (pr: (typeof PRESETS)[number]) => {
    const inUse = tree.subjects.filter((sub) => sub.chapters.some((c) => (perCh[c.id] ?? 0) > 0));
    const targets = inUse.length ? inUse : tree.subjects.slice(0, 1);
    spread(targets.flatMap((sub) => sub.chapters), pr.q);
    setMockMin(pr.min); setPreset(pr.id);
  };
  useEffect(() => {
    if (mode === "exam" && !Object.values(perCh).some((n) => n > 0)) applyPreset(PRESETS[0]);
  }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  const spread = (chs: { id: string; topics: { id: string }[] }[], total: number) => {
    const list = chs.map((c) => ({ id: c.id, cap: chAvail(c), n: 0 })).filter((c) => c.cap > 0);
    let left = total;
    while (left > 0 && list.some((c) => c.n < c.cap)) for (const c of list) { if (left <= 0) break; if (c.n < c.cap) { c.n++; left--; } }
    setPerCh((p) => { const n = { ...p }; chs.forEach((c) => { n[c.id] = 0; }); list.forEach((c) => { n[c.id] = c.n; }); return n; });
  };

  const toggleTopics = (ids: string[], on: boolean) => setSelected((prev) => { const n = new Set(prev); ids.forEach((id) => (on ? n.add(id) : n.delete(id))); return n; });
  const stateOf = (ids: string[]) => { const k = ids.filter((id) => selected.has(id)).length; return k === 0 ? "none" : k === ids.length ? "all" : "some"; };
  const toggleSet = (set: Set<string>, v: string, fn: (s: Set<string>) => void) => { const n = new Set(set); n.has(v) ? n.delete(v) : n.add(v); fn(n); };

  function go() {
    if (!mode) return;
    setError("");
    start(async () => {
      const res = mode === "exam"
        ? await createSession({ mode, topicIds: allChapters.filter((c) => mockPlan[c.id]).flatMap((c) => c.topics.map((t) => t.id)), count: mockTotal, pool, tags: [...active], randomize: true, timed: true, minutes: mockMin, perChapter: mockPlan })
        : await createSession({ mode, topicIds: [...selected], count: effective, pool, tags: [...active], randomize, timed, minutes });
      if (res.error) setError(res.error); else router.push(`/session/${res.id}`);
    });
  }

  const sectionTitle = "mb-3 flex items-center gap-2 font-display text-xl font-semibold";

  return (
    <div className="space-y-8 pb-48 lg:pb-32">
      <div><p className="eyebrow">Create session</p><h1 className="mt-1 text-4xl font-semibold">What do you want to do?</h1></div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {([["study", "Study mode", "See the correct answer and explanation right after each question. Best for learning.", BookOpenCheck],
           ["exam", "Mock exam", "Build your own exam: how many questions from each chapter, and the time. Answers and explanations at the end.", GraduationCap]] as const).map(([id, title, text, Icon]) => (
          <button key={id} onClick={() => setMode(id)} className={`card card-hover flex items-start gap-4 text-left ${mode === id ? "!border-brand shadow-glow" : ""}`}>
            <span className={`grid h-12 w-12 shrink-0 place-items-center rounded-2xl ${mode === id ? "bg-brand text-white" : "bg-brand/10 text-brand"}`}><Icon className="h-6 w-6" /></span>
            <span><span className="block font-display text-xl font-semibold">{title}</span><span className="mt-1 block text-sm text-muted">{text}</span></span>
          </button>
        ))}
      </div>

      {mode && (
        <div className="animate-rise space-y-8">
          {mode === "exam" && (
            <section data-testid="mock-chapters">
              <h2 className={sectionTitle}>Start from</h2>
              <div className="mb-6 grid grid-cols-3 gap-2.5" data-testid="mock-presets">
                {[...PRESETS.map((pr) => ({ id: pr.id, top: `${pr.q} questions`, sub: `${pr.min} min`, on: () => applyPreset(pr) })), { id: "custom", top: "Custom", sub: "Your own mix", on: () => setPreset("custom") }].map((b) => (
                  <button key={b.id} onClick={b.on} className={`flex h-16 flex-col items-center justify-center rounded-2xl border transition ${preset === b.id ? "border-brand bg-brand text-white shadow-glow" : "border-line bg-surface text-ink hover:border-brand/50"}`}>
                    <span className="text-sm font-bold">{b.top}</span><span className={`text-xs ${preset === b.id ? "text-white/80" : "text-muted"}`}>{b.sub}</span>
                  </button>
                ))}
              </div>
              <h2 className={sectionTitle}>Questions per chapter</h2>
              <div className="space-y-4">
                {tree.subjects.map((sub) => {
                  const subTotal = sub.chapters.reduce((s, c) => s + (mockPlan[c.id] ?? 0), 0);
                  return (
                    <div key={sub.id} className="card !p-0">
                      <div className="flex flex-wrap items-center gap-2 border-b border-line p-4">
                        <span className="font-display text-lg font-semibold">{sub.name}</span>
                        {subTotal > 0 && <span className="chip !text-brand">{subTotal} Q</span>}
                        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-muted">Spread evenly:
                          {[10, 20, 40, 50].map((n) => <button key={n} onClick={() => { setPreset("custom"); spread(sub.chapters, n); }} className="chip hover:text-ink">{n}</button>)}
                          {subTotal > 0 && <button onClick={() => { setPreset("custom"); spread(sub.chapters, 0); }} className="chip hover:text-ink">Clear</button>}
                        </span>
                      </div>
                      <div className="divide-y divide-line">
                        {sub.chapters.map((ch) => {
                          const cap = chAvail(ch), n = Math.min(perCh[ch.id] ?? 0, cap);
                          return (
                            <div key={ch.id} className="flex items-center gap-3 px-4 py-2.5" data-testid={`mock-ch-${ch.name}`}>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-sm font-medium">{ch.name}</div>
                                <div className="text-xs text-muted">{cap} available</div>
                              </div>
                              <button aria-label={`Fewer from ${ch.name}`} disabled={n <= 0} onClick={() => bump(ch.id, -1, cap)} className="btn-ghost h-10 w-10 shrink-0 !p-0"><Minus className="h-4 w-4" /></button>
                              <input aria-label={`Questions from ${ch.name}`} inputMode="numeric" value={n} onChange={(e) => { setPreset("custom"); setPerCh((p) => ({ ...p, [ch.id]: Math.max(0, Math.min(cap, Number(e.target.value.replace(/\D/g, "")) || 0)) })); }}
                                className={`input !h-10 !w-14 !px-1 text-center text-base font-bold tabular-nums ${n ? "" : "text-muted"}`} />
                              <button aria-label={`More from ${ch.name}`} disabled={n >= cap} onClick={() => bump(ch.id, 1, cap)} className="btn-ghost h-10 w-10 shrink-0 !p-0"><Plus className="h-4 w-4" /></button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          )}
          {mode === "study" && <section>
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
          </section>}

          <section className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div className="card space-y-5">
              <div>
                <h2 className={sectionTitle}>Question pool</h2>
                <div className="flex flex-wrap gap-2">
                  {POOLS.map((p) => <button key={p.id} onClick={() => setPool(p.id)} className={`rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${pool === p.id ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`}>{p.label}</button>)}
                </div>
              </div>
              <div data-testid="exam-filter">
                <h2 className={sectionTitle}>Exams and years</h2>
                {scope.size === 0 ? (
                  <p className="text-sm text-muted">Choose chapters above, then narrow them to the exams their questions came from.</p>
                ) : groups.length === 0 ? (
                  <p className="text-sm text-muted">The chapters you chose have no exam tags yet.</p>
                ) : (
                  <div className="space-y-4">
                    {groups.map((g) => {
                      const chip = (on: boolean) => `rounded-full border px-3.5 py-1.5 text-sm font-medium transition ${on ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`;
                      const none = !wantBySubject.has(g.id);
                      return (
                        <div key={g.id} data-testid={`exam-group-${g.name}`}>
                          {groups.length > 1 && <p className="mb-2 text-sm font-semibold">{g.name}</p>}
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => clearSubject(g.id)} className={chip(none)}>All</button>
                            {g.tags.map(({ t, n }) => {
                              const k = `${g.id}::${t}`;
                              return <button key={k} onClick={() => toggleSet(tagSel, k, setTagSel)} className={chip(active.has(k))}>{t} <span className="ml-1 opacity-60">{n}</span></button>;
                            })}
                            {g.none > 0 && <button onClick={() => toggleSet(tagSel, `${g.id}::__none`, setTagSel)} className={chip(active.has(`${g.id}::__none`))}>No tag <span className="ml-1 opacity-60">{g.none}</span></button>}
                          </div>
                        </div>
                      );
                    })}
                    <p className="text-xs text-muted">Pick one or more. Nothing picked means every exam{groups.length > 1 ? " in that subject" : ""}.</p>
                  </div>
                )}
              </div>
            </div>

            {mode === "exam" && (
              <div className="card space-y-4" data-testid="mock-time">
                <h2 className={sectionTitle}><Timer className="h-5 w-5 text-muted" />Time</h2>
                <div className="grid grid-cols-5 gap-2">
                  {[20, 30, 45, 60, 90].map((m) => <button key={m} onClick={() => { setMockMin(m); setPreset("custom"); }} className={`h-11 rounded-xl border text-sm font-semibold transition ${mockMin === m ? "border-brand bg-brand text-white" : "border-line text-muted hover:text-ink"}`}>{m}m</button>)}
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-muted" />
                  <input type="number" min={1} max={360} value={mockMin} onChange={(e) => { setMockMin(Math.max(1, Math.min(360, Number(e.target.value) || 1))); setPreset("custom"); }} className="input !w-24 text-center" />
                  <span className="text-sm text-muted">minutes{mockTotal > 0 && (() => { const s = Math.round((mockMin * 60) / mockTotal); return ` · about ${s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}` : `${s} s`} per question`; })()}</span>
                </div>
                <p className="text-xs text-muted">Questions are shuffled across chapters. Cases and EMQs stay together, so a chapter can get one or two extra questions.</p>
              </div>
            )}
            {mode === "study" && <div className="card space-y-5">
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
            </div>}
          </section>
        </div>
      )}

      {mode && (
        <div className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),16px)+80px)] z-20 px-4 lg:bottom-4 lg:left-64">
          <div className="mx-auto flex max-w-3xl items-center gap-4 glass-float !rounded-2xl p-3 pl-5">
            <div className="min-w-0 flex-1 text-sm">
              {mode === "exam" ? <>
                <div className="font-semibold" data-testid="mock-summary">{mockTotal} question{mockTotal === 1 ? "" : "s"} · Mock exam · {mockMin} min</div>
                <div className="truncate text-xs text-muted">{error ? <span className="text-bad">{error}</span> : mockTotal === 0 ? "Add questions from the chapters above" : `From ${Object.keys(mockPlan).length} chapter${Object.keys(mockPlan).length === 1 ? "" : "s"}`}</div>
              </> : <>
                <div className="font-semibold">{effective} question{effective === 1 ? "" : "s"} · Study mode</div>
                <div className="truncate text-xs text-muted">{error ? <span className="text-bad">{error}</span> : selected.size === 0 ? "Select chapters or topics above" : `${available} available in your selection`}</div>
              </>}
            </div>
            <button className="btn !px-5 !py-3" disabled={pending || (mode === "exam" ? mockTotal === 0 : effective === 0)} onClick={go}><Play className="h-4 w-4" />{pending ? "Creating…" : "Start"}</button>
          </div>
        </div>
      )}
    </div>
  );
}
