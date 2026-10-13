"use server";
import { and, asc, count, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { db, chapters, subjects, summaries, summaryLikes } from "@/db";
import { accessibleSubjectIds } from "@/lib/access";
import { getUser } from "@/lib/auth";

const str = (f: FormData, k: string) => String(f.get(k) ?? "").trim();
async function admin() { const u = await getUser(); if (!u?.isAdmin) throw new Error("Not allowed"); }
const back = (subject: string, chapter: string, extra = "") => redirect(`/admin/summaries?subject=${encodeURIComponent(subject)}&chapter=${encodeURIComponent(chapter)}${extra}`);

export async function saveSummary(f: FormData) {
  await admin();
  const id = str(f, "id"), chapterId = str(f, "chapterId"), subject = str(f, "subjectId");
  const title = str(f, "title").slice(0, 200), body = String(f.get("body") ?? "").replace(/\r\n?/g, "\n").trim().slice(0, 200_000);
  let url = str(f, "url").slice(0, 1000);
  if (url && !/^https:\/\//i.test(url)) url = /^[\w.-]+\.[a-z]{2,}\//i.test(url) ? "https://" + url : "";
  if (str(f, "url") && !url) back(subject, chapterId, "&error=" + encodeURIComponent("The link must start with https://"));
  if (!title) back(subject, chapterId, "&error=" + encodeURIComponent("Give the summary a title."));
  const [ch] = await db.select({ id: chapters.id }).from(chapters).where(eq(chapters.id, chapterId)).limit(1);
  if (!ch) back(subject, "", "&error=" + encodeURIComponent("Choose a chapter first."));
  if (id) await db.update(summaries).set({ title, body, url, updatedAt: new Date() }).where(eq(summaries.id, id));
  else {
    const last = await db.select({ o: summaries.order }).from(summaries).where(eq(summaries.chapterId, chapterId)).orderBy(asc(summaries.order));
    await db.insert(summaries).values({ chapterId, title, body, url, order: last.length ? last[last.length - 1].o + 1 : 0 });
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

/** Love / un-love a summary. Only students who can open the subject may react. */
export async function toggleSummaryLike(summaryId: string): Promise<{ liked: boolean; count: number }> {
  const u = await getUser();
  if (!u) throw new Error("Please sign in.");
  const [r] = await db.select({ subjectId: subjects.id }).from(summaries).innerJoin(chapters, eq(summaries.chapterId, chapters.id)).innerJoin(subjects, eq(chapters.subjectId, subjects.id)).where(eq(summaries.id, summaryId)).limit(1);
  if (!r) throw new Error("Not found");
  if (!u.isAdmin && !(await accessibleSubjectIds(u.id)).has(r.subjectId)) throw new Error("Subscription required.");
  const gone = await db.delete(summaryLikes).where(and(eq(summaryLikes.summaryId, summaryId), eq(summaryLikes.userId, u.id))).returning({ id: summaryLikes.id });
  if (gone.length === 0) await db.insert(summaryLikes).values({ summaryId, userId: u.id }).onConflictDoNothing();
  const [n] = await db.select({ n: count() }).from(summaryLikes).where(eq(summaryLikes.summaryId, summaryId));
  return { liked: gone.length === 0, count: n.n };
}
