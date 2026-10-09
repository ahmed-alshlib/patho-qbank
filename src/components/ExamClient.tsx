"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, ChevronLeft, ChevronRight, Clock, Flag, GraduationCap, Highlighter, Star } from "lucide-react";
import { answerInSession, finishSession } from "@/app/actions-session";
import { toggleBookmark } from "@/app/actions-study";
import type { Hl, StudyQuestion } from "@/lib/questions";
import HighlightedText from "@/components/HighlightedText";

const clock = (s: number) => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ":" : ""}${String(Math.floor((s % 3600) / 60)).padStart(2, "0")}:${String(s % 60).padStart(2, "0")}`;

export default function ExamClient({ testId, questions, startAt, remainingSec }: { testId: string; questions: StudyQuestion[]; startAt: number; remainingSec: number | null }) {
  const router = useRouter();
  const [i, setI] = useState(startAt);
  const [answers, setAnswers] = useState<Record<string, string>>(Object.fromEntries(questions.filter((q) => q.selected).map((q) => [q.id, q.selected!])));
  const [flagged, setFlagged] = useState<Set<string>>(new Set());
  const [marks, setMarks] = useState<Record<string, Hl[]>>({});
  const [bookmarked, setBookmarked] = useState<Record<string, boolean>>(Object.fromEntries(questions.map((q) => [q.id, q.bookmarked])));
  const [left, setLeft] = useState<number | null>(remainingSec);
  const [confirm, setConfirm] = useState(false);
  const [finishing, setFinishing] = useState(false);
  const [saveError, setSaveError] = useState("");
  const startedAt = useRef(Date.now());
  const deadline = useRef(remainingSec === null ? null : Date.now() + remainingSec * 1000);
  const tempId = useRef(0);
  const q = questions[i];

  const finish = useCallback(async () => {
    if (finishing) return;
    setFinishing(true);
    await finishSession(testId);
    router.push(`/results/${testId}`);
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

  const go = useCallback((n: number) => { setI(n); startedAt.current = Date.now(); }, []);

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

  return (
    <div className="mx-auto max-w-3xl space-y-5">
      <div className="sticky top-0 z-20 -mx-4 flex items-center justify-between gap-3 border-b border-line bg-bg/90 px-4 py-3 backdrop-blur lg:static lg:mx-0 lg:border-0 lg:bg-transparent lg:p-0">
        <span className="chip !text-brand"><GraduationCap className="h-3.5 w-3.5" />Exam mode</span>
        <span className="text-sm font-medium tabular-nums">{answeredCount}/{questions.length} answered</span>
        {left !== null
          ? <span className={`chip tabular-nums !text-sm !font-semibold ${urgent ? "!bg-bad/15 !text-bad animate-pulse" : warn ? "!bg-warn/15 !text-warn" : ""}`}><Clock className="h-3.5 w-3.5" />{clock(left)}</span>
          : <span className="chip">Untimed</span>}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {questions.map((x, n) => {
          const tone = answers[x.id] ? "bg-brand text-white" : "bg-raised text-muted";
          return (
            <button key={x.id} onClick={() => go(n)} title={`Question ${n + 1}`} className={`relative grid h-8 min-w-8 place-items-center rounded-lg px-1 text-xs font-semibold transition hover:scale-110 ${tone} ${n === i ? "ring-2 ring-brand ring-offset-2 ring-offset-bg" : ""}`}>
              {n + 1}{flagged.has(x.id) && <Flag className="absolute -right-1 -top-1 h-3 w-3 fill-warn text-warn" />}
            </button>
          );
        })}
      </div>

      <div key={q.id} className="card card-solid animate-rise space-y-6 !p-6 sm:!p-8">
        <div className="flex items-start justify-between gap-3">
          <span className="chip">Question {i + 1} of {questions.length}</span>
          <div className="flex gap-1">
            <button aria-label="Bookmark" title="Bookmark" className={`btn-ghost !p-2 ${bookmarked[q.id] ? "!border-warn/50 !bg-warn/10" : ""}`}
              onClick={() => { const qid = q.id; setBookmarked((m) => ({ ...m, [qid]: !m[qid] })); toggleBookmark(qid).then((v) => setBookmarked((m) => ({ ...m, [qid]: v }))); }}>
              <Star className={`h-4 w-4 ${bookmarked[q.id] ? "fill-warn text-warn" : ""}`} />
            </button>
            <button aria-label="Flag for review" title="Flag for review (F)" className={`btn-ghost !p-2 ${flagged.has(q.id) ? "!border-warn/50 !bg-warn/10" : ""}`}
              onClick={() => setFlagged((f) => { const n = new Set(f); n.has(q.id) ? n.delete(q.id) : n.add(q.id); return n; })}>
              <Flag className={`h-4 w-4 ${flagged.has(q.id) ? "fill-warn text-warn" : ""}`} />
            </button>
          </div>
        </div>

        <div>
          <HighlightedText text={q.text} highlights={marks[q.id] ?? []} className="text-[17px] leading-relaxed sm:text-lg"
            onAdd={(s, e) => setMarks((m) => ({ ...m, [q.id]: [...(m[q.id] ?? []), { id: `t-${++tempId.current}`, target: "question", start: s, end: e }] }))}
            onRemove={(ids) => setMarks((m) => ({ ...m, [q.id]: (m[q.id] ?? []).filter((h) => !ids.includes(h.id)) }))} />
          <p className="mt-2 inline-flex items-center gap-1.5 text-xs text-muted"><Highlighter className="h-3 w-3" />Highlights are temporary and help you work through the question.</p>
        </div>

        <div className="space-y-2.5">
          {q.choices.map((c, n) => {
            const on = answers[q.id] === c.id;
            return (
              <button key={c.id} onClick={() => choose(c.id)} className={`flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition duration-200 ${on ? "border-brand bg-brand/10 shadow-glow" : "border-line hover:border-brand/50 hover:bg-raised"}`}>
                <span className={`grid h-8 w-8 shrink-0 place-items-center rounded-lg text-sm font-bold ${on ? "bg-brand text-white" : "bg-raised text-muted"}`}>{c.label}</span>
                <span className="text-[15px] leading-snug">{c.text}</span>
                <kbd className="ml-auto hidden rounded border border-line px-1.5 text-[10px] text-muted sm:block">{n + 1}</kbd>
              </button>
            );
          })}
        </div>
        {saveError && <p className="text-sm text-bad">{saveError}</p>}

        <div className="flex items-center justify-between gap-2 border-t border-line pt-5">
          <button className="btn-ghost" disabled={i === 0} onClick={() => go(i - 1)}><ChevronLeft className="h-4 w-4" />Previous</button>
          <div className="flex gap-2">
            <button className="btn-ghost" disabled={i === questions.length - 1} onClick={() => go(i + 1)}>Next<ChevronRight className="h-4 w-4" /></button>
            <button className="btn" onClick={() => setConfirm(true)}>Finish exam</button>
          </div>
        </div>
      </div>

      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => !finishing && setConfirm(false)}>
          <div className="glass-float animate-pop w-full max-w-sm space-y-4 !p-6" onClick={(e) => e.stopPropagation()}>
            <span className={`grid h-12 w-12 place-items-center rounded-2xl ${unanswered ? "bg-warn/15 text-warn" : "bg-good/15 text-good"}`}><AlertTriangle className="h-6 w-6" /></span>
            <h2 className="text-2xl font-semibold">Finish this exam?</h2>
            <p className="text-sm text-muted">{unanswered ? `You have ${unanswered} unanswered question${unanswered === 1 ? "" : "s"}.` : "You answered every question."}{flagged.size ? ` ${flagged.size} flagged for review.` : ""} You can't change answers after finishing.</p>
            <div className="flex gap-2"><button className="btn-ghost flex-1" disabled={finishing} onClick={() => setConfirm(false)}>Keep working</button><button className="btn flex-1" disabled={finishing} onClick={() => void finish()}>{finishing ? "Finishing…" : "Finish"}</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
