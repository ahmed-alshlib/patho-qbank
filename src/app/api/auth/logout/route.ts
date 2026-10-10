import { NextRequest, NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  await destroySession();
  return NextResponse.redirect(new URL(req.nextUrl.searchParams.get("k") ? "/login?kicked=1" : "/login", req.nextUrl.origin));
}
