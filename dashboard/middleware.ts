import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE, sessionTokenFromSecret, timingSafeEqual } from "@/lib/auth";

const PUBLIC_PATHS = new Set(["/login", "/api/login"]);

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;
  if (PUBLIC_PATHS.has(pathname)) return NextResponse.next();

  const secret = process.env.REVIEW_QUEUE_SECRET;
  if (!secret) {
    // R6: the review queue must never be an open URL — fail closed, never open.
    return new NextResponse("REVIEW_QUEUE_SECRET is not set. Dashboard is locked.", {
      status: 503,
    });
  }

  const bearer = req.headers.get("authorization");
  if (bearer?.startsWith("Bearer ") && timingSafeEqual(bearer.slice(7), secret)) {
    return NextResponse.next();
  }

  const cookie = req.cookies.get(SESSION_COOKIE)?.value;
  if (cookie && timingSafeEqual(cookie, await sessionTokenFromSecret(secret))) {
    return NextResponse.next();
  }

  if (pathname.startsWith("/api/")) {
    return new NextResponse("Unauthorized", { status: 401 });
  }
  const login = req.nextUrl.clone();
  login.pathname = "/login";
  login.search = "";
  return NextResponse.redirect(login);
}

export const config = {
  matcher: ["/((?!_next/static|_next/image|favicon.ico).*)"],
};
