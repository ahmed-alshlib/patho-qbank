"use client";
import { Check, ChevronUp, Lightbulb, Users, X } from "lucide-react";
import type { Hl, Reveal } from "@/lib/questions";
import HighlightedText from "@/components/HighlightedText";

type Choice = { id: string; label: string; text: string };
type Part = { kind: "lead" | "body" | "tip"; text: string; start: number };

const TIP = /^[ \t]*(exam tip|memory tip|tip|remember|mnemonic)\s*[:：]\s*/i;

/**
 * Cuts the stored explanation into what the screen shows: the opening line, the reasoning, and the
 * closing "Exam tip:" line (shown in its own box). Nothing is rewritten: every part remembers where it
 * starts in the original text, so saved highlights (stored as positions in that text) still land right.
 */
export function splitExplanation(text: string): Part[] {
  let end = text.length;
  let tip: Part | null = null;
  // The tip is the last paragraph, when that paragraph starts with a tip label.
  const lastBreak = Math.max(text.lastIndexOf("\n\n"), text.lastIndexOf("\n \n"));
  const tipFrom = lastBreak >= 0 ? lastBreak : text.lastIndexOf("\n");
  if (tipFrom >= 0) {
    const tail = text.slice(tipFrom), lead = tail.length - tail.trimStart().length;
    const m = TIP.exec(tail.slice(lead));
    if (m && tail.slice(lead + m[0].length).trim()) {
      // Same length as the stored text (only the first letter's case changes), so highlight positions still match.
      const body = tail.slice(lead + m[0].length).trimEnd();
      tip = { kind: "tip", text: body.charAt(0).toUpperCase() + body.slice(1), start: tipFrom + lead + m[0].length };
      end = tipFrom;
    }
  }
  const main = text.slice(0, end).trimEnd();
  const parts: Part[] = [];
  const cut = main.indexOf("\n\n");
  if (cut > 0 && cut <= 220 && main.slice(cut).trim()) {
    parts.push({ kind: "lead", text: main.slice(0, cut), start: 0 });
    const rest = main.slice(cut), skip = rest.length - rest.trimStart().length;
    parts.push({ kind: "body", text: rest.slice(skip), start: cut + skip });
  } else if (main) parts.push({ kind: "body", text: main, start: 0 });
  if (tip) parts.push(tip);
  return parts;
}

const within = (hs: Hl[], start: number, len: number) =>
  hs.map((h) => ({ ...h, start: Math.max(0, h.start - start), end: Math.min(len, h.end - start) })).filter((h) => h.end > h.start);

/** "Correct" / "Not quite" with the answer underneath. */
export function Verdict({ reveal, choices, chevron, open, big }: { reveal: Reveal; choices: Choice[]; chevron?: boolean; open?: boolean; big?: boolean }) {
  const right = choices.filter((c) => reveal.correctChoiceIds.includes(c.id));
  const answer = right.length === 1 ? `${right[0].label} · ${right[0].text}` : right.map((c) => c.label).join(" or ");
  return (
    <span className="flex w-full items-center gap-3.5 text-left">
      <span className={`grid shrink-0 place-items-center rounded-full ${big ? "h-12 w-12" : "h-11 w-11"} ${reveal.isCorrect ? "bg-mint text-onmint" : "bg-bad text-bg"}`}>
        {reveal.isCorrect ? <Check className="animate-badge h-6 w-6" strokeWidth={2.8} /> : <X className="animate-badge h-[22px] w-[22px]" strokeWidth={2.8} />}
      </span>
      <span className="min-w-0 flex-1">
        <span className={`block font-display font-bold text-ink ${big ? "text-[22px] font-extrabold" : "text-lg"}`} data-testid="verdict">{reveal.isCorrect ? "Correct" : "Not quite"}</span>
        <span className="mt-0.5 block truncate text-[13.5px] text-muted">{chevron && !open ? `Answer ${right.map((c) => c.label).join(" or ")} · tap to read why` : `The answer is ${answer}`}</span>
      </span>
      {chevron && <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-raised text-ink/80"><ChevronUp className={`h-[19px] w-[19px] transition-transform duration-500 ${open ? "rotate-180" : ""}`} strokeWidth={2.2} /></span>}
    </span>
  );
}

/** The explanation itself: opening line, reasoning, tip box, "why not the others", and how other students did. */
export function ExplainBody({ reveal, choices, highlights = [], onAdd, onRemove }: {
  reveal: Reveal; choices: Choice[]; highlights?: Hl[];
  /** Leave both out for a read-only explanation (the results review): plain text, no highlighting. */
  onAdd?: (start: number, end: number) => void; onRemove?: (ids: string[]) => void;
}) {
  const parts = splitExplanation(reveal.explanation);
  const others = choices.filter((c) => !reveal.correctChoiceIds.includes(c.id) && reveal.why?.[c.id]);
  return (
    <div data-testid="explanation">
      <div className="space-y-3">
        {parts.map((p) => {
          const cls = `qexp leading-[1.6] ${p.kind === "lead" ? "font-semibold text-ink" : p.kind === "tip" ? "text-ink" : "text-ink/85"}`;
          const text = onAdd && onRemove
            ? <HighlightedText text={p.text} highlights={within(highlights, p.start, p.text.length)} onAdd={(s, e) => onAdd(s + p.start, e + p.start)} onRemove={onRemove} className={cls} />
            : <div className={cls}>{p.text}</div>;
          return p.kind === "tip"
            ? <div key={p.start} className="flex items-start gap-3 rounded-[18px] bg-warn/15 p-3.5" data-testid="tip-box"><Lightbulb className="mt-0.5 h-5 w-5 shrink-0 text-warn" /><div className="min-w-0 flex-1">{text}</div></div>
            : <div key={p.start}>{text}</div>;
        })}
      </div>

      {others.length > 0 && (
        <div className="mt-6" data-testid="why-not">
          <p className="eyebrow mb-1">Why not the others</p>
          {others.map((c) => {
            const mine = c.id === reveal.choiceId;
            return (
              <div key={c.id} className="flex items-start gap-3 py-2.5">
                <span className={`grid h-7 w-7 shrink-0 place-items-center rounded-full text-[12.5px] font-bold ${mine ? "bg-bad text-bg" : "bg-raised text-ink/80"}`}>{c.label}</span>
                <p className="qexp min-w-0 flex-1 leading-normal text-ink/85"><b className="font-semibold text-ink">{c.text}</b>{mine ? " (your answer)" : ""}: {reveal.why![c.id]}</p>
              </div>
            );
          })}
        </div>
      )}

      {reveal.peers && (
        <div className="mt-5 flex items-center gap-2 border-t border-line pt-4 text-[13px] text-muted" data-testid="peer-stat">
          <Users className="h-4 w-4 shrink-0" /><span><b className="text-ink">{reveal.peers.pct}%</b> of students got this right on their first try ({reveal.peers.n} students)</span>
        </div>
      )}
    </div>
  );
}
