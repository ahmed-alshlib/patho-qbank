"use client";
import { useState } from "react";
import { ChevronRight } from "lucide-react";

/** Header row with a toggle on the left and an optional action slot (edit menu) on the right. */
export default function Collapsible({ title, meta, action, defaultOpen = false, size = "lg", className = "", testId, children }: {
  title: string; meta?: string; action?: React.ReactNode; defaultOpen?: boolean; size?: "lg" | "md"; className?: string; testId?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className={className} data-testid={testId}>
      <div className="flex items-center gap-2 pr-3">
        <button type="button" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={`flex min-w-0 flex-1 items-center gap-3 text-left ${size === "lg" ? "p-4" : "p-3"}`}>
          <ChevronRight className={`h-4 w-4 shrink-0 text-muted transition-transform ${open ? "rotate-90" : ""}`} />
          <span className="min-w-0 flex-1"><span className={`block truncate ${size === "lg" ? "text-lg font-semibold" : "font-medium"}`}>{title}</span>{meta && <span className="text-xs text-muted">{meta}</span>}</span>
        </button>
        {action}
      </div>
      {open && children}
    </div>
  );
}
