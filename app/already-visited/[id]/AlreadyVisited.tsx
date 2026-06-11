"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { Customer } from "@/lib/excel";
import type { VisitDay } from "@/lib/week";
import NoteBanner from "@/components/NoteBanner";

export default function AlreadyVisited({
  customer,
  defaultDay,
}: {
  customer: Customer;
  defaultDay: VisitDay;
}) {
  const router = useRouter();
  const visit = customer.visitThisWeek;
  const [overrideOpen, setOverrideOpen] = useState(false);
  const [confirm, setConfirm] = useState(false);
  const [day, setDay] = useState<VisitDay>(defaultDay);
  const [products, setProducts] = useState("");
  const [oil, setOil] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const [savedNotes, setSavedNotes] = useState(customer.notes);
  const [notes, setNotes] = useState(customer.notes);
  const [savingNotes, setSavingNotes] = useState(false);
  const [notesStatus, setNotesStatus] = useState<"" | "saved" | "error">("");

  async function saveNotes() {
    setSavingNotes(true);
    setNotesStatus("");
    try {
      const res = await fetch(
        `/api/customers/${encodeURIComponent(customer.id)}`,
        {
          method: "PATCH",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ notes }),
        }
      );
      if (res.ok) {
        setSavedNotes(notes);
        setNotesStatus("saved");
      } else {
        setNotesStatus("error");
      }
    } catch {
      setNotesStatus("error");
    } finally {
      setSavingNotes(false);
    }
  }

  async function submitOverride(e: React.FormEvent) {
    e.preventDefault();
    if (!confirm) {
      setError("Bevestig dat de eerdere registratie een vergissing was.");
      return;
    }
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
          override: true,
        }),
      });
      if (res.ok) {
        router.push(`/done/${encodeURIComponent(customer.id)}`);
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
          ← Terug
        </Link>
        <h1 className="font-bold text-lg">Al ingecheckt</h1>
        <span className="w-16" />
      </header>

      <div className="rounded-2xl bg-amber-50 border-2 border-amber-300 p-6 mb-5 text-center">
        <p className="text-sm uppercase tracking-wide text-amber-700 font-semibold">
          Deze klant is al geweest deze week
        </p>
        <p className="text-2xl font-extrabold mt-2 text-gray-900">
          {customer.voornaam} {customer.achternaam}
        </p>
      </div>

      <NoteBanner note={savedNotes} />

      <section className="card mb-5">
        <h2 className="font-semibold text-gray-700 mb-3">Eerder bezoek</h2>
        <dl className="grid grid-cols-2 gap-y-2 text-base">
          <dt className="text-gray-500">Dag</dt>
          <dd className="font-semibold text-right">
            {visit?.day || "Onbekend"}
          </dd>
          <dt className="text-gray-500">Producten</dt>
          <dd className="font-semibold text-right">
            {visit?.products ?? "—"}
          </dd>
          <dt className="text-gray-500">Olie</dt>
          <dd className="font-semibold text-right">
            {visit?.oil ? "Ja" : "Nee"}
          </dd>
        </dl>
      </section>

      <section className="card mb-5">
        <h2 className="font-semibold text-gray-700 mb-3">Notitie bijwerken</h2>
        <textarea
          className="input min-h-[100px]"
          value={notes}
          onChange={(e) => {
            setNotes(e.target.value);
            setNotesStatus("");
          }}
          placeholder="Bijv. gedrag, opmerkingen, afspraken…"
        />
        <div className="flex items-center justify-between gap-3 mt-3">
          <p className="text-xs">
            {notesStatus === "saved" && (
              <span className="text-green-700 font-semibold">Opgeslagen ✓</span>
            )}
            {notesStatus === "error" && (
              <span className="text-red-600 font-semibold">
                Opslaan mislukt
              </span>
            )}
          </p>
          <button
            type="button"
            onClick={saveNotes}
            disabled={savingNotes || notes === savedNotes}
            className="btn-secondary px-5 py-3 text-base"
          >
            {savingNotes ? "Opslaan…" : "Notitie opslaan"}
          </button>
        </div>
      </section>

      <Link href="/" className="btn-secondary w-full mb-3">
        Klaar
      </Link>

      {!overrideOpen ? (
        <button
          type="button"
          onClick={() => setOverrideOpen(true)}
          className="text-sm text-gray-500 underline self-center py-2"
        >
          Was dit een vergissing? Override
        </button>
      ) : (
        <form onSubmit={submitOverride} className="card mt-3 space-y-4 border-red-200">
          <p className="text-sm text-red-700 font-semibold">
            Override gebruiken alleen bij een foutieve eerdere registratie. De
            gegevens worden overschreven.
          </p>

          <div>
            <label className="label">Dag</label>
            <div className="grid grid-cols-2 gap-3">
              {(["Woensdag", "Donderdag"] as VisitDay[]).map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDay(d)}
                  className={
                    "rounded-2xl py-4 font-semibold border-2 transition " +
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
              className="input text-xl text-center"
              inputMode="numeric"
              pattern="[0-9]*"
              value={products}
              onChange={(e) => setProducts(e.target.value.replace(/[^0-9]/g, ""))}
              placeholder="0"
            />
          </div>

          <label className="flex items-center gap-3">
            <input
              type="checkbox"
              checked={oil}
              onChange={(e) => setOil(e.target.checked)}
              className="w-6 h-6 accent-brand-orange"
            />
            <span>Olie ontvangen</span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              checked={confirm}
              onChange={(e) => setConfirm(e.target.checked)}
              className="w-6 h-6 mt-0.5 accent-red-600"
            />
            <span className="text-sm">
              Ik bevestig dat de eerdere registratie een vergissing was en wil
              deze overschrijven.
            </span>
          </label>

          {error && (
            <p className="text-red-600 text-center font-semibold">{error}</p>
          )}

          <button
            type="submit"
            disabled={submitting || !confirm || products === ""}
            className="btn-danger w-full"
          >
            {submitting ? "Overschrijven…" : "Overschrijven bevestigen"}
          </button>
        </form>
      )}
    </main>
  );
}
