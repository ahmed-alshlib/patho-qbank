"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, coupons } from "@/db";
import { getUser } from "@/lib/auth";

async function admin() { const u = await getUser(); if (!u?.isAdmin) throw new Error("Not allowed"); }
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const fail = (m: string) => redirect("/admin/coupons?error=" + encodeURIComponent(m));

export async function createCoupon(f: FormData) {
  await admin();
  const code = str(f, "code").toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 30);
  const percent = Math.floor(Number(f.get("percent")));
  const maxUses = Math.max(0, Math.min(100000, Math.floor(Number(f.get("maxUses")) || 0)));
  const subjectId = str(f, "subjectId") || null;
  const date = str(f, "expires");
  // Libya has no daylight saving time: UTC+2 all year.
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T23:59:59+02:00`) : null;
  if (code.length < 3) fail("The code needs at least 3 letters or numbers.");
  if (!(percent >= 1 && percent <= 100)) fail("Discount must be between 1 and 100 percent.");
  try { await db.insert(coupons).values({ code, percentOff: percent, subjectId, maxUses, expiresAt }); }
  catch { fail(`The code ${code} already exists.`); }
  revalidatePath("/admin/coupons");
  redirect("/admin/coupons?saved=1");
}

export async function toggleCoupon(f: FormData) {
  await admin();
  const id = str(f, "id");
  const [c] = await db.select({ a: coupons.active }).from(coupons).where(eq(coupons.id, id)).limit(1);
  if (c) await db.update(coupons).set({ active: !c.a }).where(eq(coupons.id, id));
  revalidatePath("/admin/coupons");
}

export async function deleteCoupon(f: FormData) {
  await admin();
  await db.delete(coupons).where(eq(coupons.id, str(f, "id")));
  revalidatePath("/admin/coupons");
}
