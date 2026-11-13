"use client";
import { useState } from "react";
import { Check, ChevronDown, Minus, X } from "lucide-react";
import type { ResultItem } from "@/lib/sessions";
import { ExplainBody } from "@/components/Explanation";

const FILTERS = [["all", "All"], ["incorrect", "Wrong"], ["unanswered", "Skipped"], ["correct", "Correct"]] as const;

export default function ResultReview({ items }: { items: ResultItem[] }) {
  const [f, setF] = useState<(typeof FILTERS)[number][0]>("all");
  const [open, setOpen] = useState<string | null>(null);
  const list = items.filter((i) => f === "all" || i.status === f);
  return (
    <section className="space-y-3">
      <h2 className="text-lg lg:text-[19px]">Question review</h2>
      <div className="-mx-5 flex gap-2 overflow-x-auto px-5 pb-1 [scrollbar-width:none] lg:mx-0 lg:px-0" role="group" aria-label="Filter questions">
        {FILTERS.map(([k, l]) => <button key={k} onClick={() => setF(k)} data-active={f === k} aria-pressed={f === k} className="pill">{l}<span className="font-medium opacity-60">{items.filter((i) => k === "all" || i.status === k).length}</span></button>)}
      </div>
      {list.length === 0 && <div className="card text-sm text-muted">Nothing here.</div>}
      {list.map((i) => {
        const Icon = i.status === "correct" ? Check : i.status === "incorrect" ? X : Minus;
        const tone = i.status === "correct" ? "bg-mint/15 text-brand" : i.status === "incorrect" ? "bg-bad/15 text-bad" : "bg-raised text-muted";
        const isOpen = open === i.id;
        return (
          <div key={i.id} className="card overflow-hidden !rounded-[22px] !p-0" data-status={i.status}>
            <button onClick={() => setOpen(isOpen ? null : i.id)} aria-expanded={isOpen} className="flex w-full items-start gap-3 py-3.5 pl-4 pr-3.5 text-left">
              <span className={`mt-0.5 grid h-[30px] w-[30px] shrink-0 place-items-center rounded-full ${tone}`}><Icon className="h-4 w-4" strokeWidth={2.6} /></span>
              <div className="min-w-0 flex-1">
                <div className="truncate text-[12.5px] text-muted">Q{i.position + 1} · {i.chapter}{i.topic !== i.chapter ? ` · ${i.topic}` : ""}</div>
                <p className={`mt-0.5 text-[14.5px] leading-snug ${isOpen ? "font-medium" : "line-clamp-2"}`}>{i.text}</p>
              </div>
              <ChevronDown className={`mt-1 h-[18px] w-[18px] shrink-0 text-muted transition-transform duration-300 ${isOpen ? "rotate-180" : ""}`} />
            </button>
            {isOpen && (
              <div className="animate-reveal space-y-2 border-t border-line p-4">
                {i.group && (i.group.body || i.group.title) && (
                  <div className="rounded-2xl bg-raised p-3.5 text-sm">
                    <div className="eyebrow mb-1.5">{i.group.kind === "case" ? "Clinical case" : i.group.kind === "emq" ? "EMQ" : "Statement"}{i.group.title ? ` · ${i.group.title}` : ""}</div>
                    {i.group.body && <p className="whitespace-pre-line leading-relaxed">{i.group.body}</p>}
                  </div>
                )}
                {i.choices.map((c) => {
                  const chosen = c.id === i.chosenId;
                  const cls = c.isCorrect ? "border-mint bg-mint/15" : chosen ? "border-bad bg-bad/15" : "border-transparent bg-raised";
                  return (
                    <div key={c.id} className={`flex items-center gap-3 rounded-2xl border-[1.5px] px-3 py-2.5 text-sm ${cls}`}>
                      <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-xs font-bold ${c.isCorrect ? "bg-mint text-onmint" : chosen ? "bg-bad text-bg" : "bg-surface text-ink/80"}`}>{c.isCorrect ? <Check className="h-4 w-4" strokeWidth={2.8} /> : chosen ? <X className="h-3.5 w-3.5" strokeWidth={2.8} /> : c.label}</span>
                      <span className="min-w-0 flex-1">{c.text}</span>
                      {chosen && <span className={`shrink-0 text-xs font-bold ${c.isCorrect ? "text-good" : "text-bad"}`}>Your answer</span>}
                    </div>
                  );
                })}
                <div className="pt-3">
                  <ExplainBody
                    reveal={{ choiceId: i.chosenId ?? "", isCorrect: i.status === "correct", correctChoiceIds: i.choices.filter((c) => c.isCorrect).map((c) => c.id), explanation: i.explanation, peers: i.peers,
                      why: Object.fromEntries(i.choices.filter((c) => c.note?.trim()).map((c) => [c.id, c.note])) }}
                    choices={i.choices} />
                </div>
              </div>
            )}
          </div>
        );
      })}
    </section>
  );
}
