import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, users } from "@/db";
import { createSession } from "@/lib/auth";
import { googleEnabled, redirectUri } from "@/lib/google";
import { clientIp, rateLimit } from "@/lib/rate";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  const fail = (code: string) => {
    const res = NextResponse.redirect(new URL(`/login?g=${code}`, origin));
    res.cookies.delete("g_state");
    return res;
  };
  if (!googleEnabled()) return fail("off");

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  if (req.nextUrl.searchParams.get("error") || !code) return fail("cancelled");
  if (!state || state !== req.cookies.get("g_state")?.value) return fail("state");

  if (!(await rateLimit(`google:${await clientIp()}`, 500, 900))) return fail("busy");

  try {
    const tokenRes = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        code, grant_type: "authorization_code",
        client_id: process.env.GOOGLE_CLIENT_ID!, client_secret: process.env.GOOGLE_CLIENT_SECRET!,
        redirect_uri: redirectUri(origin),
      }),
    });
    if (!tokenRes.ok) return fail("token");
    const { access_token } = (await tokenRes.json()) as { access_token?: string };
    if (!access_token) return fail("token");
    const infoRes = await fetch("https://openidconnect.googleapis.com/v1/userinfo", { headers: { authorization: `Bearer ${access_token}` } });
    if (!infoRes.ok) return fail("token");
    const info = (await infoRes.json()) as { email?: string; email_verified?: boolean; name?: string };
    const email = info.email?.trim().toLowerCase();
    if (!email || info.email_verified !== true) return fail("unverified");

    const [existing] = await db.select().from(users).where(eq(users.email, email)).limit(1);
    let userId: string, isNew = false;
    if (existing) {
      if (existing.isAdmin) return fail("admin"); // admin accounts use email + password only
      userId = existing.id;
      if (!existing.emailVerifiedAt) {
        // Google proved ownership of this address: verify it and lock out whoever pre-registered it with a password.
        const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10);
        await db.update(users).set({ emailVerifiedAt: new Date(), passwordHash }).where(eq(users.id, existing.id));
      }
    } else {
      const name = (info.name ?? email.split("@")[0]).trim() || "Student";
      const passwordHash = await bcrypt.hash(randomBytes(24).toString("hex"), 10); // unusable; can set one via "Forgot password"
      const [u] = await db.insert(users).values({ email, name, passwordHash, emailVerifiedAt: new Date() }).returning();
      userId = u.id; isNew = true;
    }
    await createSession(userId);
    const res = NextResponse.redirect(new URL(isNew ? "/plans?welcome=1" : "/", origin));
    res.cookies.delete("g_state");
    return res;
  } catch (e) {
    console.error("google login failed:", e instanceof Error ? e.message : e);
    return fail("error");
  }
}
