import { NextResponse } from "next/server";
import { searchCustomers } from "@/lib/excel";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = url.searchParams.get("q") ?? "";
  const customers = await searchCustomers(q);
  return NextResponse.json({ customers });
}
