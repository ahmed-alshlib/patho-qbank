"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CreditCard, BarChart3, BookOpen, CircleX, FileText, History, House, LayoutDashboard, Plus, PlusCircle, RotateCcw, Star, StickyNote } from "lucide-react";

type Item = { href: string; label: string; icon: typeof History; bottom?: boolean; group?: "review" };
export const NAV_ITEMS: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, bottom: true },
  { href: "/subjects", label: "Subjects", icon: BookOpen, bottom: true },
  { href: "/session/new", label: "New session", icon: PlusCircle, bottom: true },
  { href: "/history", label: "History", icon: History },
  { href: "/summaries", label: "Summaries", icon: FileText },
  { href: "/progress", label: "Progress", icon: BarChart3, bottom: true },
  { href: "/plans", label: "Subscriptions", icon: CreditCard },
  { href: "/bookmarks", label: "Bookmarks", icon: Star, group: "review" },
  { href: "/incorrect", label: "Incorrect", icon: CircleX, group: "review", bottom: true },
  { href: "/notes", label: "Notes & Highlights", icon: StickyNote, group: "review" },
];

export function useActive() {
  const path = usePathname();
  return (href: string) =>
    href === "/" ? path === "/"
    : href === "/session/new" ? path === "/session/new"
    : href === "/history" ? path.startsWith("/history") || path.startsWith("/results") || (path.startsWith("/session/") && path !== "/session/new")
    : path.startsWith(href) || (href === "/subjects" && path.startsWith("/study"));
}

export default function NavLinks({ variant, badges }: { variant: "side" | "bottom"; badges?: Record<string, number> }) {
  const active = useActive();
  if (variant === "bottom") {
    // Floating glass bar (phones and tablets): icons only, the current page sits in a lighter pill.
    const tabs: { href: string; label: string; icon: typeof History; fill?: boolean }[] = [
      { href: "/", label: "Home", icon: House, fill: true },
      { href: "/subjects", label: "Subjects", icon: BookOpen },
      { href: "/session/new", label: "New session", icon: Plus },
      { href: "/incorrect", label: "Review mistakes", icon: RotateCcw },
      { href: "/progress", label: "Progress", icon: BarChart3 },
    ];
    return (
      <>
        {tabs.map(({ href, label, icon: Icon, fill }) => {
          const on = active(href);
          if (href === "/session/new")
            return (
              <Link key={href} href={href} aria-label={label} data-testid="bottom-new-session" className="grid h-14 flex-1 place-items-center">
                <span className="grid h-12 w-12 place-items-center rounded-full bg-brand text-white shadow-[0_6px_18px_rgb(var(--brand)/.45)] dark:text-[#02200d]"><Icon className="h-6 w-6" strokeWidth={2.6} /></span>
              </Link>
            );
          return (
            <Link key={href} href={href} aria-label={label} aria-current={on ? "page" : undefined} data-active={on}
              className="relative grid h-14 flex-1 place-items-center rounded-full text-ink/75 transition data-[active=true]:bg-ink/10 data-[active=true]:text-ink">
              <Icon className="h-6 w-6" strokeWidth={on ? 2.4 : 2} {...(on && fill ? { fill: "currentColor" } : {})} />
              {!!badges?.[href] && <span className="absolute right-[calc(50%-15px)] top-3 h-2.5 w-2.5 rounded-full bg-bad ring-2 ring-[rgb(var(--surface))]" />}
            </Link>
          );
        })}
      </>
    );
  }
  const link = ({ href, label, icon: Icon }: Item) => (
    <Link key={href} href={href} data-active={active(href)} className="nav-link">
      <Icon className="h-[18px] w-[18px]" />{label}
      {!!badges?.[href] && <span className="ml-auto rounded-full bg-bad/15 px-2 py-0.5 text-[11px] font-semibold text-bad">{badges[href]}</span>}
    </Link>
  );
  return (
    <>
      {NAV_ITEMS.filter((i) => !i.group).map(link)}
      <p className="eyebrow mt-4 px-3 pb-1">Review</p>
      {NAV_ITEMS.filter((i) => i.group === "review").map(link)}
    </>
  );
}

/** Session screens (a question in progress) take the whole phone screen: no app header or tab bar. */
export function HideInSession({ children }: { children: ReactNode }) {
  const path = usePathname();
  const inSession = path.startsWith("/study/") || path.startsWith("/practice/") || (path.startsWith("/session/") && path !== "/session/new");
  return inSession ? null : <>{children}</>;
}
