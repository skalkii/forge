import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionTokenFromSecret, timingSafeEqual } from "@/lib/auth";

export async function POST(req: NextRequest) {
  const secret = process.env.REVIEW_QUEUE_SECRET;
  if (!secret) {
    return new NextResponse("REVIEW_QUEUE_SECRET is not set. Dashboard is locked.", {
      status: 503,
    });
  }

  const form = await req.formData();
  const token = form.get("token");
  if (typeof token !== "string" || token.length === 0 || !timingSafeEqual(token, secret)) {
    const login = req.nextUrl.clone();
    login.pathname = "/login";
    login.search = "?error=1";
    return NextResponse.redirect(login, 303);
  }

  const res = NextResponse.redirect(new URL("/", req.url), 303);
  res.cookies.set(SESSION_COOKIE, await sessionTokenFromSecret(secret), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 7,
  });
  return res;
}
