import { NextResponse } from "next/server";
import { COOKIE_NAME, isConfigured, sessionToken, verifyPassword } from "@/lib/auth";

export const dynamic = "force-dynamic";

const MAX_AGE = 60 * 60 * 24 * 30; // 30 days

export async function POST(req: Request) {
  if (!isConfigured()) {
    return NextResponse.json({ error: "NOT_CONFIGURED" }, { status: 503 });
  }

  let password = "";
  try {
    const body = (await req.json()) as { password?: string };
    password = (body.password ?? "").trim();
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  if (!(await verifyPassword(password))) {
    return NextResponse.json({ error: "WRONG_PASSWORD" }, { status: 401 });
  }

  const token = await sessionToken();
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token ?? "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: MAX_AGE,
  });
  return res;
}

// Logout — clear the session cookie.
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
  });
  return res;
}
