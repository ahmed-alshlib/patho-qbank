import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { TZ } from "@/lib/stats";
import { resolveRange } from "@/lib/revenue";
const dayKey = (t: number) => new Date(t).toLocaleDateString("en-CA", { timeZone: TZ });

export const dynamic = "force-dynamic";
const cell = (v: unknown) => { const s = String(v ?? ""); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : "") + s.replace(/"/g, '""')}"` : s; };
const fmt = (d: unknown) => (d ? new Date(d as string).toLocaleString("en-CA", { timeZone: TZ, hour12: false }).replace(",", "") : "");

/** All payments and manual entries as a CSV file that Excel opens directly (UTF-8 with BOM so Arabic names display correctly). */
export async function GET(req: Request) {
  const user = await getUser();
  if (!user?.isAdmin) return new Response("Not allowed", { status: 403 });
  const q = new URL(req.url).searchParams;
  const r = resolveRange({ preset: q.get("preset") ?? undefined, from: q.get("from") ?? undefined, to: q.get("to") ?? undefined });
  const subs = (Array.from(await db.execute(sql`
    select s.approved_at, s.created_at, u.name, u.email, sb.name as subject, s.price, s.list_price, s.coupon, s.reference, s.status, s.expires_at
    from subscriptions s join users u on u.id = s.user_id join subjects sb on sb.id = s.subject_id
    where s.status in ('active', 'revoked') and s.price > 0 order by coalesce(s.approved_at, s.created_at) desc`)) as Record<string, unknown>[]).filter((x) => { const k = dayKey(new Date((x.approved_at ?? x.created_at) as string).getTime()); return k >= r.from && k <= r.to; });
  const manual = (Array.from(await db.execute(sql`select kind, amount, note, entry_at from finance_entries order by entry_at desc`)) as Record<string, unknown>[]).filter((x) => { const k = dayKey(new Date(x.entry_at as string).getTime()); return k >= r.from && k <= r.to; });
  const lines = [["Date", "Type", "Student", "Email", "Subject", "Amount", "List price", "Coupon", "Reference", "Status", "Access until", "Note"]];
  for (const r of subs) lines.push([fmt(r.approved_at ?? r.created_at), "Subscription", r.name, r.email, r.subject, r.price, r.list_price || "", r.coupon, r.reference, r.status, fmt(r.expires_at), ""].map(String));
  for (const r of manual) lines.push([fmt(r.entry_at), r.kind === "cost" ? "Cost" : "Manual income", "", "", "", r.kind === "cost" ? -Number(r.amount) : r.amount, "", "", "", "", "", r.note].map(String));
  const body = "﻿" + lines.map((l) => l.map(cell).join(",")).join("\r\n");
  return new Response(body, { headers: { "Content-Type": "text/csv; charset=utf-8", "Content-Disposition": `attachment; filename="rakeez-payments-${r.all ? "all" : `${r.from}_to_${r.to}`}.csv"`, "Cache-Control": "no-store" } });
}
