import { notFound } from "next/navigation";
import { findCustomer } from "@/lib/excel";
import AlreadyVisited from "./AlreadyVisited";
import { dayForToday } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function AlreadyVisitedPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await findCustomer(id);
  if (!customer) notFound();
  return <AlreadyVisited customer={customer} defaultDay={dayForToday()} />;
}
