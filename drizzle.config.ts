import "dotenv/config";
import { defineConfig } from "drizzle-kit";

// Migrations need a DIRECT connection (port 5432), not the transaction pooler.
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dbCredentials: { url: process.env.DIRECT_URL ?? process.env.DATABASE_URL ?? "" },
});
