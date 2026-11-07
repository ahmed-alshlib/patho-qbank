"use server";
import bcrypt from "bcryptjs";
import { eq, sql } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { createSession, destroySession } from "@/lib/auth";
import { clearLimit, clientIp, rateLimit } from "@/lib/rate";
import { checkCode, issueCode } from "@/lib/codes";
import { mailProvider } from "@/lib/mail";
import { track } from "@/lib/analytics";

export type FormState = { error?: string; info?: string; name?: string; email?: string } | undefined;

const TOO_MANY = "Too many attempts. Please wait a few minutes and try again.";
const norm = (v: FormDataEntryValue | null) => String(v ?? "").trim().toLowerCase();
const home = (admin: boolean) => (admin ? "/admin" : "/");

async function sendCodeSafely(email: string, purpose: "verify" | "reset") {
  if (!(await rateLimit(`code:${purpose}:${email}`, 5, 900))) return false;
  try { await issueCode(email, purpose); return true; } catch (e) { console.error("sendCode failed:", e instanceof Error ? e.message : e); return false; }
}

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = norm(form.get("email"));
  const password = String(form.get("password") ?? "");
  const ip = await clientIp();
  if (!(await rateLimit(`login:ip:${ip}`, 400, 900)) || !(await rateLimit(`login:email:${email}`, 8, 900))) return { error: TOO_MANY, email };

  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash))) return { error: "Incorrect email or password.", email };

  if (!user.emailVerifiedAt) {
    if (mailProvider() === "none") await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.id, user.id));
    else {
      await sendCodeSafely(email, "verify");
      redirect(`/verify?email=${encodeURIComponent(email)}`);
    }
  }
  await clearLimit(`login:email:${email}`);
  await createSession(user.id);
  redirect(home(user.isAdmin));
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = norm(form.get("email"));
  const password = String(form.get("password") ?? "");
  if (name.length < 2) return { error: "Please enter your name.", name, email };
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return { error: "Please enter a valid email.", name, email };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", name, email };
  if (!(await rateLimit(`reg:ip:${await clientIp()}`, 400, 3600))) return { error: TOO_MANY, name, email };

  const [dupe] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (dupe?.emailVerifiedAt) return { error: "An account with this email already exists. Please log in.", name, email };

  const passwordHash = await bcrypt.hash(password, 10);
  const noMail = mailProvider() === "none";
  // An unverified leftover account can be re-claimed by whoever proves they own the email.
  if (dupe) await db.update(users).set({ name, passwordHash }).where(eq(users.id, dupe.id));
  const user = dupe ?? (await db.insert(users).values({ name, email, passwordHash, emailVerifiedAt: noMail ? new Date() : null }).returning())[0];

  if (!dupe) await track(user.id, "signed_up");
  if (noMail) { await createSession(user.id); redirect("/plans?welcome=1"); }
  if (!(await sendCodeSafely(email, "verify"))) return { error: "We couldn't send the verification email. Please try again in a few minutes.", name, email };
  redirect(`/verify?email=${encodeURIComponent(email)}`);
}

export async function verifyEmail(_: FormState, form: FormData): Promise<FormState> {
  const email = norm(form.get("email")), code = String(form.get("code") ?? "").replace(/\D/g, "");
  if (!(await rateLimit(`verify:${email}`, 12, 900)) || !(await rateLimit(`verify:ip:${await clientIp()}`, 400, 900))) return { error: TOO_MANY, email };
  if (code.length !== 6) return { error: "Enter the 6-digit code.", email };
  if (!(await checkCode(email, "verify", code))) return { error: "That code is wrong or has expired. Request a new one.", email };
  const [user] = await db.update(users).set({ emailVerifiedAt: new Date() }).where(eq(users.email, email)).returning();
  if (!user) return { error: "Account not found.", email };
  await createSession(user.id);
  redirect(user.isAdmin ? "/admin" : "/plans?welcome=1");
}

export async function resendCode(_: FormState, form: FormData): Promise<FormState> {
  const email = norm(form.get("email")), purpose = form.get("purpose") === "reset" ? "reset" : "verify";
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (user) {
    const sent = await sendCodeSafely(email, purpose);
    if (!sent) return { info: "Please wait a minute before asking for another code.", email };
  }
  return { info: "If that email has an account, a new code is on its way.", email };
}

export async function forgotPassword(_: FormState, form: FormData): Promise<FormState> {
  const email = norm(form.get("email"));
  if (mailProvider() === "none") return { error: "Password reset by email isn't set up yet. Please contact support.", email };
  if (!(await rateLimit(`forgot:ip:${await clientIp()}`, 150, 3600))) return { error: TOO_MANY, email };
  const [user] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (user) await sendCodeSafely(email, "reset");
  redirect(`/reset?email=${encodeURIComponent(email)}`); // same answer whether or not the account exists
}

export async function resetPassword(_: FormState, form: FormData): Promise<FormState> {
  const email = norm(form.get("email")), code = String(form.get("code") ?? "").replace(/\D/g, ""), password = String(form.get("password") ?? "");
  if (!(await rateLimit(`reset:${email}`, 12, 900)) || !(await rateLimit(`reset:ip:${await clientIp()}`, 300, 900))) return { error: TOO_MANY, email };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", email };
  if (code.length !== 6 || !(await checkCode(email, "reset", code))) return { error: "That code is wrong or has expired. Request a new one.", email };
  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.update(users).set({ passwordHash, emailVerifiedAt: new Date() }).where(eq(users.email, email)).returning();
  if (!user) return { error: "Account not found.", email };
  await db.execute(sql`delete from user_sessions where user_id = ${user.id}`); // sign out all old devices
  await clearLimit(`login:email:${email}`);
  await createSession(user.id);
  redirect(user.isAdmin ? "/admin" : "/");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
