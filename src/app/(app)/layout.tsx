import { redirect } from "next/navigation";
import Link from "next/link";
import { Clock, CreditCard, LogOut, Microscope, Plus } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getCounts } from "@/lib/stats";
import { getExpiryNotices } from "@/lib/access";
import { logout } from "../actions-auth";
import NavLinks from "@/components/NavLinks";
import ThemeToggle from "@/components/ThemeToggle";

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand2 text-white shadow-soft"><Microscope className="h-5 w-5" /></span>
      <span className="font-display text-xl font-semibold tracking-tight">Medical QBank</span>
    </div>
  );
}

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/api/auth/logout?k=1");
  if (user.isAdmin) redirect("/admin");
  const [counts, notices] = await Promise.all([getCounts(user.id), getExpiryNotices(user.id)]);
  const badges = { "/incorrect": counts.incorrect };
  const initials = user.name.split(" ").map((p) => p[0]).slice(0, 2).join("").toUpperCase();

  return (
    <div className="min-h-screen lg:flex">
      <aside className="sticky top-0 hidden h-screen w-64 shrink-0 flex-col gap-6 border-r border-line bg-[rgb(var(--glass)/.62)] p-5 backdrop-blur-2xl backdrop-saturate-150 lg:flex">
        <Brand />
        <Link href="/session/new" className="btn !py-3"><Plus className="h-4 w-4" />New session</Link>
        <nav className="flex flex-col gap-1"><NavLinks variant="side" badges={badges} /></nav>
        <div className="mt-auto space-y-3 rounded-2xl border border-line bg-surface p-3">
          <div className="flex items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-brand to-brand2 text-sm font-bold text-white">{initials}</span>
            <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{user.name}</div><div className="truncate text-xs text-muted">{user.email}</div></div>
          </div>
          <div className="flex gap-2">
            <ThemeToggle className="flex-1" />
            <form action={logout} className="flex-1"><button className="btn-ghost w-full !py-2.5 text-xs" aria-label="Log out"><LogOut className="h-4 w-4" />Log out</button></form>
          </div>
        </div>
      </aside>

      <header className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-[rgb(var(--glass)/.7)] px-4 py-3 backdrop-blur-xl lg:hidden">
        <Brand />
        <div className="flex gap-2"><Link href="/plans" aria-label="Subscriptions" className="btn-ghost !p-2.5"><CreditCard className="h-4 w-4" /></Link><ThemeToggle /><form action={logout}><button className="btn-ghost !p-2.5" aria-label="Log out"><LogOut className="h-4 w-4" /></button></form></div>
      </header>

      <main className="min-w-0 flex-1 px-4 py-6 pb-28 lg:px-10 lg:py-10"><div className="mx-auto max-w-5xl">
        {notices.map((n) => (
          <Link key={n.subjectId} href="/plans" data-testid="expiry-banner" className={`card mb-4 flex items-center gap-3 !p-4 text-sm ${n.kind === "ended" ? "!border-bad/40" : "!border-warn/40"}`}>
            <Clock className={`h-4 w-4 shrink-0 ${n.kind === "ended" ? "text-bad" : "text-warn"}`} />
            <span className="flex-1"><b>{n.subject}</b> {n.kind === "ended" ? "access has ended." : n.days <= 1 ? "ends today or tomorrow." : `ends in ${n.days} days.`}</span>
            <span className="font-semibold text-brand">Renew</span>
          </Link>
        ))}
        {children}</div></main>

      <nav className="fixed inset-x-0 bottom-0 z-30 flex border-t border-line bg-[rgb(var(--glass)/.82)] backdrop-blur-xl lg:hidden"><NavLinks variant="bottom" badges={badges} /></nav>
    </div>
  );
}
