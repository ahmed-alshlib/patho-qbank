"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, Bookmark, Check, ChevronLeft, Clock, Flag, Highlighter, Keyboard, LayoutGrid, RotateCcw, StickyNote, Trophy, X } from "lucide-react";
import { addHighlight, removeHighlights, reportQuestion, saveNote, submitAnswer, toggleBookmark } from "@/app/actions-study";
import { answerInSession, finishSession } from "@/app/actions-session";
import type { Hl, Reveal, StudyQuestion } from "@/lib/questions";
import { FontSizeControl, useFontScale } from "@/components/FontSize";
import { ActionBar, LogoLine, NavRail, NavSheet, type NavFilter, type NavItem } from "@/components/SessionNav";
import HighlightedText from "@/components/HighlightedText";
import { ChoiceGrid, GRID_FROM, GroupPanel } from "@/components/QuestionGroup";
import { ProgressRing } from "@/components/ui";
import { ExplainBody, Verdict } from "@/components/Explanation";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function StudyClient({ questions, startAt, title, backHref, backLabel, fresh = false, testId }: {
  questions: StudyQuestion[]; startAt: number; title: string; backHref: string; backLabel: string; fresh?: boolean; testId?: string;
}) {
  const router = useRouter();
  const font = useFontScale();
  const [i, setI] = useState(startAt);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Reveal>>(Object.fromEntries(questions.filter((q) => q.previous).map((q) => [q.id, q.previous!])));
  // In retry mode every question starts unanswered, even though earlier attempts are remembered.
  const [retrying, setRetrying] = useState<Record<string, boolean>>(fresh ? Object.fromEntries(questions.map((q) => [q.id, true])) : {});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>(Object.fromEntries(questions.map((q) => [q.id, q.bookmarked])));
  const [notes, setNotes] = useState<Record<string, string>>(Object.fromEntries(questions.map((q) => [q.id, q.note])));
  const [hls, setHls] = useState<Record<string, Hl[]>>(Object.fromEntries(questions.map((q) => [q.id, q.highlights])));
  // Highlights on the question text are temporary: never saved, cleared once the question is answered.
  const [tempHls, setTempHls] = useState<Record<string, Hl[]>>({});
  // A case or option list is open on the first question of its block and folded after that,
  // until the student opens it again.
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const tempId = useRef(0);
  const [finishing, setFinishing] = useState(false);
  const [navOpen, setNavOpen] = useState(false);
  const [noteOpen, setNoteOpen] = useState(false);
  const [noteState, setNoteState] = useState<"idle" | "saving" | "saved">("idle");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportText, setReportText] = useState("");
  const [reportDone, setReportDone] = useState(false);
  const [finished, setFinished] = useState(false);
  const [wrongFlash, setWrongFlash] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const [pending, start] = useTransition();
  const startedAt = useRef(Date.now());
  const noteTimer = useRef<ReturnType<typeof setTimeout>>(undefined);
  // Phones: the explanation is a sheet that first peeks above the buttons, then opens when tapped.
  const [sheetOpen, setSheetOpen] = useState(false);

  const q = questions[i];
  const reveal = retrying[q.id] ? undefined : results[q.id];
  const isDone = (id: string) => !!results[id] && retrying[id] !== true;

  useEffect(() => {
    if (reveal) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [reveal, i]);

  const go = useCallback((n: number) => {
    setI(n); setSelected(null); setNoteOpen(false); setReportOpen(false); setReportDone(false); setElapsed(0); setSheetOpen(false);
    startedAt.current = Date.now();
    if (typeof window !== "undefined" && window.scrollY > 120) window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const submit = useCallback(() => {
    if (!selected || reveal) return;
    const secs = (Date.now() - startedAt.current) / 1000;
    const qid = q.id, ch = selected;
    start(async () => {
      const r = testId ? (await answerInSession(testId, qid, ch, secs))! : await submitAnswer(qid, ch, secs);
      setResults((m) => ({ ...m, [qid]: r }));
      setTempHls((m) => ({ ...m, [qid]: [] }));
      setRetrying((m) => ({ ...m, [qid]: false }));
      setSheetOpen(false);
      if (!r.isCorrect) setWrongFlash((n) => n + 1);
    });
  }, [selected, reveal, q.id, testId]);

  const finishNow = useCallback(async () => {
    if (!testId) return setFinished(true);
    setFinishing(true);
    await finishSession(testId);
    const url = `/results/${testId}`;
    router.push(url);
    // Safety net: if the smooth switch to the results never completes, open them with a normal page load.
    window.setTimeout(() => { if (window.location.pathname !== url) window.location.assign(url); }, 2500);
  }, [testId, router]);

  const next = useCallback(() => (i < questions.length - 1 ? go(i + 1) : void finishNow()), [i, questions.length, go, finishNow]);

  // Keyboard: A-E / 1-5 choose, Enter submit or next, arrows navigate.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || e.metaKey || e.ctrlKey || e.altKey || finished) return;
      const k = e.key.toLowerCase();
      if (!reveal) {
        const idx = "abcdef".indexOf(k) >= 0 && k.length === 1 ? "abcdef".indexOf(k) : /^[1-6]$/.test(k) ? Number(k) - 1 : -1;
        if (idx >= 0 && q.choices[idx]) { setSelected(q.choices[idx].id); return; }
      }
      if (k === "enter") { e.preventDefault(); reveal ? next() : submit(); }
      if (k === "arrowright" && i < questions.length - 1) go(i + 1);
      if (k === "arrowleft" && i > 0) go(i - 1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [reveal, q, i, questions.length, submit, next, go, finished]);

  function onBookmark() {
    const qid = q.id, v = !bookmarked[qid];
    setBookmarked((m) => ({ ...m, [qid]: v }));
    start(async () => { const real = await toggleBookmark(qid); setBookmarked((m) => ({ ...m, [qid]: real })); });
  }

  function onNote(v: string) {
    const qid = q.id;
    setNotes((m) => ({ ...m, [qid]: v })); setNoteState("saving");
    clearTimeout(noteTimer.current);
    noteTimer.current = setTimeout(async () => { await saveNote(qid, v); setNoteState("saved"); }, 700);
  }

  function onAddHl(target: Hl["target"], s: number, e: number) {
    const qid = q.id;
    if (target === "question") {
      setTempHls((m) => ({ ...m, [qid]: [...(m[qid] ?? []), { id: `t-${++tempId.current}`, target, start: s, end: e }] }));
      return;
    }
    const tmp = `tmp-${Math.random()}`;
    setHls((m) => ({ ...m, [qid]: [...(m[qid] ?? []), { id: tmp, target, start: s, end: e }] }));
    addHighlight(qid, target, s, e)
      .then((id) => setHls((m) => ({ ...m, [qid]: m[qid].map((h) => (h.id === tmp ? { ...h, id } : h)) })))
      .catch(() => setHls((m) => ({ ...m, [qid]: m[qid].filter((h) => h.id !== tmp) })));
  }
  function onRemoveHl(ids: string[]) {
    const qid = q.id;
    setTempHls((m) => ({ ...m, [qid]: (m[qid] ?? []).filter((h) => !ids.includes(h.id)) }));
    setHls((m) => ({ ...m, [qid]: (m[qid] ?? []).filter((h) => !ids.includes(h.id)) }));
    removeHighlights(ids.filter((x) => !x.startsWith("tmp-") && !x.startsWith("t-")));
  }

  function sendReport() {
    const qid = q.id;
    start(async () => { await reportQuestion(qid, reportText); setReportDone(true); setReportText(""); });
  }

  if (finished) {
    const done = questions.filter((x) => isDone(x.id));
    const correct = done.filter((x) => results[x.id].isCorrect).length;
    const acc = done.length ? Math.round((correct / done.length) * 100) : 0;
    return (
      <div className="card animate-rise mx-auto flex max-w-xl flex-col items-center gap-5 !rounded-[28px] py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-full bg-warn/15 text-warn"><Trophy className="h-7 w-7" /></span>
        <h2 className="text-[28px] font-extrabold">Session complete</h2>
        <ProgressRing value={acc} size={172} stroke={13} sub={`${correct} of ${done.length} correct`} />
        <p className="max-w-sm text-sm text-muted">{done.length - correct > 0 ? `${done.length - correct} to review. Mistakes are collected automatically so you can retry them.` : "Flawless. Keep the momentum going."}</p>
        <div className="flex flex-wrap justify-center gap-2.5">
          {done.length - correct > 0 && <Link href="/practice/incorrect" className="btn h-12 !px-5"><RotateCcw className="h-4 w-4" />Retry mistakes</Link>}
          <button className="btn-ghost h-12 !px-5" onClick={() => { setFinished(false); go(0); }}>Review from start</button>
          <Link href={backHref} className="btn-ghost h-12 !px-5">{backLabel}</Link>
        </div>
      </div>
    );
  }

  const hasNote = !!notes[q.id]?.trim();
  const doneCount = questions.filter((x) => isDone(x.id)).length;

  const navItems: NavItem[] = questions.map((x) => {
    const r = isDone(x.id) ? results[x.id] : undefined;
    return { id: x.id, tone: r ? (r.isCorrect ? "correct" : "wrong") : "none", grouped: !!x.group };
  });
  const filters: NavFilter[] = [
    { key: "all", label: "All", test: () => true },
    { key: "wrong", label: "Wrong", test: (x) => x.tone === "wrong" },
    { key: "left", label: "Left", test: (x) => x.tone === "none" },
  ];
  const summary = `${doneCount} answered · ${questions.length - doneCount} left`;
  const firstLeft = navItems.findIndex((x, n) => n > i && x.tone === "none");
  const retry = () => { setRetrying((m) => ({ ...m, [q.id]: true })); setSelected(null); startedAt.current = Date.now(); setElapsed(0); };
  const last = i === questions.length - 1;
  const primary = reveal
    ? <button className="btn h-[54px] flex-1 !rounded-[18px] text-base" onClick={next} data-testid="next-question">{finishing ? "Finishing…" : last ? "Finish" : "Next question"}<ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} /></button>
    : <button className="btn h-[54px] flex-1 !rounded-[18px] text-base" disabled={!selected || pending} onClick={submit} data-testid="check-answer">{pending ? "Checking…" : "Check answer"}</button>;
  const tool = "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink/75 shadow-card transition duration-200 hover:text-ink active:scale-90";
  const expHls = (hls[q.id] ?? []).filter((h) => h.target === "explanation");

  return (
    <div className="mx-auto max-w-6xl" style={font.style}>
      <div className="flex items-center gap-3">
        <Link href={backHref} aria-label={backLabel} title={backLabel} className="icon-btn"><X className="h-5 w-5" /></Link>
        <div className="hidden min-w-0 lg:block lg:w-60">
          <div className="truncate text-base font-semibold">{title}</div>
          <div className="truncate text-[13.5px] text-muted">{testId ? "Study session" : "Chapter practice"}</div>
        </div>
        <div className="min-w-0 flex-1 lg:mx-auto lg:max-w-md">
          <div className="flex items-center justify-between gap-2 text-[13px] font-semibold">
            <span className="truncate tabular-nums">Question {i + 1} of {questions.length}</span>
            <span className="inline-flex shrink-0 items-center gap-1 tabular-nums text-muted">{reveal ? `${questions.length - doneCount} left` : <><Clock className="h-3.5 w-3.5" />{fmt(elapsed)}</>}</span>
          </div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-ink/[.09]" role="progressbar" aria-label="Session progress" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={doneCount}>
            <div className="h-full rounded-full bg-mint transition-[width] duration-700 [transition-timing-function:cubic-bezier(.22,1,.36,1)]" style={{ width: `${questions.length ? Math.round((doneCount / questions.length) * 100) : 0}%` }} />
          </div>
        </div>
        <span className="hidden sm:block"><FontSizeControl f={font} /></span>
        {testId && <button className="btn-ghost hidden h-11 !px-4 text-[13px] sm:inline-flex" disabled={finishing} onClick={() => void finishNow()}>End session</button>}
        <button onClick={onBookmark} aria-label="Save this question" aria-pressed={!!bookmarked[q.id]} data-testid="save-question" className={`icon-btn lg:hidden ${bookmarked[q.id] ? "!bg-mint/15 !text-brand" : ""}`}><Bookmark className={`h-5 w-5 ${bookmarked[q.id] ? "fill-current" : ""}`} /></button>
        <button onClick={() => setNavOpen(true)} aria-label="All questions" data-testid="open-nav" className="icon-btn lg:hidden"><LayoutGrid className="h-5 w-5" /></button>
      </div>

      <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1.12fr)_minmax(0,1fr)] lg:items-start lg:gap-9">
        <div key={q.id} className={`animate-rise min-w-0 space-y-4 lg:pb-0 ${reveal ? "pb-52" : "pb-28"}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="-mx-5 flex min-w-0 flex-1 gap-1.5 overflow-x-auto px-5 [scrollbar-width:none] lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0 [&>*]:shrink-0">
              <span className="inline-flex h-7 items-center rounded-full bg-surface px-3 text-[12.5px] font-semibold text-ink/80 shadow-card">{q.chapter}</span>
              {q.topic !== q.chapter && <span className="inline-flex h-7 items-center rounded-full bg-surface px-3 text-[12.5px] font-semibold text-ink/80 shadow-card">{q.topic}</span>}
              {q.tags.map((t) => <span key={t} className="inline-flex h-7 items-center rounded-full bg-mint/15 px-3 text-[12.5px] font-semibold text-brand">{t}</span>)}
            </div>
            <div className="hidden shrink-0 gap-1.5 lg:flex">
              <button onClick={onBookmark} aria-label="Save this question" aria-pressed={!!bookmarked[q.id]} title="Save" className={`${tool} ${bookmarked[q.id] ? "!bg-mint/15 !text-brand" : ""}`}>
                <Bookmark className={`h-[18px] w-[18px] transition ${bookmarked[q.id] ? "fill-current" : ""}`} />
              </button>
              <button onClick={() => { setNoteOpen((o) => !o); setReportOpen(false); }} aria-label="Notes" title="Personal note" className={`${tool} relative ${noteOpen ? "!bg-mint/15 !text-brand" : ""}`}>
                <StickyNote className="h-[18px] w-[18px]" />{hasNote && <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-mint" />}
              </button>
              <button onClick={() => { setReportOpen((o) => !o); setNoteOpen(false); }} aria-label="Report" title="Report a problem" className={`${tool} ${reportOpen ? "!bg-bad/15 !text-bad" : ""}`}><Flag className="h-[18px] w-[18px]" /></button>
            </div>
          </div>

          {noteOpen && (
            <div className="animate-reveal overflow-hidden rounded-[20px] bg-surface p-3 shadow-card">
              <textarea className="input min-h-24 resize-y" placeholder="Write a personal note for this question…" value={notes[q.id] ?? ""} onChange={(e) => onNote(e.target.value)} autoFocus />
              <div className="px-1 pt-2 text-xs text-muted">{noteState === "saving" ? "Saving…" : noteState === "saved" ? "Saved" : "Notes save automatically"}</div>
            </div>
          )}
          {reportOpen && (
            <div className="animate-reveal overflow-hidden rounded-[20px] bg-surface p-3 shadow-card">
              {reportDone ? <p className="p-1 text-sm text-good">Thanks. Your report was sent.</p> : (
                <>
                  <textarea className="input min-h-20 resize-y" placeholder="What is wrong with this question?" value={reportText} onChange={(e) => setReportText(e.target.value)} />
                  <div className="mt-2 flex justify-end"><button className="btn !py-2" disabled={!reportText.trim() || pending} onClick={sendReport}>Send report</button></div>
                </>
              )}
            </div>
          )}

          {q.group && (
            <GroupPanel g={q.group} open={openGroups[q.group.id] ?? q.group.index === 0}
              onToggle={() => setOpenGroups((m) => ({ ...m, [q.group!.id]: !(m[q.group!.id] ?? q.group!.index === 0) }))} />
          )}

          <div>
            <HighlightedText text={q.text} highlights={tempHls[q.id] ?? []}
              onAdd={(s, e) => onAddHl("question", s, e)} onRemove={onRemoveHl} className="qtext font-medium leading-[1.55] [text-wrap:pretty]" />
            {!reveal && <p className="mt-2 hidden items-center gap-1.5 text-xs text-muted lg:inline-flex"><Highlighter className="h-3 w-3" />Select text to highlight it. Highlights on the question clear when you answer.</p>}
          </div>

          <div className="space-y-2.5 pt-1" role="group" aria-label="Answers">
            {q.choices.length >= GRID_FROM ? (
              <ChoiceGrid choices={q.choices} selectedId={reveal ? reveal.choiceId : selected}
                correctIds={reveal ? reveal.correctChoiceIds : null} chosenId={reveal?.choiceId ?? null}
                disabled={!!reveal} onPick={(id) => setSelected(id)} />
            ) : q.choices.map((c, n) => {
              const isRight = !!reveal?.correctChoiceIds.includes(c.id), isWrong = !!reveal && reveal.choiceId === c.id && !reveal.isCorrect, isSel = selected === c.id && !reveal;
              const cls = isRight ? "border-mint bg-mint/15" : isWrong ? `border-bad bg-bad/15 ${wrongFlash ? "animate-shake" : ""}` : isSel ? "border-mint bg-mint/10 shadow-glow" : reveal ? "border-transparent bg-surface opacity-50" : "border-transparent bg-surface hover:bg-ink/[.05] active:scale-[.985]";
              const badge = isRight ? "scale-110 bg-mint text-onmint" : isWrong ? "bg-bad text-bg" : isSel ? "bg-mint text-onmint" : "bg-raised text-ink/80";
              return (
                <button key={c.id} disabled={!!reveal} onClick={() => setSelected(c.id)} aria-pressed={isSel} data-testid="choice" data-state={isRight ? "right" : isWrong ? "wrong" : isSel ? "selected" : "idle"}
                  className={`group flex min-h-[58px] w-full items-center gap-3.5 rounded-[20px] border-[1.5px] py-2.5 pl-[11px] pr-4 text-left shadow-card transition duration-300 lg:min-h-[64px] lg:rounded-[22px] lg:pl-3.5 ${cls}`}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition duration-300 ${badge}`}>
                    {isRight ? <Check className="animate-badge h-[19px] w-[19px]" strokeWidth={2.8} /> : isWrong ? <X className="animate-badge h-[18px] w-[18px]" strokeWidth={2.8} /> : c.label}
                  </span>
                  <span className="qchoice min-w-0 flex-1 leading-snug">{c.text}</span>
                  {!reveal && <kbd className="ml-auto hidden rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-semibold text-muted lg:group-hover:block">{n + 1}</kbd>}
                </button>
              );
            })}
          </div>

          <LogoLine className="justify-center pt-1" />

          <div className="flex items-center gap-2 lg:hidden">
            <button onClick={() => { setNoteOpen((o) => !o); setReportOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} data-testid="note-toggle" className={`relative inline-flex h-9 items-center gap-1.5 rounded-full bg-surface pl-3 pr-3.5 text-[13px] font-semibold shadow-card transition duration-200 active:scale-95 ${noteOpen ? "!bg-mint/15 text-brand" : "text-ink/80"}`}>
              <StickyNote className="h-4 w-4" />Note{hasNote && <span className="h-1.5 w-1.5 rounded-full bg-mint" />}
            </button>
            <button onClick={() => { setReportOpen((o) => !o); setNoteOpen(false); window.scrollTo({ top: 0, behavior: "smooth" }); }} className={`inline-flex h-9 items-center gap-1.5 rounded-full bg-surface pl-3 pr-3.5 text-[13px] font-semibold shadow-card transition duration-200 active:scale-95 ${reportOpen ? "!bg-bad/15 text-bad" : "text-ink/80"}`}>
              <Flag className="h-4 w-4" />Report
            </button>
            <span className="ml-auto sm:hidden"><FontSizeControl f={font} /></span>
          </div>

          <div className="hidden items-center justify-between gap-3 pt-4 lg:flex">
            <button className="btn-ghost h-[54px] w-36 !rounded-[18px] text-[15px]" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft className="h-[19px] w-[19px]" strokeWidth={2.4} />Previous</button>
            <div className="flex gap-2.5">
              {reveal && <button className="btn-ghost h-[54px] !rounded-[18px] !px-5 text-[15px]" onClick={retry}><RotateCcw className="h-4 w-4" />Retry</button>}
              {reveal
                ? <button className="btn h-[54px] w-52 !rounded-[18px] text-base" onClick={next}>{finishing ? "Finishing…" : last ? "Finish" : "Next question"}<ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} /></button>
                : <button className="btn h-[54px] w-52 whitespace-nowrap !rounded-[18px] text-base" disabled={!selected || pending} onClick={submit}>{pending ? "Checking…" : "Check answer"}</button>}
            </div>
          </div>
          <p className="hidden items-center gap-1.5 text-xs text-muted lg:flex"><Keyboard className="h-3.5 w-3.5" />Keys: 1-5 choose · Enter check or next · ← → move</p>
        </div>

        {/* Large screens: the explanation sits beside the question, with the question map under it. */}
        <div className="sticky top-6 hidden max-h-[calc(100vh-3rem)] space-y-4 overflow-y-auto [scrollbar-width:none] lg:block">
          {reveal && (
            <section key={q.id} aria-label="Explanation" className="card animate-rise !rounded-[28px] !px-7 !pb-6 !pt-7" data-testid="explain-panel">
              <Verdict reveal={reveal} choices={q.choices} big />
              <div className="mt-5"><ExplainBody reveal={reveal} choices={q.choices} highlights={expHls} onAdd={(s, e) => onAddHl("explanation", s, e)} onRemove={onRemoveHl} /></div>
            </section>
          )}
          <NavRail sticky={false} items={navItems} current={i} onGo={go} filters={filters} summary={summary}>
            {testId && <button className="btn-ghost w-full" disabled={finishing} onClick={() => void finishNow()}>End session</button>}
          </NavRail>
        </div>
      </div>

      {/* Phones and tablets: the explanation rises from the bottom as a sheet. */}
      <div className="lg:hidden">
        <button aria-label="Close the explanation" tabIndex={-1} onClick={() => setSheetOpen(false)}
          className={`fixed inset-0 z-30 bg-black/55 transition-opacity duration-500 ${reveal && sheetOpen ? "opacity-100" : "pointer-events-none opacity-0"}`} />
        <section aria-label="Explanation" data-testid="explain-sheet" data-state={!reveal ? "hidden" : sheetOpen ? "open" : "peek"}
          className="fixed inset-x-0 bottom-0 z-30 mx-auto flex h-[min(84vh,720px)] max-w-2xl flex-col rounded-t-[30px] border-t border-ink/10 bg-surface shadow-[0_-20px_50px_rgb(0_0_0/.28)] transition-transform duration-[600ms] [transition-timing-function:cubic-bezier(.22,1,.36,1)]"
          style={{ transform: !reveal ? "translateY(105%)" : sheetOpen ? "translateY(0)" : "translateY(calc(100% - 150px - max(env(safe-area-inset-bottom), 14px)))" }}>
          {reveal && (
            <>
              <button onClick={() => setSheetOpen((o) => !o)} aria-expanded={sheetOpen} className="flex shrink-0 flex-col items-center gap-3 px-5 pb-3.5 pt-2.5" data-testid="explain-toggle">
                <span className="h-[5px] w-10 rounded-full bg-ink/15" />
                <Verdict reveal={reveal} choices={q.choices} chevron open={sheetOpen} />
              </button>
              <div className={`min-h-0 flex-1 overflow-y-auto overscroll-contain px-5 pb-28 pt-1 transition-opacity duration-300 ${sheetOpen ? "opacity-100 delay-100" : "pointer-events-none opacity-0"}`}>
                <ExplainBody reveal={reveal} choices={q.choices} highlights={expHls} onAdd={(s, e) => onAddHl("explanation", s, e)} onRemove={onRemoveHl} />
                <LogoLine className="mt-5 justify-center" />
              </div>
            </>
          )}
        </section>
      </div>

      <ActionBar onSheet={!!reveal}>
        <button className={`grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full text-ink transition duration-200 active:scale-90 disabled:opacity-35 ${reveal ? "bg-raised" : "bg-surface shadow-card"}`} aria-label="Previous question" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft className="h-[22px] w-[22px]" /></button>
        {reveal && <button className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-raised text-ink transition duration-200 active:scale-90" aria-label="Retry this question" onClick={retry}><RotateCcw className="h-5 w-5" /></button>}
        {primary}
      </ActionBar>

      <NavSheet open={navOpen} onClose={() => setNavOpen(false)} items={navItems} current={i} onGo={go} filters={filters} summary={summary}
        footer={<>
          {testId && <button className="btn-ghost h-12 flex-1" disabled={finishing} onClick={() => { setNavOpen(false); void finishNow(); }}>Finish</button>}
          <button className="btn h-12 flex-[2]" disabled={firstLeft < 0} onClick={() => { go(firstLeft); setNavOpen(false); }}>Next unanswered</button>
        </>} />
    </div>
  );
}
