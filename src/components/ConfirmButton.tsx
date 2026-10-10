"use client";
/** Submit button that asks for confirmation first (used for deletes). */
export default function ConfirmButton({ message, className = "", children }: { message: string; className?: string; children: React.ReactNode }) {
  return <button className={className} onClick={(e) => { if (!confirm(message)) e.preventDefault(); }}>{children}</button>;
}
