"use client";
import { useEffect, useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpenCheck, Check, ChevronDown, Clock, Minus, Plus, Shuffle, SlidersHorizontal, Timer } from "lucide-react";
import { createSession } from "@/app/actions-session";
import type { Counts, Tree } from "@/lib/sessions";
import { parseTags, sortTags } from "@/lib/tags";

type Pool = "all" | "unanswered" | "incorrect" | "bookmarked" | "answered";
const POOLS: { id: Pool; label: string; idx: number }[] = [
  { id: "all", label: "All questions", idx: 0 }, { id: "unanswered", label: "New", idx: 1 }, { id: "incorrect", label: "Mistakes", idx: 2 },
  { id: "bookmarked", label: "Saved", idx: 3 }, { id: "answered", label: "Already done", idx: 4 },
];
const MAX = 200;
/** Mock exam presets: total questions spread evenly over the chapters, and the time. */
const PRESETS = [{ id: "p20", q: 20, min: 30 }, { id: "p50", q: 50, min: 60 }] as const;

function Box({ state }: { state: "none" | "some" | "all" }) {
  return (
    <span className={`grid h-[22px] w-[22px] shrink-0 place-items-center rounded-full border-[1.5px] transition duration-200 ${state === "none" ? "border-ink/25" : "border-mint bg-mint text-onmint"}`}>
      {state === "all" && <Check className="h-3.5 w-3.5" strokeWidth={3} />}{state === "some" && <Minus className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}

export default function NewSessionForm({ tree, counts, initialTopics = [], initialMode = null }: { tree: Tree; counts: Counts; initialTopics?: string[]; initialMode?: "study" | "exam" | null }) {
  const [mode, setMode] = useState<"study" | "exam">(initialMode ?? "study");
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
  const router = useRouter();
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
    setError("");
    start(async () => {
      const res = mode === "exam"
        ? await createSession({ mode, topicIds: allChapters.filter((c) => mockPlan[c.id]).flatMap((c) => c.topics.map((t) => t.id)), count: mockTotal, pool, tags: [...active], randomize: true, timed: true, minutes: mockMin, perChapter: mockPlan })
        : await createSession({ mode, topicIds: [...selected], count: effective, pool, tags: [...active], randomize, timed, minutes });
      if (res.error || !res.id) { setError(res.error ?? "Something went wrong. Please try again."); return; }
      const url = `/session/${res.id}`;
      router.push(url);
      // Safety net: now and then the smooth switch to the new session never completes and the button stays on
      // "Creating…". The session already exists by then, so after a short wait open it with a normal page load.
      window.setTimeout(() => { if (window.location.pathname !== url) window.location.assign(url); }, 2500);
    });
  }

  const label = "eyebrow mb-2.5 px-1";
  const chip = (on: boolean) => `inline-flex h-9 items-center rounded-full px-3.5 text-[13.5px] font-semibold transition duration-200 active:scale-95 ${on ? "bg-ink text-bg" : "bg-raised text-ink/80 hover:bg-ink/10"}`;
  const round = "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-raised text-ink transition duration-200 hover:bg-ink/10 active:scale-90 disabled:opacity-35";
  const nChapters = Object.keys(mockPlan).length;

  return (
    <div className="space-y-5 pb-48 lg:space-y-6 lg:pb-32">
      <h1 className="text-[30px] font-extrabold leading-[44px] lg:text-[38px] lg:leading-tight">New session</h1>

      <div>
        <div className="relative flex rounded-[18px] bg-surface p-1 shadow-card lg:max-w-md" role="group" aria-label="Session type">
          <span aria-hidden className={`absolute bottom-1 left-1 top-1 w-[calc(50%-4px)] rounded-[14px] bg-ink transition-transform duration-500 [transition-timing-function:cubic-bezier(.3,1.3,.5,1)] ${mode === "exam" ? "translate-x-full" : ""}`} />
          {([["study", "Study", BookOpenCheck], ["exam", "Mock exam", Timer]] as const).map(([id, title, Icon]) => (
            <button key={id} onClick={() => setMode(id)} aria-pressed={mode === id} data-testid={`mode-${id}`}
              className={`relative flex h-11 flex-1 items-center justify-center gap-2 text-[15px] font-semibold transition-colors duration-300 ${mode === id ? "text-bg" : "text-muted"}`}><Icon className="h-[18px] w-[18px]" />{title}</button>
          ))}
        </div>
        <p className="mt-3 min-h-[38px] px-1 text-[13.5px] leading-snug text-muted lg:min-h-0">{mode === "exam" ? "Timed, like the real exam. Answers and explanations come at the end. Pass mark 60%." : "See the correct answer and the explanation right after each question. No timer."}</p>
      </div>

      <div key={mode} className="animate-rise space-y-5 lg:space-y-6">
          {mode === "exam" && (
            <section data-testid="mock-chapters" className="space-y-5 lg:space-y-6">
              <div>
                <p className={label}>Exam size</p>
                <div className="grid grid-cols-3 gap-2.5 lg:max-w-xl" data-testid="mock-presets">
                  {[...PRESETS.map((pr) => ({ id: pr.id as string, big: String(pr.q), l1: "questions", l2: `${pr.min} minutes`, on: () => applyPreset(pr) })), { id: "custom", big: "", l1: "Custom", l2: "Your own mix", on: () => setPreset("custom") }].map((b) => (
                    <button key={b.id} onClick={b.on} aria-pressed={preset === b.id}
                      className={`rounded-[20px] border-[1.5px] px-3.5 py-3.5 text-left transition duration-200 active:scale-[.97] ${preset === b.id ? "border-mint bg-mint/15" : "border-transparent bg-surface shadow-card"}`}>
                      <span className="flex h-[26px] items-center font-display text-[26px] font-extrabold leading-none">{b.big || <SlidersHorizontal className="h-[22px] w-[22px]" />}</span>
                      <span className="mt-2 block text-[13px] font-semibold">{b.l1}</span><span className="block truncate text-[12.5px] text-muted">{b.l2}</span>
                    </button>
                  ))}
                </div>
              </div>
              <div>
                <p className={label}>Questions per chapter</p>
                <div className="space-y-3">
                {tree.subjects.map((sub) => {
                  const subTotal = sub.chapters.reduce((s, c) => s + (mockPlan[c.id] ?? 0), 0);
                  return (
                    <div key={sub.id} className="card overflow-hidden !p-0">
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-2.5 border-b border-line px-[18px] py-3.5">
                        <span className="font-display text-[17px] font-bold">{sub.name}</span>
                        {subTotal > 0 && <span className="rounded-full bg-mint/15 px-2.5 py-1 text-xs font-bold text-brand">{subTotal} Q</span>}
                        <span className="ml-auto flex flex-wrap items-center gap-1.5 text-xs text-muted">Spread evenly
                          {[10, 20, 40, 50].map((n) => <button key={n} onClick={() => { setPreset("custom"); spread(sub.chapters, n); }} className="grid h-8 min-w-9 place-items-center rounded-full bg-raised px-2.5 text-xs font-semibold text-ink/80 transition hover:bg-ink/10 active:scale-95">{n}</button>)}
                          {subTotal > 0 && <button onClick={() => { setPreset("custom"); spread(sub.chapters, 0); }} className="grid h-8 place-items-center rounded-full bg-raised px-2.5 text-xs font-semibold text-ink/80 transition hover:bg-ink/10 active:scale-95">Clear</button>}
                        </span>
                      </div>
                      <div className="divide-y divide-line">
                        {sub.chapters.map((ch) => {
                          const cap = chAvail(ch), n = Math.min(perCh[ch.id] ?? 0, cap);
                          return (
                            <div key={ch.id} className="flex items-center gap-2.5 py-2.5 pl-[18px] pr-3.5" data-testid={`mock-ch-${ch.name}`}>
                              <div className="min-w-0 flex-1">
                                <div className="truncate text-[15px] font-semibold">{ch.name}</div>
                                <div className="text-[12.5px] text-muted">{cap} available</div>
                              </div>
                              <button aria-label={`Fewer from ${ch.name}`} disabled={n <= 0} onClick={() => bump(ch.id, -1, cap)} className={round}><Minus className="h-4 w-4" strokeWidth={2.4} /></button>
                              <input aria-label={`Questions from ${ch.name}`} inputMode="numeric" value={n} onChange={(e) => { setPreset("custom"); setPerCh((p) => ({ ...p, [ch.id]: Math.max(0, Math.min(cap, Number(e.target.value.replace(/\D/g, "")) || 0)) })); }}
                                className={`h-10 w-11 rounded-xl bg-transparent text-center font-display text-lg font-extrabold tabular-nums outline-none transition focus:bg-raised ${n ? "" : "text-muted"}`} />
                              <button aria-label={`More from ${ch.name}`} disabled={n >= cap} onClick={() => bump(ch.id, 1, cap)} className={round}><Plus className="h-4 w-4" strokeWidth={2.4} /></button>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                </div>
              </div>
            </section>
          )}
          {mode === "study" && <section>
            <p className={label}>Chapters and topics</p>
            <div className="space-y-3">
              {tree.subjects.map((sub) => {
                const subIds = sub.chapters.flatMap((c) => c.topics.map((t) => t.id));
                const st = stateOf(subIds);
                return (
                  <div key={sub.id} className="card overflow-hidden !p-0">
                    <button className="flex w-full items-center gap-3 border-b border-line px-[18px] py-3.5 text-left" onClick={() => toggleTopics(subIds, st !== "all")}>
                      <Box state={st} /><span className="font-display text-[17px] font-bold">{sub.name}</span>
                      <span className="ml-auto text-[12.5px] text-muted">{subIds.reduce((s, id) => s + topicAvail(id), 0)} available</span>
                    </button>
                    <div className="divide-y divide-line">
                      {sub.chapters.map((ch) => {
                        const ids = ch.topics.map((t) => t.id), cs = stateOf(ids), isOpen = open.has(ch.id);
                        return (
                          <div key={ch.id}>
                            <div className="flex min-h-[52px] items-center gap-2 pl-[18px] pr-2.5">
                              <button onClick={() => toggleTopics(ids, cs !== "all")} className="flex min-h-[52px] flex-1 items-center gap-3 text-left"><Box state={cs} /><span className="text-[15px] font-semibold">{ch.name}</span></button>
                              <span className="text-[12.5px] tabular-nums text-muted">{ids.reduce((s, id) => s + topicAvail(id), 0)}</span>
                              <button aria-label="Show topics" aria-expanded={isOpen} onClick={() => toggleSet(open, ch.id, setOpen)} className="grid h-9 w-9 place-items-center rounded-full text-muted transition hover:bg-raised hover:text-ink"><ChevronDown className={`h-[18px] w-[18px] transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} /></button>
                            </div>
                            {isOpen && (
                              <div className="animate-reveal space-y-0.5 bg-ink/[.035] py-1.5 pl-11 pr-3">
                                {ch.topics.map((tp) => (
                                  <button key={tp.id} onClick={() => toggleTopics([tp.id], !selected.has(tp.id))} className="flex min-h-11 w-full items-center gap-3 rounded-xl px-2 text-left transition hover:bg-ink/[.05]">
                                    <Box state={selected.has(tp.id) ? "all" : "none"} /><span className="text-sm">{tp.name}</span><span className="ml-auto text-[12.5px] tabular-nums text-muted">{topicAvail(tp.id)}</span>
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

          <section className="grid grid-cols-1 gap-3 lg:grid-cols-2 lg:gap-5">
            <div className="card space-y-6">
              <div>
                <p className="eyebrow mb-2.5">Which questions</p>
                <div className="flex flex-wrap gap-2">
                  {POOLS.map((p) => <button key={p.id} onClick={() => setPool(p.id)} aria-pressed={pool === p.id} className={chip(pool === p.id)}>{p.label}</button>)}
                </div>
              </div>
              <div data-testid="exam-filter">
                <p className="eyebrow mb-2.5">Exams and years</p>
                {scope.size === 0 ? (
                  <p className="text-sm text-muted">Choose chapters above, then narrow them to the exams their questions came from.</p>
                ) : groups.length === 0 ? (
                  <p className="text-sm text-muted">The chapters you chose have no exam tags yet.</p>
                ) : (
                  <div className="space-y-4">
                    {groups.map((g) => {
                      const none = !wantBySubject.has(g.id);
                      return (
                        <div key={g.id} data-testid={`exam-group-${g.name}`}>
                          {groups.length > 1 && <p className="mb-2 text-sm font-semibold">{g.name}</p>}
                          <div className="flex flex-wrap gap-2">
                            <button onClick={() => clearSubject(g.id)} aria-pressed={none} className={chip(none)}>All</button>
                            {g.tags.map(({ t, n }) => {
                              const k = `${g.id}::${t}`;
                              return <button key={k} onClick={() => toggleSet(tagSel, k, setTagSel)} aria-pressed={active.has(k)} className={chip(active.has(k))}>{t} <span className="ml-1.5 font-medium opacity-60">{n}</span></button>;
                            })}
                            {g.none > 0 && <button onClick={() => toggleSet(tagSel, `${g.id}::__none`, setTagSel)} aria-pressed={active.has(`${g.id}::__none`)} className={chip(active.has(`${g.id}::__none`))}>No tag <span className="ml-1.5 font-medium opacity-60">{g.none}</span></button>}
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
                <p className="eyebrow">Time</p>
                <div className="grid grid-cols-5 gap-2">
                  {[20, 30, 45, 60, 90].map((m) => <button key={m} onClick={() => { setMockMin(m); setPreset("custom"); }} aria-pressed={mockMin === m} className={`h-11 rounded-full text-sm font-semibold transition duration-200 active:scale-95 ${mockMin === m ? "bg-ink text-bg" : "bg-raised text-ink/80 hover:bg-ink/10"}`}>{m}m</button>)}
                </div>
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 shrink-0 text-muted" />
                  <input type="number" min={1} max={360} value={mockMin} aria-label="Minutes" onChange={(e) => { setMockMin(Math.max(1, Math.min(360, Number(e.target.value) || 1))); setPreset("custom"); }} className="input !w-20 !px-2 text-center font-semibold" />
                  <span className="text-sm text-muted">minutes{mockTotal > 0 && (() => { const s = Math.round((mockMin * 60) / mockTotal); return ` · about ${s >= 60 ? `${Math.floor(s / 60)} min${s % 60 ? ` ${s % 60} s` : ""}` : `${s} s`} per question`; })()}</span>
                </div>
                <p className="text-xs leading-relaxed text-muted">Questions are shuffled across chapters. Cases and EMQs stay together, so a chapter can get one or two extra questions.</p>
              </div>
            )}
            {mode === "study" && <div className="card space-y-5">
              <div>
                <p className="eyebrow mb-2.5">How many</p>
                <div className="flex items-center justify-between rounded-[22px] bg-raised p-2.5">
                  <button aria-label="Fewer questions" disabled={effective <= 1} onClick={() => setCount(Math.max(1, effective - 5))} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-card transition duration-200 active:scale-90 disabled:opacity-35"><Minus className="h-5 w-5" strokeWidth={2.4} /></button>
                  <div className="text-center">
                    <input type="number" min={1} max={MAX} value={count} aria-label="Number of questions" onChange={(e) => setCount(Number(e.target.value))}
                      className="w-24 bg-transparent text-center font-display text-[38px] font-extrabold leading-none tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none" />
                    <div className="mt-1 text-[12.5px] text-muted">{available === 0 ? "choose chapters first" : effective < count ? `only ${effective} available` : "questions"}</div>
                  </div>
                  <button aria-label="More questions" disabled={effective >= Math.min(available, MAX)} onClick={() => setCount(Math.min(Math.min(available, MAX), effective + 5))} className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-surface text-ink shadow-card transition duration-200 active:scale-90 disabled:opacity-35"><Plus className="h-5 w-5" strokeWidth={2.4} /></button>
                </div>
                <div className="mt-2.5 grid grid-cols-4 gap-2">
                  {[10, 20, 40].map((n) => <button key={n} onClick={() => setCount(n)} aria-pressed={count === n} className={`${chip(count === n)} justify-center !px-0`}>{n}</button>)}
                  <button onClick={() => setCount(Math.min(available, MAX))} aria-pressed={available > 0 && count === Math.min(available, MAX)} className={`${chip(available > 0 && count === Math.min(available, MAX))} justify-center !px-0`}>All {Math.min(available, MAX)}</button>
                </div>
              </div>
              <button onClick={() => setRandomize((r) => !r)} role="switch" aria-checked={randomize} className="flex w-full items-center gap-3 text-left">
                <Shuffle className="h-4 w-4 text-muted" /><span className="flex-1 text-sm font-medium">Randomize question order</span>
                <span className={`relative h-7 w-12 rounded-full transition-colors duration-300 ${randomize ? "bg-mint" : "bg-ink/15"}`}><span className={`absolute left-0.5 top-0.5 h-6 w-6 rounded-full bg-white shadow transition-transform duration-300 [transition-timing-function:cubic-bezier(.3,1.3,.5,1)] ${randomize ? "translate-x-5" : ""}`} /></span>
              </button>
            </div>}
          </section>
      </div>

      <div className="fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),16px)+78px)] z-20 px-4 lg:bottom-5 lg:left-[268px]">
        <div className="mx-auto flex max-w-3xl items-center gap-3 rounded-[26px] border border-ink/10 bg-[rgb(var(--glass)/var(--float-a))] p-2.5 pl-5 shadow-[0_18px_44px_rgb(0_0_0/.3)] backdrop-blur-2xl">
          <div className="min-w-0 flex-1 text-sm">
            {mode === "exam" ? <>
              <div className="truncate font-semibold" data-testid="mock-summary">{mockTotal} question{mockTotal === 1 ? "" : "s"} · {mockMin} min</div>
              <div className="truncate text-xs text-muted">{error ? <span className="text-bad">{error}</span> : mockTotal === 0 ? "Add questions from the chapters above" : `Mock exam from ${nChapters} chapter${nChapters === 1 ? "" : "s"}`}</div>
            </> : <>
              <div className="truncate font-semibold">{effective} question{effective === 1 ? "" : "s"} · Study</div>
              <div className="truncate text-xs text-muted">{error ? <span className="text-bad">{error}</span> : selected.size === 0 ? "Choose chapters or topics above" : `${available} available in your selection`}</div>
            </>}
          </div>
          <button className="btn h-12 shrink-0 !px-6 text-[15px]" disabled={pending || (mode === "exam" ? mockTotal === 0 : effective === 0)} onClick={go} data-testid="start-session">{pending ? "Creating…" : "Start"}{!pending && <ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} />}</button>
        </div>
      </div>
    </div>
  );
}
