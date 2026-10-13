import { sql } from "drizzle-orm";
import { db } from "@/db";
import { TZ } from "@/lib/stats";

const rows = <T,>(r: unknown) => Array.from(r as ArrayLike<T>);
const DAY = 86400000;
const dayKey = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ }); // YYYY-MM-DD in the app timezone
const monthKey = (t: number) => dayKey(t).slice(0, 7);
const shiftMonth = (key: string, by: number) => { const [y, m] = key.split("-").map(Number); const d = new Date(Date.UTC(y, m - 1 + by, 1)); return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`; };
const weekKey = (t: number) => { const [y, m, d] = dayKey(t).split("-").map(Number); const dt = new Date(Date.UTC(y, m - 1, d)); dt.setUTCDate(dt.getUTCDate() - ((dt.getUTCDay() + 6) % 7)); return dt.toISOString().slice(0, 10); };
const addDays = (key: string, n: number) => { const [y, m, d] = key.split("-").map(Number); return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10); };
const daysBetween = (a: string, b: string) => Math.round((Date.parse(b) - Date.parse(a)) / DAY);
export const todayKey = () => dayKey(Date.now());
const isKey = (v?: string) => !!v && /^\d{4}-\d{2}-\d{2}$/.test(v);

export type Range = { from: string; to: string; preset: string; label: string; all: boolean };
/** Turns the page's query (preset or custom dates) into a day range in the app timezone. */
export function resolveRange(sp: { preset?: string; from?: string; to?: string }): Range {
  const today = todayKey(), month = today.slice(0, 7);
  if (isKey(sp.from) && isKey(sp.to)) { const [from, to] = sp.from! <= sp.to! ? [sp.from!, sp.to!] : [sp.to!, sp.from!]; return { from, to, preset: "custom", label: `${from} to ${to}`, all: false }; }
  switch (sp.preset) {
    case "today": return { from: today, to: today, preset: "today", label: "Today", all: false };
    case "7": return { from: addDays(today, -6), to: today, preset: "7", label: "Last 7 days", all: false };
    case "30": return { from: addDays(today, -29), to: today, preset: "30", label: "Last 30 days", all: false };
    case "lastmonth": { const lm = shiftMonth(month, -1); return { from: `${lm}-01`, to: addDays(`${month}-01`, -1), preset: "lastmonth", label: "Last month", all: false }; }
    case "year": return { from: `${today.slice(0, 4)}-01-01`, to: today, preset: "year", label: "This year", all: false };
    case "all": return { from: "0000-01-01", to: "9999-12-31", preset: "all", label: "All time", all: true };
    default: return { from: `${month}-01`, to: today, preset: "month", label: "This month", all: false };
  }
}

const median = (a: number[]) => { if (!a.length) return null; const s = [...a].sort((x, y) => x - y); const m = s.length >> 1; return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
const sum = (a: number[]) => a.reduce((x, y) => x + y, 0);

type Sub = { id: string; user_id: string; name: string; email: string; user_at: number; subject_id: string; subject: string; subject_price: number; status: string; reference: string; price: number; list_price: number; coupon: string; created_at: number; approved_at: number | null; expires_at: number | null };

export type Revenue = Awaited<ReturnType<typeof getRevenue>>;

/** Everything on the Revenue page for one date range. Reads the (small) subscriptions table once and computes in memory. */
export async function getRevenue(opts: { range: Range; expDays: 7 | 14 }) {
  const now = Date.now();
  const { from, to, all: allTime } = opts.range;
  const inR = (t: number) => { const k = dayKey(t); return k >= from && k <= to; };
  const all = rows<Sub>(await db.execute(sql`
    select s.id, s.user_id, u.name, u.email, floor(extract(epoch from u.created_at) * 1000)::float8 as user_at,
      s.subject_id, sb.name as subject, sb.price as subject_price, s.status, s.reference, s.price, s.list_price, s.coupon,
      floor(extract(epoch from s.created_at) * 1000)::float8 as created_at,
      floor(extract(epoch from s.approved_at) * 1000)::float8 as approved_at,
      floor(extract(epoch from s.expires_at) * 1000)::float8 as expires_at
    from subscriptions s join users u on u.id = s.user_id join subjects sb on sb.id = s.subject_id`));
  const entries = rows<{ id: string; kind: string; amount: number; note: string; t: number }>(await db.execute(sql`
    select id, kind, amount, note, floor(extract(epoch from entry_at) * 1000)::float8 as t from finance_entries order by entry_at desc`));
  const [{ students }] = rows<{ students: number }>(await db.execute(sql`select count(*)::int as students from users where not is_admin`));
  const subjects = rows<{ id: string; name: string; price: number; is_free: boolean }>(await db.execute(sql`select id, name, price, is_free from subjects order by "order", name`));

  // ----- Payments: approved subscriptions that were really paid for -----
  const paidAll = all.filter((s) => s.status === "active" && s.price > 0 && s.approved_at);
  const paid = paidAll.filter((s) => inR(s.approved_at!));
  const listOf = (s: Sub) => s.list_price > 0 ? s.list_price : s.subject_price > 0 ? s.subject_price : s.price;
  type Ev = { t: number; amount: number; manual: boolean };
  const eventsAll: Ev[] = [
    ...paidAll.map((s) => ({ t: s.approved_at!, amount: s.price, manual: false })),
    ...entries.filter((e) => e.kind === "income").map((e) => ({ t: e.t, amount: e.amount, manual: true })),
  ];
  const events = eventsAll.filter((e) => inR(e.t));
  const costsAll = entries.filter((e) => e.kind === "cost");
  const costs = costsAll.filter((c) => inR(c.t));
  const rev = sum(events.map((e) => e.amount));
  const costTotal = sum(costs.map((c) => c.amount));
  const sitePay = paid.length;
  const aov = sitePay ? Math.round(sum(paid.map((s) => s.price)) / sitePay) : 0;

  // Previous period of the same length, for the "vs before" comparison.
  let prevRev: number | null = null, prevLabel = "";
  if (!allTime) {
    const n = daysBetween(from, to) + 1, pTo = addDays(from, -1);
    // A calendar month is compared with the whole previous month; other ranges with the same number of days right before.
    const pFrom = from.endsWith("-01") && from.slice(0, 7) === to.slice(0, 7) ? `${shiftMonth(from.slice(0, 7), -1)}-01` : addDays(from, -n);
    prevRev = sum(eventsAll.filter((e) => { const k = dayKey(e.t); return k >= pFrom && k <= pTo; }).map((e) => e.amount));
    prevLabel = `${pFrom} to ${pTo}`;
  }

  const pending = all.filter((s) => s.status === "pending");
  const pendingValue = sum(pending.map((s) => s.price));
  const stale = pending.filter((s) => now - s.created_at > 3 * DAY);

  // ----- Chart: per day for ranges up to ~3 months, otherwise per month -----
  const today = dayKey(now);
  const firstEvent = eventsAll.length ? dayKey(Math.min(...eventsAll.map((e) => e.t))) : today;
  const cFrom = allTime ? firstEvent : from, cTo = to > today ? today : to;
  const perDay = daysBetween(cFrom, cTo) <= 92;
  const bars: { label: string; site: number; manual: number }[] = [];
  if (perDay) { for (let k = cFrom; k <= cTo && bars.length < 100; k = addDays(k, 1)) bars.push({ label: k, site: 0, manual: 0 }); }
  else { for (let m = cFrom.slice(0, 7); m <= cTo.slice(0, 7) && bars.length < 60; m = shiftMonth(m, 1)) bars.push({ label: m, site: 0, manual: 0 }); }
  for (const e of events) { const key = perDay ? dayKey(e.t) : monthKey(e.t); const b = bars.find((x) => x.label === key); if (b) b[e.manual ? "manual" : "site"] += e.amount; }

  // ----- By subject (money in the range; subscriber counts are live) -----
  const bySubject = subjects.map((sb) => {
    const mine = all.filter((s) => s.subject_id === sb.id);
    return {
      name: sb.name, free: sb.is_free,
      revenue: sum(paid.filter((s) => s.subject_id === sb.id).map((s) => s.price)),
      active: mine.filter((s) => s.status === "active" && (s.expires_at ?? 0) > now).length,
      expired: mine.filter((s) => s.status === "active" && (s.expires_at ?? 0) <= now).length,
      pending: mine.filter((s) => s.status === "pending").length,
    };
  });
  const payersAll = new Set(paidAll.map((s) => s.user_id));
  const payers = new Set(paid.map((s) => s.user_id));
  const freeUsers = new Set(all.filter((s) => s.reference === "FREE").map((s) => s.user_id));
  const freeThenPaid = [...freeUsers].filter((u) => payersAll.has(u)).length;

  // ----- Renewals (always based on the whole history) -----
  const renewedAfter = (s: Sub) => all.some((o) => o.id !== s.id && o.user_id === s.user_id && o.subject_id === s.subject_id && o.status === "active" && (o.approved_at ?? 0) > (s.approved_at ?? 0));
  const expiredPaid = paidAll.filter((s) => (s.expires_at ?? 0) <= now);
  const renewedN = expiredPaid.filter(renewedAfter).length;
  const renewalRate = expiredPaid.length ? renewedN / expiredPaid.length : null;
  const hasPendingFor = (s: Sub) => pending.some((p) => p.user_id === s.user_id && p.subject_id === s.subject_id);
  const expiring = (days: number) => all.filter((s) => s.status === "active" && s.expires_at && s.expires_at > now && s.expires_at < now + days * DAY && !renewedAfter(s) && !hasPendingFor(s)).sort((a, b) => a.expires_at! - b.expires_at!);
  const expList = expiring(opts.expDays).map((s) => ({ id: s.id, name: s.name, email: s.email, subject: s.subject, daysLeft: Math.max(0, Math.ceil((s.expires_at! - now) / DAY)), paid: s.price > 0 }));
  const exp30 = expiring(30).filter((s) => s.price > 0);
  const potential = sum(exp30.map((s) => (s.subject_price > 0 ? s.subject_price : s.price)));

  // ----- Coupons (used in the range) -----
  const cp = all.filter((s) => s.coupon && s.status !== "rejected" && inR(s.approved_at ?? s.created_at));
  const byCode = new Map<string, { code: string; uses: number; revenue: number; lost: number }>();
  for (const s of cp) {
    const c = byCode.get(s.coupon) ?? { code: s.coupon, uses: 0, revenue: 0, lost: 0 };
    c.uses++; c.revenue += s.price; c.lost += Math.max(0, listOf(s) - s.price); byCode.set(s.coupon, c);
  }
  const couponRows = [...byCode.values()].sort((a, b) => b.revenue - a.revenue);
  const purchases = paid.length + cp.filter((s) => s.price === 0 && s.status === "active").length;

  // ----- Students -----
  const firstPay = new Map<string, number>();
  for (const s of paidAll) firstPay.set(s.user_id, Math.min(firstPay.get(s.user_id) ?? Infinity, s.approved_at!));
  const byUser = new Map<string, { name: string; email: string; total: number; n: number }>();
  for (const s of paid) { const u = byUser.get(s.user_id) ?? { name: s.name, email: s.email, total: 0, n: 0 }; u.total += s.price; u.n++; byUser.set(s.user_id, u); }
  const top = [...byUser.values()].sort((a, b) => b.total - a.total).slice(0, 10);
  const wFrom = weekKey(Date.parse(`${cFrom}T12:00:00Z`)), wTo = weekKey(Date.parse(`${cTo}T12:00:00Z`));
  const weeks: { label: string; n: number }[] = [];
  for (let k = wTo; k >= wFrom && weeks.length < 12; k = addDays(k, -7)) weeks.unshift({ label: k, n: 0 });
  const newPayers = [...firstPay.entries()].filter(([, t]) => inR(t));
  for (const [, t] of newPayers) { const w = weeks.find((x) => x.label === weekKey(t)); if (w) w.n++; }
  const signup = new Map(all.map((s) => [s.user_id, s.user_at]));
  const toPayDays = median(newPayers.map(([u, t]) => Math.max(0, (t - (signup.get(u) ?? t)) / DAY)));

  const reqs = all.filter((s) => inR(s.created_at) && (s.price > 0 || s.status === "pending"));
  const rejected = reqs.filter((s) => s.status === "rejected").length;
  const staleInR = reqs.filter((s) => s.status === "pending" && now - s.created_at > 3 * DAY).length;

  // ----- Operations -----
  const waits = paid.map((s) => (s.approved_at! - s.created_at) / 3600000).filter((h) => h >= 0);
  const longestPending = pending.length ? Math.max(...pending.map((s) => (now - s.created_at) / 3600000)) : 0;
  const revoked = all.filter((s) => s.status === "revoked" && s.price > 0 && inR(s.approved_at ?? s.created_at)).map((s) => ({ id: s.id, name: s.name, email: s.email, subject: s.subject, price: s.price, at: s.approved_at ?? s.created_at }));

  return {
    now, students, entries, range: opts.range, perDay,
    rev, prevRev, prevLabel, siteTotal: sum(paid.map((s) => s.price)), manualTotal: sum(events.filter((e) => e.manual).map((e) => e.amount)),
    costTotal, net: rev - costTotal,
    sitePay, aov, pendingValue, pendingN: pending.length, staleN: stale.length,
    bars, bySubject, conversion: students ? payers.size / students : 0, payers: payers.size, freeUsers: freeUsers.size, freeThenPaid,
    expList, expiredN: expiredPaid.length, renewedN, renewalRate, potential, expectedNext: renewalRate === null ? null : Math.round(potential * renewalRate), expN: exp30.length,
    couponRows, couponLost: sum(couponRows.map((c) => c.lost)), couponShare: purchases ? cp.filter((s) => s.price > 0 || s.status === "active").length / purchases : 0,
    top, weeks, toPayDays, newPayers: newPayers.length,
    requests: reqs.length, rejected, staleInR, dropoff: reqs.length ? (rejected + staleInR) / reqs.length : 0,
    avgWait: waits.length ? sum(waits) / waits.length : null, medianWait: median(waits), longestPending,
    revoked,
  };
}
