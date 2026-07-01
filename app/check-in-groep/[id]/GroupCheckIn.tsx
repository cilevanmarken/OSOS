"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Customer, GroupView } from "@/lib/excel";
import type { VisitDay } from "@/lib/week";
import NoteBanner from "@/components/NoteBanner";

export default function GroupCheckIn({
  customer,
  group,
  defaultDay,
}: {
  customer: Customer;
  group: GroupView;
  defaultDay: VisitDay;
}) {
  const router = useRouter();
  const scannerId = customer.id;

  const otherMembers = group.members.filter((m) => m.id !== scannerId);
  // Members who can still be shopped for (haven't had a counting visit yet).
  const eligibleOthers = otherMembers.filter((m) => !m.countsThisWeek);
  const visitedOthers = otherMembers.filter((m) => m.countsThisWeek);
  // All-or-nothing: the scanner either shops for every eligible member or none.
  const [shopForOthers, setShopForOthers] = useState(eligibleOthers.length > 0);

  const [day, setDay] = useState<VisitDay>(defaultDay);
  const [products, setProducts] = useState<string>("");
  const [oil, setOil] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(products);
    if (!Number.isFinite(n) || n < 0) {
      setError("Vul een geldig aantal producten in.");
      return;
    }
    const memberIds = [
      scannerId,
      ...(shopForOthers ? eligibleOthers.map((m) => m.id) : []),
    ];
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/visits/group", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          scannerId,
          memberIds,
          day,
          products: n,
          oil,
        }),
      });
      if (res.ok) {
        router.push(`/done/${encodeURIComponent(scannerId)}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.error === "OIL_ALREADY_USED") {
        const r = data.recipient ?? {};
        const who = r.fullName ? ` aan ${r.fullName}` : " aan deze groep";
        const when = r.day ? ` op ${r.day}` : "";
        setError(
          `Olie is deze week al uitgedeeld${who}${when}. Geen tweede oliebon mogelijk. Vink olie uit en probeer opnieuw.`
        );
        return;
      }
      setError("Opslaan mislukt. Probeer opnieuw.");
    } catch {
      setError("Geen verbinding met de server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col px-5 pt-6 pb-8">
      <header className="flex items-center justify-between mb-6">
        <Link href="/" className="text-brand-blue font-semibold py-2 -ml-2 pl-2">
          ← Annuleer
        </Link>
        <h1 className="font-bold text-lg">Inchecken groep</h1>
        <span className="w-16" />
      </header>

      <NoteBanner note={customer.notes} />

      <section className="card mb-5">
        <p className="text-sm uppercase tracking-wide text-gray-500">
          Klant (gescand)
        </p>
        <p className="text-2xl font-bold text-brand-blue">
          {customer.voornaam} {customer.achternaam}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Postcode {customer.postcode || "—"} · Groep {group.id}
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-6">
        {eligibleOthers.length > 0 && (
          <div>
            <label className="label">Shopt ook voor:</label>
            <label className="card flex items-center gap-4 cursor-pointer">
              <input
                type="checkbox"
                className="w-7 h-7 accent-brand-orange"
                checked={shopForOthers}
                onChange={(e) => setShopForOthers(e.target.checked)}
              />
              <div className="flex-1">
                <p className="font-semibold">
                  {eligibleOthers.map((m) => m.fullName).join(", ")}
                </p>
                <p className="text-sm text-gray-500">
                  De producten worden verdeeld over iedereen die meeshopt.
                </p>
              </div>
            </label>
          </div>
        )}

        {visitedOthers.length > 0 && (
          <ul className="space-y-1">
            {visitedOthers.map((m) => (
              <li
                key={m.id}
                className="flex items-center justify-between text-sm text-gray-500"
              >
                <span>{m.fullName}</span>
                <span className="text-amber-700 font-semibold">
                  Al geweest{m.visitThisWeek?.day ? ` (${m.visitThisWeek.day})` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}

        <div>
          <label className="label">Dag</label>
          <div className="grid grid-cols-2 gap-3">
            {(["Woensdag", "Donderdag"] as VisitDay[]).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDay(d)}
                className={
                  "rounded-2xl py-5 text-lg font-semibold border-2 transition " +
                  (day === d
                    ? "bg-brand-blue text-white border-brand-blue"
                    : "bg-white text-gray-700 border-gray-200")
                }
              >
                {d}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label" htmlFor="products">
            Aantal producten
          </label>
          <input
            id="products"
            className="input text-2xl text-center"
            inputMode="numeric"
            pattern="[0-9]*"
            autoFocus
            value={products}
            onChange={(e) => setProducts(e.target.value.replace(/[^0-9]/g, ""))}
            placeholder="0"
          />
        </div>

        {group.oilUsedThisWeek ? (
          <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-5">
            <p className="text-sm uppercase tracking-wide text-amber-700 font-semibold">
              Olie deze week al uitgedeeld
            </p>
            <p className="text-gray-900 mt-1">
              {group.oilRecipient?.fullName
                ? `${group.oilRecipient.fullName}${
                    group.oilRecipient.day ? ` (${group.oilRecipient.day})` : ""
                  } heeft de oliebon van deze groep al gebruikt.`
                : "De oliebon van deze groep is al gebruikt deze week."}{" "}
              Geen tweede oliebon mogelijk.
            </p>
          </div>
        ) : (
          <label className="card flex items-center gap-4 cursor-pointer">
            <input
              type="checkbox"
              checked={oil}
              onChange={(e) => setOil(e.target.checked)}
              className="w-7 h-7 accent-brand-orange"
            />
            <div>
              <p className="font-semibold text-lg">Olie ontvangen</p>
              <p className="text-sm text-gray-500">
                Vink aan als de groep deze week de oliebon gebruikt
              </p>
            </div>
          </label>
        )}

        {error && (
          <p className="text-red-600 text-center font-semibold">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="btn-primary w-full text-xl py-6"
        >
          {submitting ? "Opslaan…" : "Bevestig bezoek"}
        </button>
      </form>
    </main>
  );
}
