import { NextRequest, NextResponse } from "next/server";
import { randomBytes } from "node:crypto";
import { googleEnabled, redirectUri } from "@/lib/google";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const origin = req.nextUrl.origin;
  if (!googleEnabled()) return NextResponse.redirect(new URL("/login", origin));
  const state = randomBytes(16).toString("hex");
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID!,
    redirect_uri: redirectUri(origin),
    response_type: "code",
    scope: "openid email profile",
    state,
    prompt: "select_account",
  }).toString();
  const res = NextResponse.redirect(url);
  res.cookies.set("g_state", state, { httpOnly: true, sameSite: "lax", path: "/", maxAge: 600, secure: process.env.NODE_ENV === "production" });
  return res;
}
