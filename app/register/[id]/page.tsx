import RegisterForm from "./RegisterForm";
import { dayForToday } from "@/lib/week";

export const dynamic = "force-dynamic";

export default async function RegisterPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return <RegisterForm id={id} defaultDay={dayForToday()} />;
}
