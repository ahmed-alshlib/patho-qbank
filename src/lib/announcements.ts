import { unstable_cache } from "next/cache";
import { and, desc, eq, gt, isNull, or } from "drizzle-orm";
import { db, announcements } from "@/db";

export type LiveAnnouncement = { id: string; message: string; level: string };

/** Announcements every student should currently see. Cached for 30 s and refreshed immediately when the admin changes one. */
export const getLiveAnnouncements = unstable_cache(async (): Promise<LiveAnnouncement[]> => {
  const r = await db.select({ id: announcements.id, message: announcements.message, level: announcements.level }).from(announcements)
    .where(and(eq(announcements.active, true), or(isNull(announcements.expiresAt), gt(announcements.expiresAt, new Date()))))
    .orderBy(desc(announcements.createdAt)).limit(3);
  return r;
}, ["live-announcements"], { revalidate: 30, tags: ["announcements"] });
