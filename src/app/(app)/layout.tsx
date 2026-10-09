import Link from "next/link";
import { redirect } from "next/navigation";
import { getUser } from "@/lib/auth";
import { logout } from "../actions-auth";

const NAV = [
  { href: "/", label: "Dashboard" },
  { href: "/subjects", label: "Subjects" },
  { href: "/progress", label: "Progress" },
];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getUser();
  if (!user) redirect("/login");
  return (
    <div className="min-h-screen md:flex">
      <aside className="border-b border-slate-200 bg-white md:min-h-screen md:w-56 md:border-b-0 md:border-r">
        <div className="flex items-center justify-between p-4 md:block">
          <div className="text-lg font-semibold text-brand-700">Patho QBank</div>
          <div className="hidden pt-1 text-xs text-slate-500 md:block">{user.name}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col md:px-3">
          {NAV.map((n) => (
            <Link key={n.href} href={n.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-slate-700 hover:bg-slate-100">{n.label}</Link>
          ))}
          <form action={logout}>
            <button className="w-full whitespace-nowrap rounded-lg px-3 py-2 text-left text-sm text-slate-500 hover:bg-slate-100">Logout</button>
          </form>
        </nav>
      </aside>
      <main className="flex-1 p-4 md:p-8"><div className="mx-auto max-w-4xl">{children}</div></main>
    </div>
  );
}
