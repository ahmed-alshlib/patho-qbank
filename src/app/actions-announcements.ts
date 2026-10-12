"use server";
import { eq } from "drizzle-orm";
import { revalidatePath, revalidateTag } from "next/cache";
import { redirect } from "next/navigation";
import { db, announcements } from "@/db";
import { getUser } from "@/lib/auth";

async function admin() { const u = await getUser(); if (!u?.isAdmin) throw new Error("Not allowed"); }
const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
const refresh = () => { revalidateTag("announcements"); revalidatePath("/admin/announcements"); };

export async function saveAnnouncement(f: FormData) {
  await admin();
  const id = str(f, "id"), message = str(f, "message").slice(0, 600);
  const level = ["info", "warning", "urgent"].includes(str(f, "level")) ? str(f, "level") : "info";
  const date = str(f, "expires");
  // Libya has no daylight saving time: UTC+2 all year.
  const expiresAt = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T23:59:59+02:00`) : null;
  if (!message) redirect("/admin/announcements?error=" + encodeURIComponent("Write a message first."));
  if (id) await db.update(announcements).set({ message, level, expiresAt }).where(eq(announcements.id, id));
  else await db.insert(announcements).values({ message, level, expiresAt });
  refresh();
  redirect("/admin/announcements?saved=1");
}

export async function toggleAnnouncement(f: FormData) {
  await admin();
  const id = str(f, "id");
  const [a] = await db.select({ active: announcements.active }).from(announcements).where(eq(announcements.id, id)).limit(1);
  if (a) await db.update(announcements).set({ active: !a.active }).where(eq(announcements.id, id));
  refresh();
}

export async function deleteAnnouncement(f: FormData) {
  await admin();
  await db.delete(announcements).where(eq(announcements.id, str(f, "id")));
  refresh();
}
