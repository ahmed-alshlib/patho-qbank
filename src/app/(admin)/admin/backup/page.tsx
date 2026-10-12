import { redirect } from "next/navigation";
import { sql } from "drizzle-orm";
import { Download, ShieldCheck, Upload } from "lucide-react";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { TZ } from "@/lib/stats";
import { BACKUP_GROUPS } from "@/lib/backup";
import AdminTabs from "../../AdminTabs";
import RestoreForm from "@/components/RestoreForm";

export const dynamic = "force-dynamic";

export default async function BackupPage() {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const [last] = Array.from(await db.execute(sql`select value from settings where key = 'backup_last'`)) as unknown as { value: string }[];
  const lastAt = last ? new Date(last.value) : null;
  const days = lastAt ? Math.floor((Date.now() - lastAt.getTime()) / 86400000) : null;

  return (
    <div className="space-y-6">
      <AdminTabs active="backup" />

      <section className="card space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="flex items-center gap-2 text-xl font-semibold"><Download className="h-5 w-5" />Download a backup</h2>
          <span className={`chip ${days === null || days > 7 ? "!bg-warn/15 !text-warn" : ""}`} data-testid="last-backup">
            {lastAt ? `Last backup: ${lastAt.toLocaleString("en", { timeZone: TZ, day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })}` : "No backup yet"}
          </span>
        </div>
        <form action="/api/admin/backup" method="get" className="space-y-3">
          {BACKUP_GROUPS.map((g) => (
            <label key={g.id} className="flex cursor-pointer items-start gap-3 rounded-2xl border border-line p-3">
              <input type="checkbox" name="scopeBox" value={g.id} defaultChecked={g.defaultOn} className="mt-1 h-4 w-4 accent-[rgb(var(--brand))]" data-scope={g.id} />
              <span><span className="block font-medium">{g.label}</span><span className="text-xs text-muted">{g.help}</span></span>
            </label>
          ))}
          <input type="hidden" name="scope" value="" id="scope-field" />
          <button className="btn" id="backup-btn"><Download className="h-4 w-4" />Download backup</button>
          <p className="text-xs text-muted">The file contains student emails and password hashes when "Students" is ticked. Keep it private and never share it. Save a backup before big changes, and about once a week.</p>
        </form>
        <script dangerouslySetInnerHTML={{ __html: `(function(){var f=document.getElementById('scope-field').form;f.addEventListener('submit',function(){var v=[].slice.call(f.querySelectorAll('input[name=scopeBox]:checked')).map(function(i){return i.value});document.getElementById('scope-field').value=v.join(',');f.querySelectorAll('input[name=scopeBox]').forEach(function(i){i.disabled=true});setTimeout(function(){f.querySelectorAll('input[name=scopeBox]').forEach(function(i){i.disabled=false})},300)})})();` }} />
      </section>

      <section className="card space-y-4">
        <h2 className="flex items-center gap-2 text-xl font-semibold"><Upload className="h-5 w-5" />Restore from a backup</h2>
        <p className="text-sm text-muted">Choose a backup file made here. You will see what it contains before anything happens. Restore is safe to repeat: it only adds missing data and never overwrites or deletes. Use it to rebuild an empty or damaged database, or to bring back questions you deleted by mistake.</p>
        <RestoreForm />
      </section>
    </div>
  );
}
