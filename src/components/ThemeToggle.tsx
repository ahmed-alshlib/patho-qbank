"use client";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle({ className = "", label = false }: { className?: string; label?: boolean }) {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try { localStorage.setItem("theme", dark ? "dark" : "light"); } catch {}
  }
  return (
    <button onClick={toggle} aria-label="Toggle theme" className={`btn-ghost !py-2.5 text-xs ${label ? "" : "!px-2.5"} ${className}`}>
      <Sun className="hidden h-4 w-4 dark:block" /><Moon className="h-4 w-4 dark:hidden" />
      {label && <><span className="hidden dark:inline">Light</span><span className="dark:hidden">Dark</span></>}
    </button>
  );
}
