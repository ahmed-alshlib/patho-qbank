import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, Mail, Plus, Trash2 } from "lucide-react";
import { getUser } from "@/lib/auth";
import { getSettings } from "@/lib/settings";
import { getRevenue, resolveRange, todayKey } from "@/lib/revenue";
import { TZ } from "@/lib/stats";
import AdminTabs from "../../AdminTabs";
import ConfirmButton from "@/components/ConfirmButton";
import { addFinanceEntry, deleteFinanceEntry } from "../../../actions-finance";

export const dynamic = "force-dynamic";
const dayStr = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });
const pct = (x: number) => `${Math.round(x * 100)}%`;
const hrs = (h: number | null) => (h === null ? "—" : h < 1 ? `${Math.round(h * 60)} min` : h < 48 ? `${h.toFixed(1)} h` : `${(h / 24).toFixed(1)} days`);

function Stat({ label, value, sub, tone }: { label: string; value: string; sub?: string; tone?: "good" | "bad" | "warn" }) {
  return (
    <div className="card !p-4" data-testid="stat">
      <div className="eyebrow">{label}</div>
      <div className={`mt-1 font-display text-2xl font-semibold tabular-nums ${tone === "good" ? "text-good" : tone === "bad" ? "text-bad" : tone === "warn" ? "text-warn" : ""}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-muted">{sub}</div>}
    </div>
  );
}
const H = ({ children, sub }: { children: React.ReactNode; sub?: string }) => <div className="pt-2"><h2 className="text-xl font-semibold">{children}</h2>{sub && <p className="text-sm text-muted">{sub}</p>}</div>;

export default async function RevenuePage({ searchParams }: { searchParams: Promise<{ preset?: string; from?: string; to?: string; exp?: string; saved?: string; error?: string }> }) {
  const user = await getUser();
  if (!user?.isAdmin) redirect("/");
  const sp = await searchParams;
  const range = resolveRange(sp), expDays = sp.exp === "14" ? 14 : 7;
  const [r, cfg] = await Promise.all([getRevenue({ range, expDays }), getSettings()]);
  const rq: Record<string, string> = range.preset === "custom" ? { from: range.from, to: range.to } : { preset: range.preset };
  const href = (extra: Record<string, string> = {}) => `/admin/revenue?${new URLSearchParams({ ...rq, ...extra })}`;
  const PRESETS: [string, string][] = [["today", "Today"], ["7", "7 days"], ["30", "30 days"], ["month", "This month"], ["lastmonth", "Last month"], ["year", "This year"], ["all", "All time"]];
  const cur = cfg.currency, money = (n: number) => `${Math.round(n).toLocaleString("en")} ${cur}`;
  const change = r.prevRev && r.prevRev > 0 ? (r.rev - r.prevRev) / r.prevRev : null;
  const maxBar = Math.max(1, ...r.bars.map((b) => b.site + b.manual));
  const maxSubj = Math.max(1, ...r.bySubject.map((s) => s.revenue));
  const pill = (on: boolean) => `rounded-full border px-3 py-1.5 text-xs font-medium transition ${on ? "border-brand bg-brand/10 text-brand" : "border-line text-muted hover:text-ink"}`;
  const reminder = (name: string, subject: string) => encodeURIComponent(`Hello ${name}, your ${subject} access on Rakeez ends soon. You can renew from the Subscriptions page to keep practising.`);

  return (
    <div className="space-y-6">
      <AdminTabs active="revenue" />
      {sp.error && <div className="card !border-bad/40 text-sm text-bad" role="alert">{sp.error}</div>}

      <section className="card space-y-3 !p-4" data-testid="range-bar">
        <div className="flex flex-wrap gap-2">{PRESETS.map(([k, l]) => <Link key={k} href={`/admin/revenue?preset=${k}`} className={pill(range.preset === k)}>{l}</Link>)}</div>
        <form className="flex flex-wrap items-end gap-2">
          <label className="text-xs text-muted">From<input type="date" name="from" defaultValue={range.all ? "" : range.from} max={todayKey()} className="input mt-1 !w-auto !py-2" required /></label>
          <label className="text-xs text-muted">To<input type="date" name="to" defaultValue={range.all ? "" : range.to} className="input mt-1 !w-auto !py-2" required /></label>
          <button className="btn !py-2">Show</button>
          <a href={`/api/admin/payments?${new URLSearchParams(rq)}`} className="btn-ghost ml-auto !py-2 text-sm"><Download className="h-4 w-4" />Export this period (Excel)</a>
        </form>
        <p className="text-xs text-muted">Showing <b className="text-ink">{range.label}</b>{range.preset === "custom" || range.all ? "" : ` (${range.from} to ${range.to})`}. Money, coupons, students and approval speed follow the dates. Waiting requests, live subscriber counts, expiring lists and renewal rate always show right now. Free enrolments, admin grants and 100% coupons are not counted as revenue.</p>
      </section>

      {/* Overview */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Revenue" value={money(r.rev)} sub={r.manualTotal ? `${money(r.siteTotal)} site · ${money(r.manualTotal)} manual` : `${r.sitePay} payment${r.sitePay === 1 ? "" : "s"}`} />
        <Stat label="Compared with before" value={r.prevRev === null ? "—" : change === null ? (r.rev > 0 ? "New" : "—") : `${change >= 0 ? "▲" : "▼"} ${Math.abs(Math.round(change * 100))}%`} sub={r.prevRev === null ? "Not available for all time" : `Before: ${money(r.prevRev)} (${r.prevLabel})`} tone={change === null ? undefined : change >= 0 ? "good" : "bad"} />
        <Stat label="Average order" value={money(r.aov)} sub={`${r.sitePay} paid subscription${r.sitePay === 1 ? "" : "s"}`} />
        <Stat label="Waiting for approval (now)" value={money(r.pendingValue)} sub={`${r.pendingN} request${r.pendingN === 1 ? "" : "s"}${r.staleN ? ` · ${r.staleN} waiting over 3 days` : ""}`} tone={r.staleN ? "warn" : undefined} />
        <Stat label="Costs" value={money(r.costTotal)} sub="Added by hand below" />
        <Stat label="Net profit" value={money(r.net)} sub="Revenue minus costs" tone={r.net >= 0 ? "good" : "bad"} />
        <Stat label="Paying students" value={String(r.payers)} sub={`${pct(r.conversion)} of ${r.students} registered`} />
        <Stat label="New paying students" value={String(r.newPayers)} sub="Paid for the first time in this period" />
      </section>

      {/* Chart */}
      <section className="card space-y-3" data-testid="revenue-chart">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Revenue per {r.perDay ? "day" : "month"} · {range.label}</h3>
        </div>
        <div className="flex h-44 items-end gap-1" role="img" aria-label="Revenue chart">
          {r.bars.map((b) => {
            const t = b.site + b.manual;
            return (
              <div key={b.label} className="group flex h-full min-w-0 flex-1 flex-col justify-end" title={`${b.label}: ${money(t)}`}>
                <div className="w-full overflow-hidden rounded-t bg-brand/80 transition group-hover:bg-brand" style={{ height: `${(t / maxBar) * 100}%`, minHeight: t ? 3 : 0 }}>
                  {b.manual > 0 && <div className="w-full bg-brand2/70" style={{ height: `${(b.manual / t) * 100}%` }} />}
                </div>
              </div>
            );
          })}
        </div>
        <div className="flex justify-between text-[10px] text-muted"><span>{r.bars[0].label}</span><span>{r.bars[r.bars.length - 1].label}</span></div>
        <p className="text-xs text-muted">Highest bar: {money(maxBar === 1 ? 0 : maxBar)}. Lighter part of a bar = income you added by hand.</p>
      </section>

      {/* By subject */}
      <H sub="Which packages earn and how many students are in each.">By subject</H>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card space-y-3">
          <h3 className="font-semibold">Revenue per subject</h3>
          {r.bySubject.map((s) => (
            <div key={s.name} className="space-y-1" data-testid="subject-rev">
              <div className="flex justify-between text-sm"><span>{s.name}{s.free && <span className="ml-1 text-xs text-muted">(free)</span>}</span><b className="tabular-nums">{money(s.revenue)}</b></div>
              <div className="h-2 rounded-full bg-raised"><div className="h-2 rounded-full bg-gradient-to-r from-brand to-brand2" style={{ width: `${(s.revenue / maxSubj) * 100}%` }} /></div>
            </div>
          ))}
        </div>
        <div className="card overflow-x-auto">
          <h3 className="mb-2 font-semibold">Subscribers per subject <span className="text-xs font-normal text-muted">(right now)</span></h3>
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th className="py-1">Subject</th><th>Active</th><th>Expired</th><th>Pending</th></tr></thead>
            <tbody>{r.bySubject.map((s) => <tr key={s.name} className="border-t border-line"><td className="py-2">{s.name}</td><td className="font-semibold text-good">{s.active}</td><td>{s.expired}</td><td className={s.pending ? "font-semibold text-warn" : ""}>{s.pending}</td></tr>)}</tbody></table>
        </div>
        <Stat label="Conversion rate" value={pct(r.conversion)} sub={`${r.payers} of ${r.students} registered students paid in this period`} />
        <Stat label="Free vs paid" value={`${r.freeThenPaid} of ${r.freeUsers}`} sub="students who enrolled in a free subject later bought a paid one" />
      </section>

      {/* Renewals */}
      <H sub="The easiest extra money: students whose access is about to end.">Renewals and expiry</H>
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Renewal rate" value={r.renewalRate === null ? "—" : pct(r.renewalRate)} sub={r.renewalRate === null ? "No paid subscription has ended yet" : `${r.renewedN} of ${r.expiredN} ended subscriptions were renewed`} />
        <Stat label="Up for renewal, next 30 days" value={money(r.potential)} sub={`${r.expN} paid subscription${r.expN === 1 ? "" : "s"} ending`} />
        <Stat label="Expected from renewals" value={r.expectedNext === null ? "—" : money(r.expectedNext)} sub={r.expectedNext === null ? "Needs renewal history" : "Up for renewal × renewal rate"} />
      </section>
      <section className="card space-y-3" data-testid="expiring">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-semibold">Expiring in {expDays} days ({r.expList.length})</h3>
          <div className="flex gap-2"><Link href={href({ exp: "7" })} className={pill(expDays === 7)}>7 days</Link><Link href={href({ exp: "14" })} className={pill(expDays === 14)}>14 days</Link></div>
        </div>
        {r.expList.length === 0 && <p className="text-sm text-muted">Nobody is expiring in this window, or they already asked to renew.</p>}
        {r.expList.map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm">
            <div className="min-w-0 flex-1"><div className="font-medium">{e.name} <span className="font-normal text-muted">· {e.email}</span></div><div className="text-xs text-muted">{e.subject} · {e.daysLeft <= 1 ? "ends today or tomorrow" : `${e.daysLeft} days left`}{e.paid ? "" : " · free"}</div></div>
            <a className="btn-ghost !py-1.5 text-xs" href={`mailto:${e.email}?subject=${encodeURIComponent("Your Rakeez access ends soon")}&body=${reminder(e.name, e.subject)}`}><Mail className="h-3.5 w-3.5" />Email reminder</a>
          </div>
        ))}
        <p className="text-xs text-muted">Students do not enter a phone number at sign-up, so reminders go by email. Tell me if you want a phone field added so you can use WhatsApp.</p>
      </section>

      {/* Coupons */}
      <H sub="What your discount codes earn and cost.">Coupons</H>
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Lost to discounts" value={money(r.couponLost)} sub="Full price minus amount paid, in this period" tone={r.couponLost ? "warn" : undefined} />
        <Stat label="Bought with a coupon" value={pct(r.couponShare)} sub="Share of purchases using a code" />
        <Stat label="Bought at full price" value={pct(1 - r.couponShare)} sub="Share of purchases with no code" />
      </section>
      <section className="card overflow-x-auto">
        {r.couponRows.length === 0 ? <p className="text-sm text-muted">No coupon has been used yet.</p> : (
          <table className="w-full text-sm"><thead><tr className="text-left text-xs text-muted"><th className="py-1">Code</th><th>Uses</th><th>Revenue</th><th>Discount given</th></tr></thead>
            <tbody>{r.couponRows.map((c, i) => <tr key={c.code} className="border-t border-line"><td className="py-2 font-mono font-semibold">{c.code}{i === 0 && <span className="chip ml-2 !bg-good/15 !text-good">Best</span>}</td><td>{c.uses}</td><td>{money(c.revenue)}</td><td className="text-warn">{money(c.lost)}</td></tr>)}</tbody></table>
        )}
      </section>

      {/* Students */}
      <H sub="Who pays, how fast, and where students drop off.">Students</H>
      <section className="grid gap-4 lg:grid-cols-2">
        <div className="card overflow-x-auto">
          <h3 className="mb-2 font-semibold">Top paying students</h3>
          {r.top.length === 0 ? <p className="text-sm text-muted">No payments yet.</p> : (
            <table className="w-full text-sm"><tbody>{r.top.map((u) => <tr key={u.email} className="border-t border-line first:border-0"><td className="py-2"><div className="font-medium">{u.name}</div><div className="text-xs text-muted">{u.email}</div></td><td className="text-right text-xs text-muted">{u.n} order{u.n === 1 ? "" : "s"}</td><td className="pl-3 text-right font-semibold tabular-nums">{money(u.total)}</td></tr>)}</tbody></table>
          )}
        </div>
        <div className="card space-y-3">
          <h3 className="font-semibold">New paying students per week</h3>
          <div className="flex h-28 items-end gap-2">
            {r.weeks.map((w) => { const mx = Math.max(1, ...r.weeks.map((x) => x.n)); return (
              <div key={w.label} className="flex h-full flex-1 flex-col items-center justify-end gap-1" title={`Week of ${w.label}: ${w.n}`}>
                <span className="text-[10px] font-semibold tabular-nums">{w.n || ""}</span>
                <div className="w-full rounded-t bg-brand/80" style={{ height: `${(w.n / mx) * 70}%`, minHeight: w.n ? 3 : 0 }} />
                <span className="text-[9px] text-muted">{w.label.slice(5)}</span>
              </div>); })}
          </div>
        </div>
        <Stat label="Sign-up to first payment" value={r.toPayDays === null ? "—" : r.toPayDays < 1 ? "Under 1 day" : `${r.toPayDays.toFixed(1)} days`} sub="Median, for students who first paid in this period" />
        <Stat label="Drop-off" value={pct(r.dropoff)} sub={`${r.rejected} declined + ${r.staleInR} waiting over 3 days, of ${r.requests} requests made in this period. Requests students cancel themselves are not recorded.`} tone={r.dropoff > 0.3 ? "warn" : undefined} />
      </section>

      {/* Operations */}
      <H sub="How fast you approve and what was revoked.">Operations</H>
      <section className="grid gap-3 sm:grid-cols-3">
        <Stat label="Average approval time" value={hrs(r.avgWait)} sub={`Median ${hrs(r.medianWait)}`} />
        <Stat label="Longest waiting now" value={r.pendingN ? hrs(r.longestPending) : "—"} sub={r.pendingN ? `${r.pendingN} pending` : "Nothing pending"} tone={r.longestPending > 72 ? "warn" : undefined} />
        <Stat label="Revoked paid access (period)" value={String(r.revoked.length)} sub={money(r.revoked.reduce((a, x) => a + x.price, 0)) + " affected"} />
      </section>
      {r.revoked.length > 0 && (
        <section className="card overflow-x-auto" data-testid="revoked">
          <h3 className="mb-2 font-semibold">Revoked or refunded</h3>
          <table className="w-full text-sm"><tbody>{r.revoked.map((x) => <tr key={x.id} className="border-t border-line first:border-0"><td className="py-2"><div className="font-medium">{x.name}</div><div className="text-xs text-muted">{x.email}</div></td><td>{x.subject}</td><td className="tabular-nums">{money(x.price)}</td><td className="text-xs text-muted">{dayStr(x.at)}</td></tr>)}</tbody></table>
        </section>
      )}

      {/* Manual entries */}
      <div id="manual" />
      <H sub="Add cash you received outside the site, and your costs, so the totals match your real money.">Income and costs you add by hand</H>
      {sp.saved && <div className="card !border-good/40 text-sm text-good">Saved.</div>}
      <section className="card space-y-3">
        <form action={addFinanceEntry} className="grid gap-3 sm:grid-cols-[auto_1fr_1fr_2fr_auto]">
          <select name="kind" className="input !py-2"><option value="income">Income (cash)</option><option value="cost">Cost</option></select>
          <input name="amount" type="number" min={1} className="input !py-2" placeholder={`Amount (${cur})`} required />
          <input name="date" type="date" className="input !py-2" defaultValue={dayStr(r.now)} required />
          <input name="note" className="input !py-2" placeholder="Note, e.g. cash from a student, domain, hosting, ads" maxLength={200} />
          <button className="btn !py-2"><Plus className="h-4 w-4" />Add</button>
        </form>
        {r.entries.length === 0 ? <p className="text-sm text-muted">Nothing added yet.</p> : r.entries.slice(0, 40).map((e) => (
          <div key={e.id} className="flex flex-wrap items-center gap-3 border-t border-line pt-3 text-sm" data-testid="entry-row">
            <span className={`chip ${e.kind === "cost" ? "!bg-bad/15 !text-bad" : "!bg-good/15 !text-good"}`}>{e.kind === "cost" ? "Cost" : "Income"}</span>
            <b className="tabular-nums">{money(e.amount)}</b><span className="text-muted">{dayStr(e.t)}</span><span className="flex-1 text-muted" dir="auto">{e.note}</span>
            <form action={deleteFinanceEntry}><input type="hidden" name="id" value={e.id} /><ConfirmButton message="Delete this entry?" className="btn-ghost !py-1.5 text-xs !text-bad"><Trash2 className="h-3.5 w-3.5" />Delete</ConfirmButton></form>
          </div>
        ))}
      </section>
    </div>
  );
}
