"use server";
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, subjects, subscriptions } from "@/db";
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
  if (!blocked && !sub.isFree) await db.insert(subscriptions).values({ userId: user.id, subjectId, status: "pending", reference: ref(), price: sub.price });
  redirect("/plans");
}

export async function cancelRequest(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await db.delete(subscriptions).where(and(eq(subscriptions.id, String(formData.get("id"))), eq(subscriptions.userId, user.id), eq(subscriptions.status, "pending")));
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
