"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { ADMIN_NAV } from "./adminNav";

export default function AdminNav({ variant, counts }: { variant: "side" | "top"; counts: Record<string, number> }) {
  const path = usePathname();
  const tab = useSearchParams().get("tab") ?? "overview";
  const activeId =
    path.startsWith("/admin/content") ? "content" : path.startsWith("/admin/summaries") ? "summaries" : path.startsWith("/admin/announcements") ? "announcements"
    : path.startsWith("/admin/backup") ? "backup" : path.startsWith("/admin/revenue") ? "revenue" : path.startsWith("/admin/coupons") ? "coupons" : path.startsWith("/admin/students") ? "students" : tab;
  const badge = (id: string) => (counts[id] ? <span className="ml-auto rounded-full bg-bad px-1.5 text-[11px] font-bold text-white">{counts[id]}</span> : null);

  if (variant === "top")
    return (
      <nav className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 lg:hidden">
        {ADMIN_NAV.map((t) => (
          <Link key={t.id} href={t.href} data-active={activeId === t.id}
            className="inline-flex shrink-0 items-center gap-2 rounded-full border border-line bg-white/50 px-3.5 py-2 text-sm font-medium text-muted backdrop-blur transition data-[active=true]:border-brand data-[active=true]:bg-brand data-[active=true]:text-white">
            <t.icon className="h-4 w-4" />{t.label}{counts[t.id] ? <span className="rounded-full bg-bad px-1.5 text-[11px] font-bold text-white">{counts[t.id]}</span> : null}
          </Link>
        ))}
      </nav>
    );

  const group = (g: string, title: string) => (
    <div className="space-y-1">
      <p className="eyebrow px-3 pb-1">{title}</p>
      {ADMIN_NAV.filter((t) => t.group === g).map((t) => (
        <Link key={t.id} href={t.href} data-active={activeId === t.id}
          className="flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-muted transition hover:bg-white/60 hover:text-ink data-[active=true]:bg-brand data-[active=true]:text-white data-[active=true]:shadow-[0_8px_20px_-6px_rgb(var(--brand)/.55)]">
          <t.icon className="h-4 w-4" />{t.label}{badge(t.id)}
        </Link>
      ))}
    </div>
  );
  return <nav className="flex flex-col gap-6">{group("menu", "Menu")}{group("general", "General")}</nav>;
}
