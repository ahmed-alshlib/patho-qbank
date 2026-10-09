"use client";
import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, ChevronLeft, ChevronRight, Clock, Flag, Highlighter, Keyboard, RotateCcw, Star, StickyNote, Trophy, X } from "lucide-react";
import { addHighlight, removeHighlights, reportQuestion, saveNote, submitAnswer, toggleBookmark } from "@/app/actions-study";
import { answerInSession, finishSession } from "@/app/actions-session";
import type { Hl, Reveal, StudyQuestion } from "@/lib/questions";
import HighlightedText from "@/components/HighlightedText";
import { ProgressRing } from "@/components/ui";

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

export default function StudyClient({ questions, startAt, title, backHref, backLabel, fresh = false, testId }: {
  questions: StudyQuestion[]; startAt: number; title: string; backHref: string; backLabel: string; fresh?: boolean; testId?: string;
}) {
  const router = useRouter();
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
  const tempId = useRef(0);
  const [finishing, setFinishing] = useState(false);
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

  const q = questions[i];
  const reveal = retrying[q.id] ? undefined : results[q.id];
  const isDone = (id: string) => !!results[id] && retrying[id] !== true;
  const answeredCount = questions.filter((x) => isDone(x.id)).length;

  useEffect(() => {
    if (reveal) return;
    const t = setInterval(() => setElapsed(Math.round((Date.now() - startedAt.current) / 1000)), 1000);
    return () => clearInterval(t);
  }, [reveal, i]);

  const go = useCallback((n: number) => {
    setI(n); setSelected(null); setNoteOpen(false); setReportOpen(false); setReportDone(false); setElapsed(0);
    startedAt.current = Date.now();
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
      if (!r.isCorrect) setWrongFlash((n) => n + 1);
    });
  }, [selected, reveal, q.id, testId]);

  const finishNow = useCallback(async () => {
    if (!testId) return setFinished(true);
    setFinishing(true);
    await finishSession(testId);
    router.push(`/results/${testId}`);
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
      <div className="card animate-rise mx-auto flex max-w-xl flex-col items-center gap-5 py-12 text-center">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-warn/15 text-warn"><Trophy className="h-7 w-7" /></span>
        <h2 className="text-3xl font-semibold">Session complete</h2>
        <ProgressRing value={acc} size={140} sub={`${correct} of ${done.length} correct`} />
        <p className="max-w-sm text-sm text-muted">{done.length - correct > 0 ? `${done.length - correct} to review. Mistakes are collected automatically so you can retry them.` : "Flawless. Keep the momentum going."}</p>
        <div className="flex flex-wrap justify-center gap-3">
          {done.length - correct > 0 && <Link href="/practice/incorrect" className="btn"><RotateCcw className="h-4 w-4" />Retry incorrect</Link>}
          <button className="btn-ghost" onClick={() => { setFinished(false); go(0); }}>Review from start</button>
          <Link href={backHref} className="btn-ghost">{backLabel}</Link>
        </div>
      </div>
    );
  }

  const hasNote = !!notes[q.id]?.trim();

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
        <Link href={backHref} className="inline-flex items-center gap-1 text-muted transition hover:text-ink"><ChevronLeft className="h-4 w-4" />{backLabel}</Link>
        <span className="font-medium">{title}</span>
        <span className="flex items-center gap-2">
          <span className="chip tabular-nums"><Clock className="h-3.5 w-3.5" />{reveal ? "done" : fmt(elapsed)}</span>
          {testId && <button className="btn-ghost !px-3 !py-1.5 text-xs" disabled={finishing} onClick={() => void finishNow()}>End session</button>}
        </span>
      </div>

      <div className="flex flex-wrap gap-1.5" aria-label="Question navigator">
        {questions.map((x, n) => {
          const r = results[x.id];
          const state = n === i ? "ring-2 ring-brand ring-offset-2 ring-offset-bg " : "";
          const tone = r ? (r.isCorrect ? "bg-good text-white" : "bg-bad text-white") : "bg-raised text-muted";
          return (
            <button key={x.id} onClick={() => go(n)} title={`Question ${n + 1}`}
              className={`${state}${tone} grid h-8 min-w-8 place-items-center rounded-lg px-1 text-xs font-semibold transition hover:scale-110`}>{n + 1}</button>
          );
        })}
      </div>

      <div key={q.id + wrongFlash * 0} className="card card-solid animate-rise space-y-6 !p-6 sm:!p-8">
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            <span className="chip">{q.subject} · {q.chapter}</span>
            <span className="chip">{q.topic}</span>
            <span className={`chip capitalize ${q.difficulty === "hard" ? "!text-bad" : q.difficulty === "easy" ? "!text-good" : "!text-warn"}`}>{q.difficulty}</span>
          </div>
          <div className="flex shrink-0 gap-1">
            <button onClick={onBookmark} aria-label="Bookmark" title="Bookmark" className={`btn-ghost !p-2 ${bookmarked[q.id] ? "!border-warn/50 !bg-warn/10" : ""}`}>
              <Star className={`h-4 w-4 transition ${bookmarked[q.id] ? "fill-warn text-warn" : ""}`} />
            </button>
            <button onClick={() => { setNoteOpen((o) => !o); setReportOpen(false); }} aria-label="Notes" title="Personal note" className={`btn-ghost relative !p-2 ${noteOpen ? "!border-brand/50 !bg-brand/10" : ""}`}>
              <StickyNote className="h-4 w-4" />{hasNote && <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-brand" />}
            </button>
            <button onClick={() => { setReportOpen((o) => !o); setNoteOpen(false); }} aria-label="Report" title="Report a problem" className="btn-ghost !p-2"><Flag className="h-4 w-4" /></button>
          </div>
        </div>

        <div>
          <HighlightedText text={q.text} highlights={tempHls[q.id] ?? []}
            onAdd={(s, e) => onAddHl("question", s, e)} onRemove={onRemoveHl} className="text-[17px] leading-relaxed sm:text-lg" />
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted"><Highlighter className="h-3 w-3" />Highlights on the question are temporary and clear when you answer.</p>
        </div>

        {noteOpen && (
          <div className="animate-reveal overflow-hidden rounded-xl border border-brand/30 bg-brand/5 p-3">
            <textarea className="input min-h-24 resize-y border-0 bg-transparent !shadow-none" placeholder="Write a personal note for this question…" value={notes[q.id] ?? ""} onChange={(e) => onNote(e.target.value)} autoFocus />
            <div className="px-1 text-xs text-muted">{noteState === "saving" ? "Saving…" : noteState === "saved" ? "Saved" : "Notes save automatically"}</div>
          </div>
        )}
        {reportOpen && (
          <div className="animate-reveal overflow-hidden rounded-xl border border-bad/30 bg-bad/5 p-3">
            {reportDone ? <p className="text-sm text-good">Thanks. Your report was sent.</p> : (
              <>
                <textarea className="input min-h-20 resize-y" placeholder="What is wrong with this question?" value={reportText} onChange={(e) => setReportText(e.target.value)} />
                <div className="mt-2 flex justify-end"><button className="btn !py-2" disabled={!reportText.trim() || pending} onClick={sendReport}>Send report</button></div>
              </>
            )}
          </div>
        )}

        <div className={`space-y-2.5 ${wrongFlash && reveal && !reveal.isCorrect ? "animate-shake" : ""}`}>
          {q.choices.map((c, n) => {
            const isRight = reveal?.correctChoiceId === c.id, isWrong = reveal && reveal.choiceId === c.id && !reveal.isCorrect, isSel = selected === c.id && !reveal;
            const cls = isRight ? "border-good bg-good/10" : isWrong ? "border-bad bg-bad/10" : isSel ? "border-brand bg-brand/10 shadow-glow" : reveal ? "border-line opacity-60" : "border-line hover:border-brand/50 hover:bg-raised";
            const badge = isRight ? "bg-good text-white" : isWrong ? "bg-bad text-white" : isSel ? "bg-brand text-white" : "bg-raised text-muted";
            return (
              <button key={c.id} disabled={!!reveal} onClick={() => setSelected(c.id)}
                className={`group flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition duration-200 ${cls} ${isRight ? "animate-pop" : ""}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold transition ${badge}`}>
                  {isRight ? <Check className="h-4 w-4" /> : isWrong ? <X className="h-4 w-4" /> : c.label}
                </span>
                <span className="text-[15px] leading-snug">{c.text}</span>
                {!reveal && <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[10px] text-muted group-hover:block">{n + 1}</kbd>}
              </button>
            );
          })}
        </div>

        {reveal && (
          <div className={`animate-reveal overflow-hidden rounded-xl border p-4 ${reveal.isCorrect ? "border-good/40 bg-good/5" : "border-bad/40 bg-bad/5"}`}>
            <div className={`mb-2 flex items-center gap-2 font-semibold ${reveal.isCorrect ? "text-good" : "text-bad"}`}>
              {reveal.isCorrect ? <Check className="h-5 w-5" /> : <X className="h-5 w-5" />}
              {reveal.isCorrect ? "Correct" : `Incorrect. The right answer is ${q.choices.find((c) => c.id === reveal.correctChoiceId)?.label}.`}
            </div>
            <HighlightedText text={reveal.explanation} highlights={(hls[q.id] ?? []).filter((h) => h.target === "explanation")}
              onAdd={(s, e) => onAddHl("explanation", s, e)} onRemove={onRemoveHl} className="text-sm leading-relaxed" />
          </div>
        )}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-5">
          <button className="btn-ghost" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft className="h-4 w-4" />Previous</button>
          <div className="flex gap-2">
            {reveal ? (
              <>
                <button className="btn-ghost" onClick={() => { setRetrying((m) => ({ ...m, [q.id]: true })); setSelected(null); startedAt.current = Date.now(); setElapsed(0); }}><RotateCcw className="h-4 w-4" />Retry</button>
                <button className="btn" onClick={next}>{finishing ? "Finishing…" : i === questions.length - 1 ? "Finish" : "Next"}<ChevronRight className="h-4 w-4" /></button>
              </>
            ) : (
              <button className="btn" disabled={!selected || pending} onClick={submit}>{pending ? "Checking…" : "Submit answer"}</button>
            )}
          </div>
        </div>
      </div>

      <div className="flex items-center justify-between text-xs text-muted">
        <span>{answeredCount} of {questions.length} answered</span>
        <span className="hidden items-center gap-1.5 sm:inline-flex"><Keyboard className="h-3.5 w-3.5" />1-5 choose · Enter submit/next · ← → navigate</span>
      </div>
    </div>
  );
}
