import { createHash, randomInt } from "crypto";
import { and, desc, eq, gt, isNull } from "drizzle-orm";
import { db, emailCodes } from "@/db";
import { sendMail } from "@/lib/mail";

const hash = (email: string, code: string) => createHash("sha256").update(`${email}:${code}:${process.env.SESSION_SECRET ?? "dev"}`).digest("hex");

export type Purpose = "verify" | "reset";
const TTL_MIN = 10;

/** Creates a fresh 6-digit code (older ones stop working) and emails it. Returns false if one was sent less than a minute ago. */
export async function issueCode(email: string, purpose: Purpose): Promise<boolean> {
  const [last] = await db.select().from(emailCodes).where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose))).orderBy(desc(emailCodes.createdAt)).limit(1);
  if (last && Date.now() - last.createdAt.getTime() < 60_000) return false;
  await db.update(emailCodes).set({ usedAt: new Date() }).where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose), isNull(emailCodes.usedAt)));
  const code = String(randomInt(100000, 1000000));
  await db.insert(emailCodes).values({ email, purpose, codeHash: hash(email, code), expiresAt: new Date(Date.now() + TTL_MIN * 60_000) });
  const what = purpose === "verify" ? "verify your email" : "reset your password";
  await sendMail(email, `Your Medical QBank code: ${code}`, `Use this code to ${what}: ${code}\n\nIt expires in ${TTL_MIN} minutes. If you didn't ask for it, you can ignore this email.`);
  return true;
}

/** Checks a code. Five wrong tries burn it. */
export async function checkCode(email: string, purpose: Purpose, code: string): Promise<boolean> {
  const [row] = await db.select().from(emailCodes)
    .where(and(eq(emailCodes.email, email), eq(emailCodes.purpose, purpose), isNull(emailCodes.usedAt), gt(emailCodes.expiresAt, new Date())))
    .orderBy(desc(emailCodes.createdAt)).limit(1);
  if (!row || row.attempts >= 5) return false;
  if (row.codeHash !== hash(email, code.trim())) {
    await db.update(emailCodes).set({ attempts: row.attempts + 1 }).where(eq(emailCodes.id, row.id));
    return false;
  }
  await db.update(emailCodes).set({ usedAt: new Date() }).where(eq(emailCodes.id, row.id));
  return true;
}
