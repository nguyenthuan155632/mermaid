import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export async function proxy(request: NextRequest) {
  // Check for NextAuth session cookie
  const sessionToken = request.cookies.get("authjs.session-token") ||
    request.cookies.get("__Secure-authjs.session-token");

  const isLoggedIn = !!sessionToken;
  const isOnLogin = request.nextUrl.pathname.startsWith("/login");
  const isOnSignup = request.nextUrl.pathname.startsWith("/signup");
  const isOnShare = request.nextUrl.pathname.startsWith("/share");

  if (isOnShare) {
    return NextResponse.next();
  }

  if (isOnLogin || isOnSignup) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL("/editor", request.url));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico).*)"],
};
