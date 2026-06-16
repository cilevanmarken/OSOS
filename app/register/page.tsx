import RegisterForm from "./[id]/RegisterForm";
import { dayForToday } from "@/lib/week";

export const dynamic = "force-dynamic";

export default function RegisterNewPage() {
  return <RegisterForm defaultDay={dayForToday()} />;
}
