import { sql } from "drizzle-orm";
import { db } from "@/db";

export type Peer = { pct: number; n: number };
/** Below this many students the percentage is too noisy to show. */
export const MIN_PEERS = 10;

/** Share of students whose FIRST attempt at each question was correct. One indexed query for the whole list. */
export async function peerStats(ids: string[]): Promise<Map<string, Peer>> {
  const out = new Map<string, Peer>();
  if (!ids.length) return out;
  const list = sql.join(ids.map((i) => sql`${i}`), sql`, `);
  const r = Array.from(await db.execute(sql`
    select question_id, count(*)::int as n, (count(*) filter (where is_correct))::int as c from (
      select distinct on (question_id, user_id) question_id, user_id, is_correct
      from user_answers where question_id in (${list}) order by question_id, user_id, answered_at asc
    ) t group by question_id`)) as unknown as { question_id: string; n: number; c: number }[];
  for (const x of r) if (x.n >= MIN_PEERS) out.set(x.question_id, { pct: Math.round((x.c / x.n) * 100), n: x.n });
  return out;
}
