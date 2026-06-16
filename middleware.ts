import { NextResponse, type NextRequest } from "next/server";
import { COOKIE_NAME, isValidSession } from "@/lib/auth";

// Gate the whole app behind the shared password. Unauthenticated page requests
// are redirected to /login; unauthenticated API requests get a 401 (so client
// fetches don't silently receive the login HTML).
export async function middleware(req: NextRequest) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  if (await isValidSession(token)) return NextResponse.next();

  const { pathname, search } = req.nextUrl;
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "UNAUTHORIZED" }, { status: 401 });
  }

  const url = req.nextUrl.clone();
  url.pathname = "/login";
  url.search = `?next=${encodeURIComponent(pathname + search)}`;
  return NextResponse.redirect(url);
}

// Run on every route except the login page/route itself and static assets.
export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons/|logo.png|login|api/login).*)",
  ],
};
