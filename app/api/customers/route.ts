import { NextResponse } from "next/server";
import { createCustomer, logVisit } from "@/lib/excel";
import type { VisitDay } from "@/lib/week";

export const dynamic = "force-dynamic";

type Body = {
  id?: string;
  voornaam?: string;
  achternaam?: string;
  postcode?: string;
  idVerified?: boolean;
  notes?: string;
  visit?: {
    day: VisitDay;
    products: number;
    oil: boolean;
  };
};

export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "INVALID_JSON" }, { status: 400 });
  }

  const id = (body.id ?? "").trim();
  const voornaam = (body.voornaam ?? "").trim();
  const achternaam = (body.achternaam ?? "").trim();
  const postcode = (body.postcode ?? "").trim();

  // `id` (the stadspas ID) may be empty — a unique internal ID is generated.
  if (!voornaam || !achternaam) {
    return NextResponse.json({ error: "MISSING_FIELDS" }, { status: 400 });
  }

  try {
    const customer = await createCustomer({
      id,
      voornaam,
      achternaam,
      postcode,
      idVerified: !!body.idVerified,
      notes: body.notes,
    });

    if (body.visit) {
      const result = await logVisit({
        id: customer.id,
        day: body.visit.day,
        products: body.visit.products,
        oil: body.visit.oil,
        override: true,
      });
      if (result.ok) {
        return NextResponse.json({ customer: result.customer });
      }
    }

    return NextResponse.json({ customer });
  } catch (err: unknown) {
    if (err instanceof Error && err.message === "CUSTOMER_EXISTS") {
      return NextResponse.json({ error: "CUSTOMER_EXISTS" }, { status: 409 });
    }
    return NextResponse.json({ error: "SERVER_ERROR" }, { status: 500 });
  }
}
