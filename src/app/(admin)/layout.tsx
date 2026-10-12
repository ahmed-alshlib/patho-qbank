import { Suspense } from "react";
import { redirect } from "next/navigation";
import { unstable_cache } from "next/cache";
import { count, eq, isNull } from "drizzle-orm";
import { LogOut, ShieldCheck } from "lucide-react";
import { db, subscriptions, reportedQuestions } from "@/db";
import { getUser } from "@/lib/auth";
import { logout } from "../actions-auth";
import AdminNav from "./AdminNav";

const navCounts = unstable_cache(async () => {
  const [[p], [r]] = await Promise.all([
    db.select({ n: count() }).from(subscriptions).where(eq(subscriptions.status, "pending")),
    db.select({ n: count() }).from(reportedQuestions).where(isNull(reportedQuestions.resolvedAt)),
  ]);
  return { requests: p.n, reports: r.n };
}, ["admin-nav-counts"], { revalidate: 30 });

function Brand() {
  return (
    <div className="flex items-center gap-2.5">
      <span className="grid h-10 w-10 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand2 text-white shadow-soft"><ShieldCheck className="h-5 w-5" /></span>
      <span className="font-display text-xl font-semibold tracking-tight">Rakeez <span className="text-muted">Admin</span></span>
    </div>
  );
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/api/auth/logout?k=1");
  if (!user.isAdmin) redirect("/");
  const counts = await navCounts();
  return (
    <div className="admin-light relative min-h-screen text-ink">
      <div aria-hidden className="fixed inset-0 -z-10 bg-[#c9cde6] bg-[url('/admin-bg.jpg')] bg-cover bg-center" />
      <div className="mx-auto flex max-w-[1500px] flex-col gap-4 p-3 sm:p-5 lg:flex-row lg:items-start lg:gap-5 lg:p-6">
        <header className="flex items-center justify-between rounded-2xl border border-white/60 bg-white/50 p-3 backdrop-blur-2xl lg:hidden">
          <Brand />
          <form action={logout}><button className="btn-ghost !p-2.5" aria-label="Log out"><LogOut className="h-4 w-4" /></button></form>
        </header>
        <Suspense fallback={null}><AdminNav variant="top" counts={counts} /></Suspense>

        <main className="min-w-0 flex-1 rounded-[2rem] border border-white/60 bg-white/35 p-4 shadow-[0_30px_80px_-30px_rgba(40,50,110,.45)] backdrop-blur-2xl sm:p-6 lg:min-h-[calc(100vh-3rem)] lg:p-8">{children}</main>

        <aside className="sticky top-6 hidden h-[calc(100vh-3rem)] w-72 shrink-0 flex-col gap-8 rounded-[2rem] border border-white/60 bg-white/45 p-5 shadow-[0_30px_80px_-30px_rgba(40,50,110,.45)] backdrop-blur-2xl lg:flex">
          <Brand />
          <Suspense fallback={null}><AdminNav variant="side" counts={counts} /></Suspense>
          <div className="mt-auto space-y-3 rounded-2xl border border-white/70 bg-white/60 p-3">
            <div className="min-w-0"><div className="eyebrow">Signed in</div><div className="truncate text-sm font-semibold">{user.email}</div></div>
            <form action={logout}><button className="btn-ghost w-full !py-2.5 text-xs" aria-label="Log out"><LogOut className="h-4 w-4" />Log out</button></form>
          </div>
        </aside>
      </div>
    </div>
  );
}
