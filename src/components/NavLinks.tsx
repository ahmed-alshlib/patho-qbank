"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { CreditCard, BarChart3, BookOpen, Bookmark, FileText, History, House, Lock, Plus, RotateCcw, Sparkles, StickyNote } from "lucide-react";

type Item = { href: string; label: string; icon: typeof History; bottom?: boolean; group?: "review"; soon?: boolean };
export const NAV_ITEMS: Item[] = [
  { href: "/", label: "Home", icon: House, bottom: true },
  { href: "/subjects", label: "Subjects", icon: BookOpen, bottom: true },
  { href: "/history", label: "History", icon: History },
  { href: "/summaries", label: "Summaries", icon: FileText },
  // Reserved place for the next feature. It is not named yet: it only shows as "coming soon".
  { href: "#soon", label: "New feature", icon: Sparkles, soon: true },
  { href: "/progress", label: "Progress", icon: BarChart3, bottom: true },
  { href: "/plans", label: "Subscriptions", icon: CreditCard },
  { href: "/incorrect", label: "Mistakes", icon: RotateCcw, group: "review", bottom: true },
  { href: "/bookmarks", label: "Saved", icon: Bookmark, group: "review" },
  { href: "/notes", label: "Notes & highlights", icon: StickyNote, group: "review" },
];

export function useActive() {
  const path = usePathname();
  return (href: string) =>
    href === "/" ? path === "/"
    : href === "/session/new" ? path === "/session/new"
    : href === "/history" ? path.startsWith("/history") || path.startsWith("/results") || (path.startsWith("/session/") && path !== "/session/new")
    : path.startsWith(href) || (href === "/subjects" && path.startsWith("/study"));
}

const count = (n: number) => (n > 99 ? "99+" : String(n));

/** One row of the side menu and the phone menu. A "soon" row is a locked placeholder, not a link. */
export function NavRow({ item, active, badge }: { item: Item; active: boolean; badge?: number }) {
  const Icon = item.icon;
  if (item.soon)
    return (
      <div className="nav-link cursor-default !text-muted hover:!bg-transparent" aria-disabled="true" data-testid="soon-row">
        <Icon className="h-[19px] w-[19px]" />{item.label}
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-raised px-2 py-1 text-[11px] font-bold text-muted"><Lock className="h-3 w-3" />Soon</span>
      </div>
    );
  return (
    <Link href={item.href} data-active={active} aria-current={active ? "page" : undefined} className="nav-link">
      <Icon className="h-[19px] w-[19px]" {...(active && item.href === "/" ? { fill: "currentColor" } : {})} />{item.label}
      {!!badge && <span className={`ml-auto min-w-6 rounded-full px-1.5 py-0.5 text-center text-xs font-bold ${item.href === "/incorrect" ? "bg-bad text-bg" : "bg-raised text-ink/80"}`}>{count(badge)}</span>}
    </Link>
  );
}

export default function NavLinks({ variant, badges }: { variant: "side" | "bottom"; badges?: Record<string, number> }) {
  const active = useActive();
  if (variant === "bottom") {
    // Floating glass bar (phones and tablets): four labelled tabs with the "new session" button in the middle.
    const tabs: { href: string; label: string; icon: typeof History; fill?: boolean }[] = [
      { href: "/", label: "Home", icon: House, fill: true },
      { href: "/subjects", label: "Subjects", icon: BookOpen },
      { href: "/session/new", label: "New session", icon: Plus },
      { href: "/incorrect", label: "Mistakes", icon: RotateCcw },
      { href: "/progress", label: "Progress", icon: BarChart3 },
    ];
    return (
      <>
        {tabs.map(({ href, label, icon: Icon, fill }) => {
          const on = active(href);
          if (href === "/session/new")
            return (
              <Link key={href} href={href} aria-label={label} data-testid="bottom-new-session"
                className="mx-1.5 grid h-[54px] w-[54px] shrink-0 place-items-center rounded-full bg-mint text-onmint shadow-[0_8px_22px_rgb(var(--mint)/.36)] transition duration-200 active:scale-90">
                <Icon className="h-[26px] w-[26px]" strokeWidth={2.6} />
              </Link>
            );
          return (
            <Link key={href} href={href} aria-current={on ? "page" : undefined} data-active={on}
              className="relative flex h-[54px] min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[27px] text-[11px] font-semibold leading-none text-muted transition duration-200 active:scale-95 data-[active=true]:bg-ink/[.09] data-[active=true]:text-ink">
              <Icon className="h-[22px] w-[22px]" strokeWidth={2.1} {...(on && fill ? { fill: "currentColor" } : {})} />
              <span>{label}</span>
              {!!badges?.[href] && <span className="absolute left-1/2 top-[3px] ml-[7px] min-w-[19px] rounded-full bg-bad px-[5px] text-center text-[11px] font-bold leading-[19px] text-bg" data-testid="tab-badge">{count(badges[href])}</span>}
            </Link>
          );
        })}
      </>
    );
  }
  return (
    <>
      {NAV_ITEMS.filter((i) => !i.group).map((i) => <NavRow key={i.href} item={i} active={active(i.href)} badge={badges?.[i.href]} />)}
      <p className="eyebrow mt-5 px-3 pb-2">Review</p>
      {NAV_ITEMS.filter((i) => i.group === "review").map((i) => <NavRow key={i.href} item={i} active={active(i.href)} badge={badges?.[i.href]} />)}
    </>
  );
}

/** Session screens (a question in progress) take the whole phone screen: no app header or tab bar. */
export function HideInSession({ children }: { children: ReactNode }) {
  const path = usePathname();
  const inSession = path.startsWith("/study/") || path.startsWith("/practice/") || (path.startsWith("/session/") && path !== "/session/new");
  return inSession ? null : <>{children}</>;
}
