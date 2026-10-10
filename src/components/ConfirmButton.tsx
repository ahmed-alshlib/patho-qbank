"use client";
import { useRef, useState } from "react";
import { createPortal } from "react-dom";

/** Button inside a form that asks "are you sure?" in a dialog before the form is submitted. */
export default function ConfirmButton({ message, title = "Are you sure?", confirmLabel = "Yes, continue", tone = "danger", className = "", children }: {
  message: string; title?: string; confirmLabel?: string; tone?: "danger" | "brand"; className?: string; children: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button type="button" ref={ref} className={className} onClick={() => setOpen(true)}>{children}</button>
      {open && createPortal(
        <div role="dialog" aria-modal="true" aria-label={title} className="fixed inset-0 z-[100] grid place-items-center bg-black/55 p-4 backdrop-blur-sm" onClick={() => setOpen(false)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}>
          <div className="card-solid w-full max-w-sm space-y-4 !rounded-3xl p-5 shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold">{title}</h3>
            <p className="text-sm leading-relaxed text-muted">{message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" className="btn-ghost !py-2" onClick={() => setOpen(false)}>Cancel</button>
              <button type="button" autoFocus data-testid="confirm-yes" className={`btn !py-2 ${tone === "danger" ? "!bg-bad !bg-none" : ""}`}
                onClick={() => { setOpen(false); ref.current?.form?.requestSubmit(); }}>{confirmLabel}</button>
            </div>
          </div>
        </div>, document.body)}
    </>
  );
}
