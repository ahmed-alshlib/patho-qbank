import { redirect } from "next/navigation";
import { LogOut, ShieldCheck } from "lucide-react";
import { getUser } from "@/lib/auth";
import { logout } from "../actions-auth";
import ThemeToggle from "@/components/ThemeToggle";

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/api/auth/logout?k=1");
  if (!user.isAdmin) redirect("/");
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-line bg-[rgb(var(--glass)/.7)] backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3 lg:px-10">
          <div className="flex items-center gap-2.5">
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-gradient-to-br from-brand to-brand2 text-white"><ShieldCheck className="h-5 w-5" /></span>
            <span className="font-display text-lg font-semibold tracking-tight">Rakeez <span className="text-muted">Admin</span></span>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden text-xs text-muted sm:inline">{user.email}</span>
            <ThemeToggle />
            <form action={logout}><button className="btn-ghost !px-3 !py-2.5 text-xs" aria-label="Log out"><LogOut className="h-4 w-4" />Log out</button></form>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-5xl px-4 py-8 lg:px-10">{children}</main>
    </div>
  );
}
