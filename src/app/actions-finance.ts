"use server";
import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, financeEntries } from "@/db";
import { getUser } from "@/lib/auth";

async function admin() { const u = await getUser(); if (!u?.isAdmin) throw new Error("Not allowed"); }
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();

export async function addFinanceEntry(f: FormData) {
  await admin();
  const kind = str(f, "kind") === "cost" ? "cost" : "income";
  const amount = Math.floor(Number(f.get("amount")));
  const date = str(f, "date");
  const note = str(f, "note").slice(0, 200);
  if (!(amount > 0 && amount <= 10_000_000) || !/^\d{4}-\d{2}-\d{2}$/.test(date)) redirect("/admin/revenue?error=" + encodeURIComponent("Enter an amount above 0 and a date.") + "#manual");
  // Libya has no daylight saving time: UTC+2 all year.
  await db.insert(financeEntries).values({ kind, amount, note, entryAt: new Date(`${date}T12:00:00+02:00`) });
  revalidatePath("/admin/revenue");
  redirect("/admin/revenue?saved=1#manual");
}

export async function deleteFinanceEntry(f: FormData) {
  await admin();
  await db.delete(financeEntries).where(eq(financeEntries.id, str(f, "id")));
  revalidatePath("/admin/revenue");
  redirect("/admin/revenue#manual");
}
