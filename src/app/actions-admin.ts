"use server";
import { and, eq, inArray, isNull, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { db, users, reportedQuestions, settings, subjects, subscriptions } from "@/db";
import { getUser } from "@/lib/auth";
import { addMonths } from "@/lib/access";
import { SETTING_KEYS } from "@/lib/settings";

async function admin() {
  const u = await getUser();
  if (!u?.isAdmin) throw new Error("Not allowed");
  return u;
}
const str = (f: FormData, k: string) => String(f.get(k) ?? "");
const done = () => revalidatePath("/admin", "layout");

export async function approveSubscription(f: FormData) {
  await admin();
  const now = new Date();
  const [req] = await db.select().from(subscriptions).where(and(eq(subscriptions.id, str(f, "id")), eq(subscriptions.status, "pending"))).limit(1);
  if (!req) return;
  // Renewals extend from the current end date so students never lose days by renewing early.
  const running = await db.select({ e: subscriptions.expiresAt }).from(subscriptions)
    .where(and(eq(subscriptions.userId, req.userId), eq(subscriptions.subjectId, req.subjectId), eq(subscriptions.status, "active")));
  const base = new Date(Math.max(now.getTime(), ...running.map((r) => r.e?.getTime() ?? 0)));
  const [subj] = await db.select({ m: subjects.durationMonths }).from(subjects).where(eq(subjects.id, req.subjectId)).limit(1);
  await db.update(subscriptions).set({ status: "active", approvedAt: now, expiresAt: addMonths(base, subj?.m ?? 3) }).where(eq(subscriptions.id, req.id));
  done();
}

export async function rejectSubscription(f: FormData) {
  await admin();
  await db.update(subscriptions).set({ status: "rejected" }).where(and(eq(subscriptions.id, str(f, "id")), eq(subscriptions.status, "pending")));
  done();
}

export async function revokeSubscription(f: FormData) {
  await admin();
  await db.update(subscriptions).set({ status: "revoked" }).where(and(eq(subscriptions.id, str(f, "id")), eq(subscriptions.status, "active")));
  done();
}

/** Give a student a subject directly (cash payment, scholarship, renewal...). Starts today, lasts the subject's duration. */
export async function grantSubscription(f: FormData) {
  await admin();
  const userId = str(f, "userId"), subjectId = str(f, "subjectId");
  if (!userId || !subjectId) return;
  const [sub] = await db.select().from(subjects).where(eq(subjects.id, subjectId)).limit(1);
  if (!sub) return;
  await db.update(subscriptions).set({ status: "revoked" }).where(and(eq(subscriptions.userId, userId), eq(subscriptions.subjectId, subjectId), inArray(subscriptions.status, ["active", "pending"])));
  const now = new Date();
  await db.insert(subscriptions).values({ userId, subjectId, status: "active", reference: "ADMIN", price: 0, approvedAt: now, expiresAt: addMonths(now, sub.durationMonths) });
  done();
}

export async function resolveReport(f: FormData) {
  await admin();
  await db.update(reportedQuestions).set({ resolvedAt: new Date() }).where(and(eq(reportedQuestions.id, str(f, "id")), isNull(reportedQuestions.resolvedAt)));
  done();
}

export async function deleteReport(f: FormData) {
  await admin();
  await db.delete(reportedQuestions).where(eq(reportedQuestions.id, str(f, "id")));
  done();
}

export async function saveSettings(f: FormData) {
  await admin();
  for (const k of SETTING_KEYS) {
    const value = str(f, k).trim().slice(0, 500);
    await db.insert(settings).values({ key: k, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
  }
  const all = await db.select({ id: subjects.id }).from(subjects);
  for (const s of all) {
    const n = Math.max(0, Math.min(100000, Math.floor(Number(f.get(`price_${s.id}`)) || 0)));
    const months = Math.max(1, Math.min(36, Math.floor(Number(f.get(`months_${s.id}`)) || 3)));
    await db.update(subjects).set({ price: n, durationMonths: months, isFree: f.get(`free_${s.id}`) === "on" }).where(eq(subjects.id, s.id));
  }
  revalidatePath("/plans"); done();
}

export async function setStudentPassword(f: FormData) {
  await admin();
  const pw = str(f, "password");
  if (pw.length < 8) return;
  await db.update(users).set({ passwordHash: await bcrypt.hash(pw, 10) }).where(eq(users.id, str(f, "userId")));
  await db.execute(sql`delete from user_sessions where user_id = ${str(f, "userId")}`); // sign the student out everywhere
  done();
}

export async function signOutDevices(f: FormData) {
  await admin();
  await db.execute(sql`delete from user_sessions where user_id = ${str(f, "userId")}`);
  done();
}
