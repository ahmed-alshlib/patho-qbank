import Link from "next/link";
import { BookOpen, Flag, Settings as Cog, Users, Wallet } from "lucide-react";

const TABS = [
  { id: "requests", label: "Requests", icon: Wallet, href: "/admin?tab=requests" },
  { id: "students", label: "Students", icon: Users, href: "/admin?tab=students" },
  { id: "content", label: "Content", icon: BookOpen, href: "/admin/content" },
  { id: "reports", label: "Reports", icon: Flag, href: "/admin?tab=reports" },
  { id: "settings", label: "Settings", icon: Cog, href: "/admin?tab=settings" },
];

export default function AdminTabs({ active, counts = {} }: { active: string; counts?: Record<string, number> }) {
  return (
    <div className="flex flex-wrap gap-2">
      {TABS.map((t) => (
        <Link key={t.id} href={t.href} data-active={active === t.id}
          className="inline-flex items-center gap-2 rounded-full border border-line px-4 py-2 text-sm font-medium text-muted transition data-[active=true]:border-brand data-[active=true]:bg-brand/10 data-[active=true]:text-brand">
          <t.icon className="h-4 w-4" />{t.label}{!!counts[t.id] && <span className="rounded-full bg-bad px-1.5 text-[11px] font-bold text-white">{counts[t.id]}</span>}
        </Link>
      ))}
    </div>
  );
}
