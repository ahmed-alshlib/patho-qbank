import { cache } from "react";
import { cookies, headers } from "next/headers";
import { redirect } from "next/navigation";
import { SignJWT, jwtVerify } from "jose";
import { eq, sql } from "drizzle-orm";
import { db, users } from "@/db";

const COOKIE = "qbank_session";
/** A student can be signed in on this many devices at once; signing in on another one signs the oldest out. */
export const MAX_DEVICES = 2;
const secret = () => new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret-change-me");

export function deviceLabel(ua: string | null) {
  const u = ua ?? "";
  const os = /iPhone|iPad|iOS/.test(u) ? "iPhone/iPad" : /Android/.test(u) ? "Android" : /Windows/.test(u) ? "Windows" : /Mac OS X|Macintosh/.test(u) ? "Mac" : /Linux/.test(u) ? "Linux" : "Unknown device";
  const br = /Edg\//.test(u) ? "Edge" : /OPR\/|Opera/.test(u) ? "Opera" : /Chrome|CriOS/.test(u) ? "Chrome" : /Firefox|FxiOS/.test(u) ? "Firefox" : /Safari/.test(u) ? "Safari" : "Browser";
  return `${br} on ${os}`;
}

export async function createSession(userId: string) {
  const [u] = await db.select({ isAdmin: users.isAdmin }).from(users).where(eq(users.id, userId)).limit(1);
  let sid: string | undefined;
  if (u && !u.isAdmin) {
    sid = crypto.randomUUID();
    const device = deviceLabel((await headers()).get("user-agent"));
    await db.execute(sql`insert into user_sessions (id, user_id, device) values (${sid}, ${userId}, ${device})`);
    // Keep only the newest MAX_DEVICES sessions; older ones are signed out.
    await db.execute(sql`delete from user_sessions where user_id = ${userId} and id not in (select id from user_sessions where user_id = ${userId} order by created_at desc limit ${MAX_DEVICES})`);
    await db.execute(sql`delete from user_sessions where created_at < now() - interval '31 days'`);
  }
  const token = await new SignJWT({ uid: userId, ...(sid ? { sid } : {}) })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime("30d")
    .sign(secret());
  (await cookies()).set(COOKIE, token, {
    httpOnly: true, sameSite: "lax", path: "/", maxAge: 60 * 60 * 24 * 30,
    secure: process.env.NODE_ENV === "production",
  });
}

export async function destroySession() {
  const jar = await cookies();
  const token = jar.get(COOKIE)?.value;
  if (token) {
    try {
      const { payload } = await jwtVerify(token, secret());
      if (typeof payload.sid === "string") await db.execute(sql`delete from user_sessions where id = ${payload.sid}`);
    } catch {}
  }
  jar.delete(COOKIE);
}

// cache(): layout and page both call this in one request; run the lookup only once.
export const getUser = cache(async () => {
  const token = (await cookies()).get(COOKIE)?.value;
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, secret());
    const sid = typeof payload.sid === "string" ? payload.sid : null;
    const [user] = await db.select({
      id: users.id, name: users.name, email: users.email, isAdmin: users.isAdmin, dailyGoal: users.dailyGoal,
      deviceOk: sid ? sql<boolean>`exists(select 1 from user_sessions s where s.id = ${sid} and s.user_id = ${payload.uid as string})` : sql<boolean>`false`,
    }).from(users).where(eq(users.id, payload.uid as string)).limit(1);
    if (!user) return null;
    // Students need a live device session (so a 3rd login can sign the oldest out); admins are exempt.
    if (!user.isAdmin && !user.deviceOk) return null;
    const { deviceOk, ...rest } = user; void deviceOk;
    return rest;
  } catch (e) {
    console.error("getUser failed:", e instanceof Error ? e.message : e);
    return null;
  }
});

/** For pages inside the signed-in area: if the session is no longer valid, clear it and go to the login page. */
export async function requireUser() {
  const u = await getUser();
  if (!u) redirect("/api/auth/logout?k=1");
  return u;
}
