import { BookOpen, DatabaseBackup, FileText, Flag, LayoutDashboard, Megaphone, Settings as Cog, Users, Wallet } from "lucide-react";

export const ADMIN_NAV = [
  { id: "overview", label: "Overview", icon: LayoutDashboard, href: "/admin?tab=overview", group: "menu" },
  { id: "requests", label: "Requests", icon: Wallet, href: "/admin?tab=requests", group: "menu" },
  { id: "students", label: "Students", icon: Users, href: "/admin?tab=students", group: "menu" },
  { id: "content", label: "Content", icon: BookOpen, href: "/admin/content", group: "menu" },
  { id: "summaries", label: "Summaries", icon: FileText, href: "/admin/summaries", group: "menu" },
  { id: "announcements", label: "Announcements", icon: Megaphone, href: "/admin/announcements", group: "menu" },
  { id: "reports", label: "Reports", icon: Flag, href: "/admin?tab=reports", group: "menu" },
  { id: "backup", label: "Backup", icon: DatabaseBackup, href: "/admin/backup", group: "general" },
  { id: "settings", label: "Settings", icon: Cog, href: "/admin?tab=settings", group: "general" },
] as const;
