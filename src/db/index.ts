import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";

// Works with a Supabase connection string (use the pooled "Transaction" URL on Vercel).
// `prepare: false` is required for Supabase's transaction pooler.
const url = process.env.DATABASE_URL ?? "postgres://missing:missing@127.0.0.1:5432/missing";

const g = globalThis as unknown as { __pg?: ReturnType<typeof postgres> };
export const client = g.__pg ?? postgres(url, { prepare: false, max: Number(process.env.DB_POOL_MAX ?? 3) });
g.__pg = client;

export const db = drizzle(client, { schema });
export * from "./schema";
