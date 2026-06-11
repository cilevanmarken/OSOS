"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Customer } from "@/lib/excel";
import type { VisitDay } from "@/lib/week";
import NoteBanner from "@/components/NoteBanner";

export default function CheckInForm({
  customer,
  defaultDay,
}: {
  customer: Customer;
  defaultDay: VisitDay;
}) {
  const router = useRouter();
  const [day, setDay] = useState<VisitDay>(defaultDay);
  const [products, setProducts] = useState<string>("");
  const [oil, setOil] = useState(false);
  const [notes, setNotes] = useState<string>(customer.notes);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string>("");

  const notesChanged = notes !== customer.notes;

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const n = Number(products);
    if (!Number.isFinite(n) || n < 0) {
      setError("Vul een geldig aantal producten in.");
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/visits", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: customer.id,
          day,
          products: n,
          oil,
          ...(notesChanged ? { notes } : {}),
        }),
      });
      if (res.ok) {
        router.push(`/done/${encodeURIComponent(customer.id)}`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.error === "ALREADY_VISITED") {
        router.push(`/already-visited/${encodeURIComponent(customer.id)}`);
        return;
      }
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
        <h1 className="font-bold text-lg">Inchecken</h1>
        <span className="w-16" />
      </header>

      <NoteBanner note={customer.notes} />

      <section className="card mb-5">
        <p className="text-sm uppercase tracking-wide text-gray-500">Klant</p>
        <p className="text-2xl font-bold text-brand-blue">
          {customer.voornaam} {customer.achternaam}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          Postcode {customer.postcode || "—"} · ID {customer.id}
        </p>
      </section>

      <form onSubmit={onSubmit} className="space-y-6">
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

        <label className="card flex items-center gap-4 cursor-pointer">
          <input
            type="checkbox"
            checked={oil}
            onChange={(e) => setOil(e.target.checked)}
            className="w-7 h-7 accent-brand-orange"
          />
          <div>
            <p className="font-semibold text-lg">Olie ontvangen</p>
            <p className="text-sm text-gray-500">Vink aan als de klant olie meekrijgt</p>
          </div>
        </label>

        <div>
          <label className="label" htmlFor="notes">
            Notitie
          </label>
          <textarea
            id="notes"
            className="input min-h-[100px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Bijv. gedrag, opmerkingen, afspraken…"
          />
          {notesChanged && (
            <p className="text-xs text-amber-700 mt-1">
              Notitie wordt bijgewerkt bij bevestigen.
            </p>
          )}
        </div>

        {error && (
          <p className="text-red-600 text-center font-semibold">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || products === ""}
          className="btn-primary w-full text-xl py-6"
        >
          {submitting ? "Opslaan…" : "Bevestig bezoek"}
        </button>
      </form>
    </main>
  );
}
