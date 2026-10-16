import { NextResponse } from "next/server";
import { logGroupVisit } from "@/lib/excel";
import type { VisitDay } from "@/lib/week";

export const dynamic = "force-dynamic";

type Body = {
  scannerId?: string;
  memberIds?: string[];
  day?: VisitDay;
  products?: number;
  oil?: boolean;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const scannerId = (body.scannerId ?? "").trim();
  const day = body.day;
  const products = Number(body.products);
  const oil = !!body.oil;
  const memberIds = Array.isArray(body.memberIds)
    ? body.memberIds.filter((s): s is string => typeof s === "string")
    : [];

  if (!scannerId || (day !== "Woensdag" && day !== "Donderdag")) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (!Number.isFinite(products) || products < 0) {
    return NextResponse.json({ error: "INVALID_PRODUCTS" }, { status: 400 });
  }

  const result = await logGroupVisit({
    scannerId,
    memberIds,
    day,
    products,
    oil,
  });

  if (result.ok) {
    return NextResponse.json({ group: result.group, loggedIds: result.loggedIds });
  }
  if (result.reason === "OIL_ALREADY_USED") {
    return NextResponse.json(
      { error: "OIL_ALREADY_USED", recipient: result.recipient },
      { status: 409 }
    );
  }
  const status =
    result.reason === "NOT_FOUND"
      ? 404
      : result.reason === "NO_GROUP"
      ? 400
      : 409;
  return NextResponse.json({ error: result.reason }, { status });
}
