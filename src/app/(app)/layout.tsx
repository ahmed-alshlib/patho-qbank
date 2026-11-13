import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, LogOut, Plus } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getCounts } from "@/lib/stats";
import { getExpiryNotices } from "@/lib/access";
import { logout } from "../actions-auth";
import NavLinks, { HideInSession } from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";
import MobileMenu from "@/components/MobileMenu";
import AnnouncementBanner from "@/components/AnnouncementBanner";
import InstallPrompt from "@/components/InstallPrompt";
import Logo from "@/components/Logo";
import { AnalyticsIdentify } from "@/components/Analytics";
import { getLiveAnnouncements } from "@/lib/announcements";

function Brand() {
  return (
    <div className="flex items-center"><Logo className="h-[22px] lg:h-6" /></div>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/api/auth/logout?k=1");
  if (user.isAdmin) redirect("/admin");
  const [counts, notices, live] = await Promise.all([getCounts(user.id), getExpiryNotices(user.id), getLiveAnnouncements()]);
  const badges = { "/incorrect": counts.incorrect };
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen lg:flex">
      <AnalyticsIdentify userId={user.id} />
      <aside className="sticky top-4 z-20 my-4 ml-4 hidden h-[calc(100vh-2rem)] w-[252px] shrink-0 flex-col rounded-[28px] bg-surface p-3.5 pt-6 shadow-card lg:flex">
        <div className="px-3"><Brand /></div>
        <Link href="/session/new" className="btn mt-7 h-12 shrink-0 text-[15px]"><Plus className="h-[19px] w-[19px]" strokeWidth={2.6} />New session</Link>
        <nav className="mt-5 flex min-h-0 flex-col gap-0.5 overflow-y-auto"><NavLinks variant="side" badges={badges} /></nav>
        <div className="mt-auto space-y-2.5 rounded-[20px] bg-raised p-2.5">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-mint font-display text-sm font-extrabold text-onmint">{initials}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{user.name}</div><div className="truncate text-xs text-muted">{user.email}</div></div>
          </div>
          <div className="flex gap-2">
            <ThemeToggle label className="flex-1 !bg-surface !px-2" />
            <form action={logout} className="flex-1"><button className="btn-ghost w-full whitespace-nowrap !bg-surface !px-2 !py-2.5 text-xs" aria-label="Log out"><LogOut className="h-4 w-4 shrink-0" />Log out</button></form>
          </div>
        </div>
      </aside>

      <HideInSession>
        <header className="flex items-center justify-between px-5 pb-1 pt-3.5 lg:hidden">
          <Brand />
          <MobileMenu badges={badges} initials={initials} name={user.name} email={user.email}>
            <ThemeToggle label className="flex-1" />
            <form action={logout} className="flex-1"><button className="btn-ghost w-full !py-2.5 text-xs"><LogOut className="h-4 w-4" />Log out</button></form>
          </MobileMenu>
        </header>
      </HideInSession>

      <main className="min-w-0 flex-1 px-5 pb-32 pt-3 lg:px-10 lg:pb-10 lg:pt-9"><div className="mx-auto max-w-5xl">
        <AnnouncementBanner items={live} />
        <InstallPrompt />
        {notices.map((n) => (
          <Link key={n.subjectId} href="/plans" data-testid="expiry-banner" className={`card mb-4 flex items-center gap-3 !p-4 text-sm ${n.kind === "ended" ? "!border-bad/40" : "!border-warn/40"}`}>
            <Clock className={`h-4 w-4 shrink-0 ${n.kind === "ended" ? "text-bad" : "text-warn"}`} />
            <span className="flex-1"><b>{n.subject}</b> {n.kind === "ended" ? "access has ended." : n.days <= 1 ? "ends today or tomorrow." : `ends in ${n.days} days.`}</span>
            <span className="font-semibold text-brand">Renew</span>
          </Link>
        ))}
        {children}</div></main>

      <HideInSession>
        <nav aria-label="Main" className="fixed inset-x-4 bottom-[max(env(safe-area-inset-bottom),16px)] z-30 mx-auto flex h-[66px] max-w-md items-center rounded-[33px] border border-ink/10 bg-[rgb(var(--glass)/var(--glass-a))] p-1.5 shadow-[0_18px_44px_rgb(0_0_0/.3)] backdrop-blur-2xl backdrop-saturate-150 lg:hidden">
          <NavLinks variant="bottom" badges={badges} />
        </nav>
      </HideInSession>
    </div>
  );
}
