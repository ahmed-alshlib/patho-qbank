import { redirect } from "next/navigation";
import { desc, eq } from "drizzle-orm";
import { Eye, EyeOff, Plus, Trash2 } from "lucide-react";
import { db, coupons, subjects } from "@/db";
import { getUser } from "@/lib/auth";
import AdminTabs from "../../AdminTabs";
import ConfirmButton from "@/components/ConfirmButton";
import { createCoupon, toggleCoupon, deleteCoupon } from "../../../actions-coupons";

export const dynamic = "force-dynamic";
const TZ = process.env.APP_TZ ?? "Africa/Tripoli";

export default async function AdminCoupons({ searchParams }: { searchParams: Promise<{ saved?: string; error?: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const sp = await searchParams;
  const [subs, list] = await Promise.all([
    db.select().from(subjects).orderBy(subjects.order),
    db.select({ c: coupons, subject: subjects.name }).from(coupons).leftJoin(subjects, eq(coupons.subjectId, subjects.id)).orderBy(desc(coupons.createdAt)),
  ]);
  const now = Date.now();
  return (
    <div className="space-y-6">
      <AdminTabs active="coupons" />
      <p className="max-w-2xl text-sm text-muted">Students type the code on the Subscriptions page before they subscribe. The discount is taken off the price, and the payment instructions show the new amount. Each student can use a code once. A 100% code unlocks the subject immediately.</p>
      {sp.error && <div className="card !border-bad/40 text-sm text-bad" role="alert">{sp.error}</div>}
      {sp.saved && <div className="card !border-good/40 text-sm text-good">Coupon created.</div>}

      <section className="card space-y-3">
        <h3 className="text-lg font-semibold">New coupon</h3>
        <form action={createCoupon} className="grid gap-3 sm:grid-cols-2">
          <input name="code" className="input uppercase" placeholder="Code, e.g. RAKEEZ20" required maxLength={30} dir="ltr" />
          <input name="percent" type="number" min={1} max={100} className="input" placeholder="Discount % (1 to 100)" required />
          <select name="subjectId" className="input"><option value="">All subjects</option>{subs.map((s) => <option key={s.id} value={s.id}>{s.name} only</option>)}</select>
          <input name="maxUses" type="number" min={0} className="input" placeholder="Max uses (empty = unlimited)" />
          <label className="flex items-center gap-2 text-sm text-muted">Expires after <input type="date" name="expires" className="input !w-auto !py-2" /></label>
          <button className="btn !py-2 sm:justify-self-start"><Plus className="h-4 w-4" />Create coupon</button>
        </form>
      </section>

      <h3 className="text-lg font-semibold">All coupons ({list.length})</h3>
      {list.length === 0 && <p className="text-sm text-muted">No coupons yet.</p>}
      {list.map(({ c, subject }) => {
        const expired = !!c.expiresAt && c.expiresAt.getTime() < now, full = c.maxUses > 0 && c.used >= c.maxUses;
        const live = c.active && !expired && !full;
        return (
          <div key={c.id} className="card flex flex-wrap items-center gap-3" data-testid="coupon-row">
            <span className="font-mono text-base font-semibold tracking-wider">{c.code}</span>
            <span className="chip">{c.percentOff}% off</span>
            <span className="text-sm text-muted">{subject ?? "All subjects"}</span>
            <span className="text-sm text-muted">Used {c.used}{c.maxUses ? ` / ${c.maxUses}` : ""}</span>
            {c.expiresAt && <span className="text-sm text-muted">Until {c.expiresAt.toLocaleDateString("en-CA", { timeZone: TZ })}</span>}
            <span className={`chip ml-auto ${live ? "!bg-good/15 !text-good" : ""}`}>{live ? "Active" : expired ? "Expired" : full ? "Used up" : "Off"}</span>
            <form action={toggleCoupon}><input type="hidden" name="id" value={c.id} /><button className="btn-ghost !py-1.5 text-xs">{c.active ? <><EyeOff className="h-3.5 w-3.5" />Turn off</> : <><Eye className="h-3.5 w-3.5" />Turn on</>}</button></form>
            <form action={deleteCoupon}><input type="hidden" name="id" value={c.id} /><ConfirmButton message="Delete this coupon?" className="btn-ghost !py-1.5 text-xs !text-bad"><Trash2 className="h-3.5 w-3.5" />Delete</ConfirmButton></form>
          </div>
        );
      })}
    </div>
  );
}
