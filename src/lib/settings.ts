import { db, settings } from "@/db";

export const SETTING_KEYS = ["whatsapp", "bank_name", "account_name", "account_number", "currency", "payment_note"] as const;
export type SettingKey = (typeof SETTING_KEYS)[number];

export async function getSettings(): Promise<Record<SettingKey, string>> {
  const rows = await db.select().from(settings);
  const m = Object.fromEntries(rows.map((r) => [r.key, r.value]));
  return Object.fromEntries(SETTING_KEYS.map((k) => [k, m[k] ?? (k === "currency" ? "LYD" : "")])) as Record<SettingKey, string>;
}
