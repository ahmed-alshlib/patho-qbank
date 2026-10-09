"use server";
import { and, eq, inArray } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, subjects, subscriptions } from "@/db";
import { getUser } from "@/lib/auth";

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
  const [existing] = await db.select({ id: subscriptions.id }).from(subscriptions)
    .where(and(eq(subscriptions.userId, user.id), eq(subscriptions.subjectId, subjectId), inArray(subscriptions.status, ["pending", "active"]))).limit(1);
  if (!existing) await db.insert(subscriptions).values({ userId: user.id, subjectId, status: "pending", reference: ref(), price: sub.price });
  redirect("/plans");
}

export async function cancelRequest(formData: FormData) {
  const user = await getUser();
  if (!user) redirect("/login");
  await db.delete(subscriptions).where(and(eq(subscriptions.id, String(formData.get("id"))), eq(subscriptions.userId, user.id), eq(subscriptions.status, "pending")));
  redirect("/plans");
}
