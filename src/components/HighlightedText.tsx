"use client";
import { useRef } from "react";
import type { Hl } from "@/lib/questions";

/** Renders text with the student's highlights. Select text to highlight; click a highlight to remove it. */
export default function HighlightedText({ text, highlights, onAdd, onRemove, className = "" }: {
  text: string; highlights: Hl[]; onAdd: (start: number, end: number) => void; onRemove: (ids: string[]) => void; className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  function handleSelect() {
    setTimeout(() => {
      const el = ref.current, sel = window.getSelection();
      if (!el || !sel || sel.isCollapsed || sel.rangeCount === 0) return;
      const range = sel.getRangeAt(0);
      if (!el.contains(range.commonAncestorContainer)) return;
      const pre = document.createRange();
      pre.selectNodeContents(el);
      pre.setEnd(range.startContainer, range.startOffset);
      let start = pre.toString().length;
      let end = start + range.toString().length;
      const raw = text.slice(start, end);
      start += raw.length - raw.trimStart().length;
      end -= raw.length - raw.trimEnd().length;
      sel.removeAllRanges();
      if (end > start) onAdd(start, Math.min(end, text.length));
    }, 0);
  }

  const points = [...new Set([0, text.length, ...highlights.flatMap((h) => [h.start, h.end])])]
    .filter((p) => p >= 0 && p <= text.length).sort((a, b) => a - b);
  const parts = points.slice(0, -1).map((from, i) => {
    const to = points[i + 1];
    const ids = highlights.filter((h) => h.start <= from && h.end >= to).map((h) => h.id);
    return { from, to, ids };
  });

  return (
    <div ref={ref} onMouseUp={handleSelect} onTouchEnd={handleSelect} className={className}>
      {parts.map((p) =>
        p.ids.length ? (
          <mark key={p.from} className="hl text-inherit" title="Click to remove highlight" onClick={() => onRemove(p.ids)}>{text.slice(p.from, p.to)}</mark>
        ) : (
          <span key={p.from}>{text.slice(p.from, p.to)}</span>
        )
      )}
    </div>
  );
}
