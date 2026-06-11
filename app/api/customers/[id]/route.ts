import { NextResponse } from "next/server";
import { findCustomer, updateNotes } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  const customer = await findCustomer(id);
  if (!customer) {
    return NextResponse.json({ found: false }, { status: 404 });
  }
  return NextResponse.json({ found: true, customer });
}

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id } = await ctx.params;
  let body: { notes?: string };
  try {
    body = (await req.json()) as { notes?: string };
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }
  if (typeof body.notes !== "string") {
    return NextResponse.json({ error: "MISSING_NOTES" }, { status: 400 });
  }
  const customer = await updateNotes(id, body.notes);
  if (!customer) {
    return NextResponse.json({ error: "NOT_FOUND" }, { status: 404 });
  }
  return NextResponse.json({ customer });
}
