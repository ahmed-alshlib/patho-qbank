import "dotenv/config";
import postgres from "postgres";

// Supabase exposes every public table through its REST API. Turning on Row Level Security
// with NO policies blocks that route completely; this app talks to Postgres directly (server-side),
// which is unaffected. This protects password hashes and answers from anyone holding the public anon key.
async function main() {
  const sql = postgres(process.env.DIRECT_URL ?? process.env.DATABASE_URL!, { prepare: false, max: 1 });
  const tables = await sql<{ tablename: string }[]>`select tablename from pg_tables where schemaname = 'public'`;
  for (const { tablename } of tables) await sql.unsafe(`alter table public."${tablename}" enable row level security`);
  console.log(`Row Level Security enabled on ${tables.length} tables`);
  await sql.end();
}
main().catch((e) => { console.error(e); process.exit(1); });
