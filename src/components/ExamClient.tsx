"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ArrowRight, Bookmark, ChevronLeft, Clock, Flag, Highlighter, LayoutGrid, Timer } from "lucide-react";
import { answerInSession, finishSession } from "@/app/actions-session";
import { toggleBookmark } from "@/app/actions-study";
import type { Hl, StudyQuestion } from "@/lib/questions";
import { FontSizeControl, useFontScale } from "@/components/FontSize";
import { ActionBar, LogoLine, NavRail, NavSheet, type NavFilter, type NavItem } from "@/components/SessionNav";
import HighlightedText from "@/components/HighlightedText";
import { ChoiceGrid, GRID_FROM, GroupPanel } from "@/components/QuestionGroup";

const clock = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function ExamClient({ testId, questions, startAt, remainingSec, mock = false }: { testId: string; questions: StudyQuestion[]; startAt: number; remainingSec: number | null; mock?: boolean }) {
  const router = useRouter();
  const font = useFontScale();
  const [i, setI] = useState(startAt);
  const [answers, setAnswers] = useState<Record<string, string>>(Object.fromEntries(questions.filter((q) => q.selected).map((q) => [q.id, q.selected!])));
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({});
  const [marks, setMarks] = useState<Record<string, Hl[]>>({});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>(Object.fromEntries(questions.map((q) => [q.id, q.bookmarked])));
  const [left, setLeft] = useState<number | null>(remainingSec);
  const [confirm, setConfirm] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [navOpen, setNavOpen] = useState(false);
  const startedAt = useRef(Date.now());
  const deadline = useRef(remainingSec === null ? null : Date.now() + remainingSec * 1000);
  const tempId = useRef(0);
  const q = questions[i];

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    await finishSession(testId);
    const url = `/results/${testId}`;
    router.push(url);
    // Safety net: if the smooth switch to the results never completes, open them with a normal page load.
    window.setTimeout(() => { if (window.location.pathname !== url) window.location.assign(url); }, 2500);
  }, [finishing, testId, router]);

  useEffect(() => {
    if (deadline.current === null) return;
    const t = setInterval(() => {
      const s = Math.max(0, Math.round((deadline.current! - Date.now()) / 1000));
      setLeft(s);
      if (s === 0) { clearInterval(t); void finish(); }
    }, 1000);
    return () => clearInterval(t);
  }, [finish]);

  const go = useCallback((n: number) => {
    setI(n); startedAt.current = Date.now();
    if (typeof window !== "undefined" && window.scrollY > 120) window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const choose = useCallback((choiceId: string) => {
    const qid = q.id, secs = (Date.now() - startedAt.current) / 1000;
    setAnswers((a) => ({ ...a, [qid]: choiceId })); setSaveError("");
    answerInSession(testId, qid, choiceId, secs).catch((e: Error) => setSaveError(e.message.includes("Time") ? "Time is up." : "Could not save that answer. Check your connection."));
  }, [q.id, testId]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const tag = (e.target as HTMLElement)?.tagName;
      if (tag === "TEXTAREA" || tag === "INPUT" || e.metaKey || e.ctrlKey || e.altKey || confirm) return;
      const k = e.key.toLowerCase();
      const idx = /^[1-6]$/.test(k) ? Number(k) - 1 : k.length === 1 && "abcdef".includes(k) ? "abcdef".indexOf(k) : -1;
      if (idx >= 0 && q.choices[idx]) choose(q.choices[idx].id);
      if (k === "arrowright" && i < questions.length - 1) go(i + 1);
      if (k === "arrowleft" && i > 0) go(i - 1);
      if (k === "f") setFlagged((f) => { const n = new Set(f); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; });
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [q, i, questions.length, choose, go, confirm]);

  const answeredCount = questions.filter((x) => answers[x.id]).length;
  const unanswered = questions.length - answeredCount;
  const urgent = left !== null && left <= 60, warn = left !== null && left <= 300;

  const navItems: NavItem[] = questions.map((x) => ({ id: x.id, tone: answers[x.id] ? "answered" : "none", flagged: flagged.has(x.id), grouped: !!x.group }));
  const filters: NavFilter[] = [
    { key: "all", label: "All", test: () => true },
    { key: "left", label: "Left", test: (x) => x.tone === "none" },
    { key: "flag", label: "Flagged", test: (x) => !!x.flagged },
  ];
  const summary = `${answeredCount} answered · ${unanswered} left`;
  const toggleFlag = () => setFlagged((f) => { const n = new Set(f); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; });
  const timer = left !== null
    ? <span className={`inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[15px] font-bold tabular-nums shadow-card transition-colors duration-500 ${urgent ? "animate-pulse bg-bad/15 text-bad" : warn ? "bg-warn/15 text-warn" : "bg-surface text-ink"}`} data-testid="exam-timer"><Clock className="h-4 w-4" />{clock(left)}</span>
    : <span className="inline-flex h-11 shrink-0 items-center rounded-full bg-surface px-3.5 text-[13px] font-semibold text-muted shadow-card">Untimed</span>;
  const tool = "grid h-10 w-10 shrink-0 place-items-center rounded-full bg-surface text-ink/75 shadow-card transition duration-200 hover:text-ink active:scale-90";

  return (
    <div className="mx-auto max-w-6xl" style={font.style}>
      <div className="flex items-center gap-3">
        <span className="hidden h-11 shrink-0 items-center gap-1.5 rounded-full bg-warn/15 px-3.5 text-[13px] font-bold text-warn sm:inline-flex"><Timer className="h-4 w-4" />{mock ? "Mock exam" : "Exam"}</span>
        <div className="min-w-0 flex-1 lg:mx-auto lg:max-w-md">
          <div className="flex items-center justify-between gap-2 text-[13px] font-semibold"><span className="tabular-nums">Question {i + 1} of {questions.length}</span><span className="text-muted">{answeredCount} answered</span></div>
          <div className="mt-2 h-[5px] overflow-hidden rounded-full bg-ink/[.09]" role="progressbar" aria-label="Exam progress" aria-valuemin={0} aria-valuemax={questions.length} aria-valuenow={answeredCount}>
            <div className="h-full rounded-full bg-mint transition-[width] duration-700 [transition-timing-function:cubic-bezier(.22,1,.36,1)]" style={{ width: `${questions.length ? Math.round((answeredCount / questions.length) * 100) : 0}%` }} />
          </div>
        </div>
        {timer}
        <span className="hidden sm:block"><FontSizeControl f={font} /></span>
        <button onClick={() => setNavOpen(true)} aria-label="All questions" data-testid="open-nav" className="icon-btn lg:hidden"><LayoutGrid className="h-5 w-5" /></button>
      </div>

      <div className="mt-5 lg:mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start lg:gap-9">
        <div key={q.id} className="animate-rise min-w-0 space-y-4 pb-28 lg:pb-0">
          <div className="flex items-center justify-between gap-3">
            <span className="inline-flex h-7 items-center rounded-full bg-surface px-3 text-[12.5px] font-semibold text-ink/80 shadow-card">{q.subject}</span>
            <div className="flex gap-1.5">
              <button aria-label="Save this question" title="Save" aria-pressed={!!bookmarked[q.id]} className={`${tool} ${bookmarked[q.id] ? "!bg-mint/15 !text-brand" : ""}`}
                onClick={() => { const qid = q.id; setBookmarked((m) => ({ ...m, [qid]: !m[qid] })); toggleBookmark(qid).then((v) => setBookmarked((m) => ({ ...m, [qid]: v }))); }}>
                <Bookmark className={`h-[18px] w-[18px] ${bookmarked[q.id] ? "fill-current" : ""}`} />
              </button>
              <button aria-label="Flag for review" title="Flag for review (F)" aria-pressed={flagged.has(q.id)} className={`${tool} ${flagged.has(q.id) ? "!bg-warn/15 !text-warn" : ""}`} onClick={toggleFlag}>
                <Flag className={`h-[18px] w-[18px] ${flagged.has(q.id) ? "fill-current" : ""}`} />
              </button>
            </div>
          </div>

          {q.group && (
            <GroupPanel g={q.group} open={openGroups[q.group.id] ?? q.group.index === 0}
              onToggle={() => setOpenGroups((m) => ({ ...m, [q.group!.id]: !(m[q.group!.id] ?? q.group!.index === 0) }))} />
          )}

          <div>
            <HighlightedText text={q.text} highlights={marks[q.id] ?? []} className="qtext font-medium leading-[1.55] [text-wrap:pretty]"
              onAdd={(s, e) => setMarks((m) => ({ ...m, [q.id]: [...(m[q.id] ?? []), { id: `t-${++tempId.current}`, target: "question", start: s, end: e }] }))}
              onRemove={(ids) => setMarks((m) => ({ ...m, [q.id]: (m[q.id] ?? []).filter((h) => !ids.includes(h.id)) }))} />
            <p className="mt-2 hidden items-center gap-1.5 text-xs text-muted lg:inline-flex"><Highlighter className="h-3 w-3" />Select text to highlight it. Highlights are temporary.</p>
          </div>

          <div className="space-y-2.5 pt-1" role="group" aria-label="Answers">
            {q.choices.length >= GRID_FROM ? (
              <ChoiceGrid choices={q.choices} selectedId={answers[q.id] ?? null} onPick={choose} />
            ) : q.choices.map((c, n) => {
              const on = answers[q.id] === c.id;
              return (
                <button key={c.id} onClick={() => choose(c.id)} aria-pressed={on} data-testid="choice"
                  className={`group flex min-h-[58px] w-full items-center gap-3.5 rounded-[20px] border-[1.5px] py-2.5 pl-[11px] pr-4 text-left shadow-card transition duration-300 active:scale-[.985] lg:min-h-[64px] lg:rounded-[22px] lg:pl-3.5 ${on ? "border-mint bg-mint/10 shadow-glow" : "border-transparent bg-surface hover:bg-ink/[.05]"}`}>
                  <span className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-sm font-bold transition duration-300 ${on ? "scale-110 bg-mint text-onmint" : "bg-raised text-ink/80"}`}>{c.label}</span>
                  <span className="qchoice min-w-0 flex-1 leading-snug">{c.text}</span>
                  <kbd className="ml-auto hidden rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-semibold text-muted lg:group-hover:block">{n + 1}</kbd>
                </button>
              );
            })}
          </div>
          {saveError && <p className="text-sm text-bad">{saveError}</p>}

          <LogoLine className="justify-center pt-1" />

          <div className="flex items-center justify-between gap-3 sm:hidden">
            <span className="text-xs text-muted">Text size</span><FontSizeControl f={font} />
          </div>

          <div className="hidden items-center justify-between gap-3 pt-4 lg:flex">
            <button className="btn-ghost h-[54px] w-36 !rounded-[18px] text-[15px]" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft className="h-[19px] w-[19px]" strokeWidth={2.4} />Previous</button>
            <div className="flex gap-2.5">
              <button className="btn-ghost h-[54px] !rounded-[18px] !px-5 text-[15px]" onClick={() => setConfirm(true)}>Finish exam</button>
              <button className="btn h-[54px] w-44 !rounded-[18px] text-base" disabled={i === questions.length - 1} onClick={() => go(i + 1)}>Next<ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} /></button>
            </div>
          </div>
        </div>

        <NavRail items={navItems} current={i} onGo={go} filters={filters} summary={summary} answeredOnly>
          <button className="btn w-full" onClick={() => setConfirm(true)}>Finish exam</button>
        </NavRail>
      </div>

      <ActionBar>
        <button className="grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-surface text-ink shadow-card transition duration-200 active:scale-90 disabled:opacity-35" aria-label="Previous question" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft className="h-[22px] w-[22px]" /></button>
        {i < questions.length - 1
          ? <button className="btn h-[54px] flex-1 !rounded-[18px] text-base" onClick={() => go(i + 1)} data-testid="exam-next">Next question<ArrowRight className="h-[18px] w-[18px]" strokeWidth={2.4} /></button>
          : <button className="btn h-[54px] flex-1 !rounded-[18px] text-base" onClick={() => setConfirm(true)} data-testid="exam-finish">Finish exam</button>}
      </ActionBar>

      <NavSheet open={navOpen} onClose={() => setNavOpen(false)} items={navItems} current={i} onGo={go} filters={filters} summary={summary} answeredOnly
        footer={<button className="btn h-12 flex-1" onClick={() => { setNavOpen(false); setConfirm(true); }}>Finish exam</button>} />

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => !finishing && setConfirm(false)}>
          <div className="glass-float animate-pop w-full max-w-sm space-y-4 !p-6" onClick={(e) => e.stopPropagation()}>
            <span className={`grid h-12 w-12 place-items-center rounded-full ${unanswered ? "bg-warn/15 text-warn" : "bg-mint/15 text-brand"}`}><AlertTriangle className="h-6 w-6" /></span>
            <h2 className="text-2xl font-extrabold">Finish this exam?</h2>
            <p className="text-sm text-muted">{unanswered ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}.` : "You answered every question."}{flagged.size ? ` ${flagged.size} flagged for review.` : ""} You can't change answers after finishing.</p>
            <div className="flex gap-2.5"><button className="btn-ghost h-12 flex-1" disabled={finishing} onClick={() => setConfirm(false)}>Keep working</button><button className="btn h-12 flex-1" disabled={finishing} onClick={() => void finish()} data-testid="confirm-finish">{finishing ? "Finishing…" : "Finish"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
