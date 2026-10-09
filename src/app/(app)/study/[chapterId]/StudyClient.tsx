"use client";
import { useRef, useState, useTransition } from "react";
import { submitAnswer, type Reveal } from "@/app/actions-study";
import { Bar } from "@/components-ui";

export type StudyQuestion = {
  id: string; topic: string; text: string; difficulty: string;
  choices: { id: string; label: string; text: string }[];
  previous: Reveal | null;
};

export default function StudyClient({ questions, startAt }: { questions: StudyQuestion[]; startAt: number }) {
  const [i, setI] = useState(startAt);
  const [selected, setSelected] = useState<string | null>(null);
  const [results, setResults] = useState<Record<string, Reveal>>(
    Object.fromEntries(questions.filter((q) => q.previous).map((q) => [q.id, q.previous!]))
  );
  const [retrying, setRetrying] = useState<Record<string, boolean>>({});
  const [pending, start] = useTransition();
  const startedAt = useRef(Date.now());

  const q = questions[i];
  const reveal = retrying[q.id] ? undefined : results[q.id];
  const answered = Object.keys(results).length;

  function go(n: number) {
    setI(n);
    setSelected(null);
    startedAt.current = Date.now();
  }

  function submit() {
    if (!selected) return;
    const secs = (Date.now() - startedAt.current) / 1000;
    start(async () => {
      const r = await submitAnswer(q.id, selected, secs);
      setResults((m) => ({ ...m, [q.id]: r }));
      setRetrying((m) => ({ ...m, [q.id]: false }));
    });
  }

  function tone(choiceId: string) {
    if (reveal) {
      if (choiceId === reveal.correctChoiceId) return "border-emerald-500 bg-emerald-50";
      if (choiceId === reveal.choiceId) return "border-red-500 bg-red-50";
      return "border-slate-200 opacity-70";
    }
    return selected === choiceId ? "border-brand-500 bg-brand-50" : "border-slate-200 hover:bg-slate-50";
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex justify-between text-xs text-slate-500">
          <span>Question {i + 1} of {questions.length}</span>
          <span>{answered} answered</span>
        </div>
        <Bar value={(answered / questions.length) * 100} />
      </div>

      <div className="card space-y-5">
        <div className="flex gap-2 text-xs text-slate-500">
          <span className="rounded bg-slate-100 px-2 py-0.5">{q.topic}</span>
          <span className="rounded bg-slate-100 px-2 py-0.5 capitalize">{q.difficulty}</span>
        </div>
        <p className="text-base leading-relaxed">{q.text}</p>

        <div className="space-y-2">
          {q.choices.map((c) => (
            <button key={c.id} disabled={!!reveal} onClick={() => setSelected(c.id)}
              className={`flex w-full items-start gap-3 rounded-lg border p-3 text-left text-sm transition ${tone(c.id)}`}>
              <span className="font-semibold">{c.label}</span>
              <span>{c.text}</span>
            </button>
          ))}
        </div>

        {reveal && (
          <div className={`rounded-lg p-4 text-sm ${reveal.isCorrect ? "bg-emerald-50 text-emerald-900" : "bg-red-50 text-red-900"}`}>
            <div className="mb-1 font-semibold">
              {reveal.isCorrect ? "Correct" : `Incorrect. The correct answer is ${q.choices.find((c) => c.id === reveal.correctChoiceId)?.label}.`}
            </div>
            <p className="leading-relaxed text-slate-800">{reveal.explanation}</p>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <button className="btn-ghost" disabled={i === 0} onClick={() => go(i - 1)}>Previous</button>
          <div className="flex gap-2">
            {reveal ? (
              <>
                <button className="btn-ghost" onClick={() => { setRetrying((m) => ({ ...m, [q.id]: true })); setSelected(null); startedAt.current = Date.now(); }}>Try again</button>
                <button className="btn" disabled={i === questions.length - 1} onClick={() => go(i + 1)}>
                  {i === questions.length - 1 ? "Chapter finished" : "Next question"}
                </button>
              </>
            ) : (
              <button className="btn" disabled={!selected || pending} onClick={submit}>{pending ? "Checking..." : "Submit answer"}</button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
