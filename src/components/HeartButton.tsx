"use client";
import { useState, useTransition } from "react";
import { Heart } from "lucide-react";
import { toggleSummaryLike } from "@/app/actions-summaries";

/** Love reaction. Updates instantly, then confirms with the server. */
export default function HeartButton({ id, liked: l0, count: c0, big }: { id: string; liked: boolean; count: number; big?: boolean }) {
  const [liked, setLiked] = useState(l0), [count, setCount] = useState(c0);
  const [, start] = useTransition();
  return (
    <button type="button" aria-pressed={liked} aria-label={liked ? "Remove love" : "Love this summary"} data-testid="heart"
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-line px-2.5 py-1 text-xs font-semibold transition hover:border-bad/50 ${liked ? "!border-bad/40 bg-bad/10 text-bad" : "text-muted"} ${big ? "!px-3.5 !py-2 text-sm" : ""}`}
      onClick={() => {
        const next = !liked; setLiked(next); setCount((n) => Math.max(0, n + (next ? 1 : -1)));
        start(async () => { try { const r = await toggleSummaryLike(id); setLiked(r.liked); setCount(r.count); } catch { setLiked(!next); setCount((n) => Math.max(0, n + (next ? -1 : 1))); } });
      }}>
      <Heart className={`${big ? "h-4 w-4" : "h-3.5 w-3.5"} ${liked ? "fill-bad" : ""}`} />{count > 0 && <span className="tabular-nums">{count}</span>}
    </button>
  );
}
