import { NextResponse } from "next/server";
import { logVisit } from "@/lib/excel";
import type { VisitDay } from "@/lib/week";

export const dynamic = "force-dynamic";

type Body = {
  id?: string;
  day?: VisitDay;
  products?: number;
  oil?: boolean;
  override?: boolean;
  notes?: string;
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  const day = body.day;
  const products = Number(body.products);
  const oil = !!body.oil;

  if (!id || (day !== "Woensdag" && day !== "Donderdag")) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }
  if (!Number.isFinite(products) || products < 0) {
    return NextResponse.json({ error: "INVALID_PRODUCTS" }, { status: 400 });
  }

  const result = await logVisit({
    id,
    day,
    products,
    oil,
    override: !!body.override,
    notes: typeof body.notes === "string" ? body.notes : undefined,
  });

  if (result.ok) {
    return NextResponse.json({ customer: result.customer });
  }
  if (result.reason === "NOT_FOUND") {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  if (result.reason === "OIL_ALREADY_USED") {
    return NextResponse.json(
      { error: "OIL_ALREADY_USED", recipient: result.recipient },
      { status: 409 }
    );
  }
  return NextResponse.json(
    {
      error: "ALREADY_VISITED",
      existing: result.existing,
      customer: result.customer,
    },
    { status: 409 }
  );
}
