import { notFound, redirect } from "next/navigation";
import { findCustomer } from "@/lib/excel";
import CheckInForm from "./CheckInForm";
import { dayForToday } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function CheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const customer = await findCustomer(id);
  if (!customer) notFound();
  if (customer.visitThisWeek) {
    redirect(`/already-visited/${encodeURIComponent(id)}`);
  }
  return <CheckInForm customer={customer} defaultDay={dayForToday()} />;
}
