import { NextRequest, NextResponse } from "next/server";
import { jwtVerify } from "jose";

const PUBLIC = ["/login", "/register", "/verify", "/forgot", "/reset"];

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const token = req.cookies.get("qbank_session")?.value;
  let valid = false;
  if (token) {
    try {
      await jwtVerify(token, new TextEncoder().encode(process.env.SESSION_SECRET ?? "dev-secret-change-me"));
      valid = true;
    } catch {}
  }
  if (pathname.startsWith("/api/auth/")) return NextResponse.next();
  const isPublic = PUBLIC.includes(pathname);
  if (!valid && !isPublic) return NextResponse.redirect(new URL("/login", req.url));
  if (valid && isPublic) return NextResponse.redirect(new URL("/", req.url));
  return NextResponse.next();
}

export const config = { matcher: ["/((?!_next|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|ico|webp)$).*)"] };
