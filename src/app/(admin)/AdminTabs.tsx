import { ADMIN_NAV } from "./adminNav";

/** The menu now lives in the sidebar (layout). This renders the page title for the active section. */
export default function AdminTabs({ active }: { active: string; counts?: Record<string, number> }) {
  const item = ADMIN_NAV.find((t) => t.id === active);
  if (!item) return null;
  return (
    <div>
      <p className="eyebrow">Admin</p>
      <h1 className="mt-1 flex items-center gap-3 text-3xl font-semibold"><item.icon className="h-7 w-7 text-brand" />{item.label}</h1>
    </div>
  );
}
