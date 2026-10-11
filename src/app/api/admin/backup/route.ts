import { NextRequest } from "next/server";
import { sql } from "drizzle-orm";
import { db } from "@/db";
import { getUser } from "@/lib/auth";
import { rateLimit } from "@/lib/rate";
import { BACKUP_FORMAT, BACKUP_GROUPS, BACKUP_TABLES } from "@/lib/backup";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const PAGE = 2000;

export async function GET(req: NextRequest) {
  const user = await getUser();
  if (!user?.isAdmin) return new Response("Not allowed", { status: 403 });
  if (!(await rateLimit(`backup:${user.id}`, 6, 600))) return new Response("Please wait a few minutes before another backup.", { status: 429 });

  const wanted = (req.nextUrl.searchParams.get("scope") ?? "content").split(",");
  const groups = BACKUP_GROUPS.filter((g) => wanted.includes(g.id));
  if (!groups.length) return new Response("Choose what to back up.", { status: 400 });
  const tables = BACKUP_TABLES.filter((t) => groups.some((g) => g.tables.includes(t)));
  const created = new Date();

  await db.execute(sql`insert into settings (key, value) values ('backup_last', ${created.toISOString()}) on conflict (key) do update set value = excluded.value`);

  const enc = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const w = (s: string) => controller.enqueue(enc.encode(s));
      try {
        w(`{"format":"${BACKUP_FORMAT}","version":1,"created":${JSON.stringify(created.toISOString())},"scope":${JSON.stringify(groups.map((g) => g.id))},"tables":{`);
        let firstTable = true;
        for (const t of tables) {
          w(`${firstTable ? "" : ","}"${t}":[`);
          firstTable = false;
          const ident = sql.raw(`"${t}"`);
          if (t === "settings") {
            const rows = Array.from(await db.execute(sql`select * from ${ident} where key <> 'backup_last' order by key`)) as unknown[];
            w(rows.map((r) => JSON.stringify(r)).join(","));
          } else {
            let last = "", first = true;
            for (;;) {
              const rows = Array.from(await db.execute(sql`select * from ${ident} where id > ${last} order by id limit ${PAGE}`)) as { id: string }[];
              if (!rows.length) break;
              w((first ? "" : ",") + rows.map((r) => JSON.stringify(r)).join(","));
              first = false;
              last = rows[rows.length - 1].id;
              if (rows.length < PAGE) break;
            }
          }
          w("]");
        }
        w("}}");
        controller.close();
      } catch (e) {
        console.error("backup failed:", e instanceof Error ? e.message : e);
        controller.error(e);
      }
    },
  });
  const stamp = created.toLocaleDateString("en-CA", { timeZone: process.env.APP_TZ ?? "Africa/Tripoli" });
  return new Response(stream, { headers: {
    "content-type": "application/json; charset=utf-8",
    "content-disposition": `attachment; filename="medical-qbank-backup-${stamp}.json"`,
    "cache-control": "no-store",
  } });
}
