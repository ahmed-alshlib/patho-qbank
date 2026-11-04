"use client";
import { Check, ChevronDown, Layers, List, X } from "lucide-react";
import type { QGroup } from "@/lib/questions";

/** Choice lists longer than this are shown as a grid of letters instead of full rows. */
export const GRID_FROM = 7;

const KIND_LABEL: Record<QGroup["kind"], string> = { case: "Clinical case", emq: "Options", tf: "True or false" };

/**
 * The shared text above a grouped question: the case scenario, the EMQ option list, or the
 * true/false stem. It opens on the first question of the block and folds to one line after that,
 * so the question itself keeps the screen on a phone.
 */
export function GroupPanel({ g, open, onToggle }: { g: QGroup; open: boolean; onToggle: () => void }) {
  const Icon = g.kind === "case" ? Layers : List;
  // The kind is always named, so a student can see at a glance what sort of block this is.
  const heading = g.kind === "emq"
    ? (g.title ? `Options — ${g.title}` : `Options (A–${g.options.at(-1)?.label ?? "Z"})`)
    : `${KIND_LABEL[g.kind]}${g.title ? ` · ${g.title}` : ""}`;
  const foldable = g.kind !== "tf";

  return (
    <div className="rounded-2xl border border-brand/40 bg-brand/5">
      <div className="flex items-center justify-between gap-3 px-4 py-3">
        <span className="inline-flex min-w-0 items-center gap-2 text-sm font-semibold text-brand">
          <Icon className="h-4 w-4 shrink-0" /><span className="truncate">{heading}</span>
        </span>
        <span className="flex shrink-0 items-center gap-2">
          {g.total > 1 && <span className="text-xs text-muted">{g.index + 1} of {g.total}</span>}
          {foldable && (
            <button onClick={onToggle} className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold text-brand transition hover:bg-brand/10"
              aria-expanded={open}>
              {open ? "Hide" : g.kind === "case" ? "Read" : "Show"}
              <ChevronDown className={`h-3.5 w-3.5 transition ${open ? "rotate-180" : ""}`} />
            </button>
          )}
        </span>
      </div>

      {(open || !foldable) && (
        <div className="space-y-3 border-t border-brand/20 px-4 py-3">
          {g.body && <p className="qtext whitespace-pre-line leading-relaxed">{g.body}</p>}
          {g.options.length > 0 && (
            <ul className="grid grid-cols-1 gap-x-5 gap-y-1.5 sm:grid-cols-2">
              {g.options.map((o) => (
                <li key={o.label} className="flex gap-2 text-sm leading-snug">
                  <span className="font-semibold text-brand">{o.label}</span><span>{o.text}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}

/**
 * A compact grid of letters for long option lists (EMQs run to twenty). The full wording of the
 * option under the cursor is always spelled out underneath, so nobody has to answer from a letter
 * they half remember.
 */
export function ChoiceGrid({ choices, selectedId, correctIds, chosenId, disabled, onPick }: {
  choices: { id: string; label: string; text: string }[];
  selectedId: string | null;
  correctIds?: string[] | null;
  chosenId?: string | null;
  disabled?: boolean;
  onPick: (id: string) => void;
}) {
  const shown = choices.find((c) => c.id === (selectedId ?? chosenId));
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-5 gap-2 sm:grid-cols-8">
        {choices.map((c) => {
          const right = correctIds?.includes(c.id);
          const wrong = !!chosenId && chosenId === c.id && !right;
          const on = selectedId === c.id && !correctIds;
          const cls = right ? "border-good bg-good/15 text-good" : wrong ? "border-bad bg-bad/15 text-bad"
            : on ? "border-brand bg-brand/15 text-ink shadow-glow" : "border-line text-muted hover:border-brand/50 hover:bg-raised";
          return (
            <button key={c.id} disabled={disabled} onClick={() => onPick(c.id)} title={c.text}
              className={`grid h-12 place-items-center rounded-xl border text-base font-bold transition ${cls}`}>
              {right ? <Check className="h-4 w-4" /> : wrong ? <X className="h-4 w-4" /> : c.label}
            </button>
          );
        })}
      </div>
      <p className="min-h-5 text-sm text-muted">
        {shown ? <><span className="font-semibold text-ink">{shown.label}.</span> {shown.text}</> : "Tap a letter — its full wording appears here."}
      </p>
    </div>
  );
}
