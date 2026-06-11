import { notFound, redirect } from "next/navigation";
import { findCustomerAndGroup } from "@/lib/excel";
import { dayForToday } from "@/lib/week";
import GroupCheckIn from "./GroupCheckIn";

export const dynamic = "force-dynamic";

export default async function GroupCheckInPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const result = await findCustomerAndGroup(id);
  if (!result) notFound();
  const { customer, group } = result;
  if (customer.visitThisWeek) {
    redirect(`/already-visited/${encodeURIComponent(id)}`);
  }
  if (!group) {
    redirect(`/check-in/${encodeURIComponent(id)}`);
  }
  return (
    <GroupCheckIn customer={customer} group={group} defaultDay={dayForToday()} />
  );
}
