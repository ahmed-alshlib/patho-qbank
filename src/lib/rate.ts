import { headers } from "next/headers";
import { eq, sql } from "drizzle-orm";
import { db, rateLimits } from "@/db";

/** Counts a hit and returns true while the caller is still under `max` hits per `windowSec`. Stored in Postgres so it works on serverless. */
export async function rateLimit(key: string, max: number, windowSec: number): Promise<boolean> {
  const r = Array.from(await db.execute(sql`
    insert into rate_limits (key, count, window_start) values (${key}, 1, now())
    on conflict (key) do update set
      count = case when rate_limits.window_start < now() - (${windowSec}::float8 * interval '1 second') then 1 else rate_limits.count + 1 end,
      window_start = case when rate_limits.window_start < now() - (${windowSec}::float8 * interval '1 second') then now() else rate_limits.window_start end
    returning count`)) as unknown as { count: number }[];
  return r[0].count <= max;
}

export async function clearLimit(key: string) { await db.delete(rateLimits).where(eq(rateLimits.key, key)); }

export async function clientIp() {
  const h = await headers();
  return (h.get("x-forwarded-for")?.split(",")[0] ?? h.get("x-real-ip") ?? "unknown").trim();
}
