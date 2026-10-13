"use server";
import { and, eq, inArray, lt, or, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, subjects, subscriptions, coupons } from "@/db";
import { getUser } from "@/lib/auth";
import { addMonths } from "@/lib/access";

function ref() {
  const a = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => a[Math.floor(Math.random() * a.length)]).join("");
}

/** Student asks for a subject. Stays "pending" until the admin confirms the bank transfer. */
export async function requestSubscription(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const subjectId = String(formData.get("subjectId"));
  const [sub] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
  if (!sub) redirect("/plans");
  const mine = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.subjectId, subjectId), inArray(subscriptions.status, ["pending", "active"])));
  // A running subscription can only be renewed in its last 14 days; pending requests are never duplicated.
  const blocked = mine.some((m) => m.status === "pending" || (m.expiresAt && m.expiresAt.getTime() - Date.now() > 14 * 86400000));
  if (blocked || sub.isFree) redirect("/plans");
  let price = sub.price, couponCode = "";
  const code = String(formData.get("coupon") ?? "").trim().toUpperCase().slice(0, 30);
  if (code) {
    const bad = (m: string) => redirect(`/plans?couponError=${encodeURIComponent(m)}&couponFor=${encodeURIComponent(subjectId)}#plan-${encodeURIComponent(subjectId)}`);
    const [c] = await db.select().from(coupons).where(eq(coupons.code, code)).limit(1);
    if (!c || !c.active || (c.expiresAt && c.expiresAt.getTime() < Date.now()) || (c.subjectId && c.subjectId !== subjectId)) bad("That coupon code is not valid for this subject.");
    const [again] = await db.select({ id: subscriptions.id }).from(subscriptions).where(and(eq(subscriptions.userId, user.id), eq(subscriptions.coupon, c!.code), inArray(subscriptions.status, ["pending", "active", "revoked"]))).limit(1);
    if (again) bad("You have already used this coupon.");
    // Count the use atomically so a limited coupon cannot be oversold.
    const [took] = await db.update(coupons).set({ used: sql`${coupons.used} + 1` }).where(and(eq(coupons.id, c!.id), or(eq(coupons.maxUses, 0), lt(coupons.used, coupons.maxUses)))).returning({ id: coupons.id });
    if (!took) bad("This coupon has been fully used.");
    price = Math.round((sub.price * (100 - c!.percentOff)) / 100); couponCode = c!.code;
  }
  if (couponCode && price <= 0) {
    const now = new Date();
    const base = new Date(Math.max(now.getTime(), ...mine.map((m) => m.expiresAt?.getTime() ?? 0)));
    await db.insert(subscriptions).values({ userId: user.id, subjectId, status: "active", reference: "COUPON", price: 0, coupon: couponCode, listPrice: sub.price, approvedAt: now, expiresAt: addMonths(base, sub.durationMonths) });
  } else await db.insert(subscriptions).values({ userId: user.id, subjectId, status: "pending", reference: ref(), price, coupon: couponCode, listPrice: sub.price });
  redirect("/plans");
}

export async function cancelRequest(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const [gone] = await db.delete(subscriptions).where(and(eq(subscriptions.id, String(formData.get("id"))), eq(subscriptions.userId, user.id), eq(subscriptions.status, "pending"))).returning({ coupon: subscriptions.coupon });
  // A cancelled request gives its coupon use back.
  if (gone?.coupon) await db.update(coupons).set({ used: sql`greatest(${coupons.used} - 1, 0)` }).where(eq(coupons.code, gone.coupon));
  redirect("/plans");
}

/** Free subject: access starts immediately for the subject's duration, no approval needed. */
export async function enrollFree(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  const subjectId = String(formData.get("subjectId"));
  const [sub] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
  if (!sub?.isFree) redirect("/plans");
  const running = await db.select().from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.subjectId, subjectId), eq(subscriptions.status, "active")));
  const left = Math.max(0, ...running.map((r) => (r.expiresAt?.getTime() ?? 0) - Date.now()));
  // Same rule as paid renewals: a running subscription can only be renewed in its last 14 days.
  if (left > 14 * 86400000) redirect("/plans");
  const now = new Date();
  const base = new Date(Math.max(now.getTime(), ...running.map((r) => r.expiresAt?.getTime() ?? 0)));
  await db.insert(subscriptions).values({ userId: user.id, subjectId, status: "active", reference: "FREE", price: 0, approvedAt: now, expiresAt: addMonths(base, sub.durationMonths) });
  redirect("/plans");
}
