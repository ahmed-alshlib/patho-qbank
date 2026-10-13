"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, BarChart3, BookOpen, CircleX, FileText, History, LayoutDashboard, PlusCircle, Star, StickyNote } from "lucide-react";

type Item = { href: string; label: string; icon: typeof History; bottom?: boolean; group?: "review" };
export const NAV_ITEMS: Item[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, bottom: true },
  { href: "/subjects", label: "Subjects", icon: BookOpen, bottom: true },
  { href: "/session/new", label: "New session", icon: PlusCircle, bottom: true },
  { href: "/history", label: "History", icon: History, bottom: true },
  { href: "/summaries", label: "Summaries", icon: FileText },
  { href: "/progress", label: "Progress", icon: BarChart3, bottom: true },
  { href: "/plans", label: "Subscriptions", icon: CreditCard },
  { href: "/bookmarks", label: "Bookmarks", icon: Star, group: "review" },
  { href: "/incorrect", label: "Incorrect", icon: CircleX, group: "review" },
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
  if (variant === "bottom")
    return (
      <>
        {NAV_ITEMS.filter((i) => i.bottom).map(({ href, label, icon: Icon }) =>
          href === "/session/new" ? (
            <Link key={href} href={href} aria-label={label} data-testid="bottom-new-session" className="relative grid flex-1 place-items-center">
              <span className={`btn -mt-6 grid h-14 w-14 place-items-center !rounded-full !p-0 ring-4 ring-[rgb(var(--bg))] ${active(href) ? "shadow-glow" : ""}`}><Icon className="h-6 w-6" /></span>
            </Link>
          ) : (
            <Link key={href} href={href} aria-label={label} data-active={active(href)}
              className="relative grid flex-1 place-items-center py-3 text-muted transition data-[active=true]:text-brand">
              <Icon className="h-5 w-5" />
              {active(href) && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
              {!!badges?.[href] && <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-bad" />}
            </Link>
          ))}
      </>
    );
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
