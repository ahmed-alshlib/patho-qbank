"use server";
import { asc, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, chapters, summaries } from "@/db";
import { getUser } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function admin() { const u = await getUser(); if (!u?.isAdmin) throw new Error("Not allowed"); }
const back = (subject: string, chapter: string, extra = "") => redirect(`/admin/summaries?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}${extra}`);

export async function saveSummary(f: FormData) {
  await admin();
  const id = str(f, "id"), chapterId = str(f, "chapterId"), subject = str(f, "subjectId");
  const title = str(f, "title").slice(0, 200), body = String(f.get("body") ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 200_000);
  if (!title) back(subject, chapterId, "&error=" + encodeURIComponent("Give the summary a title."));
  const [ch] = await db.select({ id: chapters.id }).from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  if (!ch) back(subject, "", "&error=" + encodeURIComponent("Choose a chapter first."));
  if (id) await db.update(summaries).set({ title, body, updatedAt: new Date() }).where(eq(summaries.id, id));
  else {
    const last = await db.select({ o: summaries.order }).from(summaries).where(eq(summaries.chapterId, chapterId)).orderBy(asc(summaries.order));
    await db.insert(summaries).values({ chapterId, title, body, order: last.length ? last[last.length - 1].o + 1 : 0 });
  }
  revalidatePath("/admin/summaries"); revalidatePath("/summaries", "layout");
  back(subject, chapterId, "&saved=1");
}

export async function deleteSummary(f: FormData) {
  await admin();
  await db.delete(summaries).where(eq(summaries.id, str(f, "id")));
  revalidatePath("/admin/summaries"); revalidatePath("/summaries", "layout");
  back(str(f, "subjectId"), str(f, "chapterId"), "&saved=1");
}
