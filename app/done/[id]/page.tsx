import Link from "next/link";
import { findCustomer } from "@/lib/excel";

export const dynamic = "force-dynamic";

export default async function DonePage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
}) {
  const { id } = await params;
  const sp = await searchParams;
  const customer = await findCustomer(id);
  const isNew = sp.new === "1";

  return (
    <main className="flex-1 flex flex-col px-5 pt-10 pb-8">
      <div className="flex-1 flex flex-col items-center justify-center text-center">
        <div className="w-24 h-24 rounded-full bg-brand-orange text-white flex items-center justify-center text-5xl mb-6 shadow-lg shadow-brand-orange/30">
          ✓
        </div>
        <h1 className="text-3xl font-extrabold text-brand-blue mb-2">
          Gelukt!
        </h1>
        {customer && (
          <>
            <p className="text-xl text-gray-800">
              {customer.voornaam} {customer.achternaam}
            </p>
            <p className="text-gray-500 mt-1">
              {isNew ? "Geregistreerd en " : ""}
              ingecheckt
              {customer.visitThisWeek
                ? ` op ${customer.visitThisWeek.day || "—"}`
                : ""}
            </p>
            {customer.visitThisWeek && (
              <p className="text-gray-500 mt-1">
                {customer.visitThisWeek.products ?? 0} producten
                {customer.visitThisWeek.oil ? " · olie" : ""}
              </p>
            )}
          </>
        )}
      </div>

      <div className="space-y-3">
        <Link href="/" className="btn-primary w-full text-xl">
          Volgende klant
        </Link>
      </div>
    </main>
  );
}
