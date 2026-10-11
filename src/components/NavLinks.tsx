"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CreditCard, BarChart3, BookOpen, CircleX, FileText, History, LayoutDashboard, PlusCircle, Star, StickyNote } from "lucide-react";

const ITEMS: { href: string; label: string; icon: typeof History; bottom?: boolean }[] = [
  { href: "/", label: "Dashboard", icon: LayoutDashboard, bottom: true },
  { href: "/subjects", label: "Subjects", icon: BookOpen, bottom: true },
  { href: "/session/new", label: "New session", icon: PlusCircle, bottom: true },
  { href: "/history", label: "History", icon: History, bottom: true },
  { href: "/summaries", label: "Summaries", icon: FileText },
  { href: "/bookmarks", label: "Bookmarks", icon: Star },
  { href: "/incorrect", label: "Incorrect", icon: CircleX },
  { href: "/notes", label: "Notes & Highlights", icon: StickyNote },
  { href: "/progress", label: "Progress", icon: BarChart3, bottom: true },
  { href: "/plans", label: "Subscriptions", icon: CreditCard },
];

export default function NavLinks({ variant, badges }: { variant: "side" | "bottom"; badges?: Record<string, number> }) {
  const items = ITEMS;
  const path = usePathname();
  const active = (href: string) =>
    href === "/" ? path === "/"
    : href === "/session/new" ? path === "/session/new"
    : href === "/history" ? path.startsWith("/history") || path.startsWith("/results") || (path.startsWith("/session/") && path !== "/session/new")
    : path.startsWith(href) || (href === "/subjects" && path.startsWith("/study"));
  if (variant === "bottom")
    return (
      <>
        {items.filter((i) => i.bottom).map(({ href, label, icon: Icon }) => (
          <Link key={href} href={href} aria-label={label} data-active={active(href)}
            className="relative grid flex-1 place-items-center py-3 text-muted transition data-[active=true]:text-brand">
            <Icon className="h-5 w-5" />
            {active(href) && <span className="absolute top-0 h-0.5 w-8 rounded-full bg-brand" />}
            {!!badges?.[href] && <span className="absolute right-[22%] top-2 h-2 w-2 rounded-full bg-bad" />}
          </Link>
        ))}
      </>
    );
  return (
    <>
      {items.map(({ href, label, icon: Icon }) => (
        <Link key={href} href={href} data-active={active(href)} className="nav-link">
          <Icon className="h-[18px] w-[18px]" />{label}
          {!!badges?.[href] && <span className="ml-auto rounded-full bg-bad/15 px-2 py-0.5 text-[11px] font-semibold text-bad">{badges[href]}</span>}
        </Link>
      ))}
    </>
  );
}
