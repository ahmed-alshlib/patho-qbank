import { cache } from "react";
import { cookies } from "next/headers";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";

const COOKIE = "qbank_session";
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret-change-me");

export async function createSession(userId: string) {
  const token = await new SignJWT({ uid: userId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  (await cookies()).delete(COOKIE);
}

// cache(): layout and page both call this in one request; run the lookup only once.
export const getUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const [user] = await db.select({ id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin })
      .from(users).where(eq(users.id, payload.uid as string)).limit(1);
    return user ?? null;
  } catch (e) {
    console.error("getUser failed:", e instanceof Error ? e.message : e);
    return null;
  }
});
