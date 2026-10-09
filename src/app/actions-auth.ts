"use server";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { redirect } from "next/navigation";
import { db, users } from "@/db";
import { createSession, destroySession } from "@/lib/auth";

export type FormState = { error?: string; name?: string; email?: string } | undefined;

export async function login(_: FormState, form: FormData): Promise<FormState> {
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  const [user] = await db.select().from(users).where(eq(users.email, email)).limit(1);
  if (!user || !(await bcrypt.compare(password, user.passwordHash)))
    return { error: "Incorrect email or password.", email };
  await createSession(user.id);
  redirect(user.isAdmin ? "/admin" : "/");
}

export async function register(_: FormState, form: FormData): Promise<FormState> {
  const name = String(form.get("name") ?? "").trim();
  const email = String(form.get("email") ?? "").trim().toLowerCase();
  const password = String(form.get("password") ?? "");
  if (name.length < 2) return { error: "Please enter your name.", name, email };
  if (password.length < 8) return { error: "Password must be at least 8 characters.", name, email };

  const [dupe] = await db.select({ id: users.id }).from(users).where(eq(users.email, email)).limit(1);
  if (dupe)
    return { error: "An account with this email already exists. Please log in.", name, email };

  const passwordHash = await bcrypt.hash(password, 10);
  const [user] = await db.insert(users).values({ name, email, passwordHash }).returning();
  await createSession(user.id);
  redirect("/plans?welcome=1");
}

export async function logout() {
  await destroySession();
  redirect("/login");
}
