"use server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { BACKUP_TABLES, type BackupTable } from "@/lib/backup";

/** Adds the given rows to one table. Rows that already exist are skipped; nothing is ever overwritten or deleted. */
export async function restoreChunk(table: string, rows: Record<string, unknown>[]): Promise<{ inserted: number; skipped: number; failed: number }> {
  const user = await getUser();
  if (!user?.isAdmin) throw new Error("Not allowed");
  if (!BACKUP_TABLES.includes(table as BackupTable)) throw new Error("Unknown table");
  if (!Array.isArray(rows) || rows.length === 0) return { inserted: 0, skipped: 0, failed: 0 };
  if (rows.length > 2000) throw new Error("Chunk too large");
  const ident = sql.raw(`"${table}"`);
  const insert = async (batch: Record<string, unknown>[]) => {
    const r = Array.from(await db.execute(sql`
      insert into ${ident} select * from jsonb_populate_recordset(null::${ident}, ${JSON.stringify(batch)}::jsonb)
      on conflict do nothing returning 1`));
    return r.length;
  };
  try {
    const inserted = await insert(rows);
    return { inserted, skipped: rows.length - inserted, failed: 0 };
  } catch {
    // Something in this chunk points at a row that does not exist (for example an answer for a deleted student). Retry row by row.
    let inserted = 0, failed = 0;
    for (const row of rows) {
      try { inserted += await insert([row]); } catch { failed++; }
    }
    return { inserted, skipped: rows.length - inserted - failed, failed };
  }
}
