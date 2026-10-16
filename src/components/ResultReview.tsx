"use client";
import { useState } from "react";
import { CheckCircle2, ChevronDown, CircleHelp, XCircle } from "lucide-react";
import type { ResultItem } from "@/lib/sessions";

const FILTERS = [["all", "All"], ["incorrect", "Incorrect"], ["unanswered", "Unanswered"], ["correct", "Correct"]] as const;

export default function ResultReview({ items }: { items: ResultItem[] }) {
  const [f, setF] = useState<(typeof FILTERS)[number][0]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const list = items.filter((i) => f === "all" || i.status === f);
  return (
    <section className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="font-display text-xl font-semibold">Question review</h2>
        <div className="flex gap-1.5">
          {FILTERS.map(([k, l]) => (
            <button key={k} onClick={() => setF(k)} data-active={f === k}
              className="rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition data-[active=true]:border-brand data-[active=true]:bg-brand/10 data-[active=true]:text-brand">{l}</button>
          ))}
        </div>
      </div>
      {list.length === 0 && <div className="card text-sm text-muted">Nothing here.</div>}
      {list.map((i) => {
        const Icon = i.status === "correct" ? CheckCircle2 : i.status === "incorrect" ? XCircle : CircleHelp;
        const tone = i.status === "correct" ? "text-good" : i.status === "incorrect" ? "text-bad" : "text-muted";
        const isOpen = open === i.id;
        return (
          <div key={i.id} className="card !p-0 overflow-hidden" data-status={i.status}>
            <button onClick={() => setOpen(isOpen ? null : i.id)} className="flex w-full items-start gap-3 p-4 text-left">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${tone}`} />
              <div className="min-w-0 flex-1">
                <div className="text-xs text-muted">Q{i.position + 1} · {i.chapter} · {i.topic}</div>
                <p className={`mt-1 text-sm ${isOpen ? "" : "line-clamp-2"}`}>{i.text}</p>
              </div>
              <ChevronDown className={`h-4 w-4 shrink-0 text-muted transition ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="space-y-2 border-t border-line p-4">
                {i.group && (i.group.body || i.group.title) && (
                  <div className="rounded-xl border border-brand/30 bg-brand/5 p-3 text-sm">
                    <div className="eyebrow mb-1 !text-brand">{i.group.kind === "case" ? "Clinical case" : i.group.kind === "emq" ? "EMQ" : "Statement"}{i.group.title ? ` · ${i.group.title}` : ""}</div>
                    {i.group.body && <p className="whitespace-pre-line leading-relaxed">{i.group.body}</p>}
                  </div>
                )}
                {i.choices.map((c) => {
                  const chosen = c.id === i.chosenId;
                  const cls = c.isCorrect ? "border-good/50 bg-good/10" : chosen ? "border-bad/50 bg-bad/10" : "border-line";
                  return (
                    <div key={c.id} className={`flex gap-2 rounded-xl border px-3 py-2 text-sm ${cls}`}>
                      <span className="font-semibold">{c.label}.</span><span className="flex-1">{c.text}</span>
                      {c.isCorrect && <span className="text-xs font-semibold text-good">Correct</span>}
                      {chosen && !c.isCorrect && <span className="text-xs font-semibold text-bad">Your answer</span>}
                    </div>
                  );
                })}
                <div className="rounded-xl bg-raised p-3 text-sm leading-relaxed"><div className="eyebrow mb-1">Explanation</div>{i.explanation}{i.peers && <div className="mt-3 border-t border-line pt-2 text-xs text-muted"><b className="text-ink">{i.peers.pct}%</b> of students got this right on their first try ({i.peers.n} students)</div>}</div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
