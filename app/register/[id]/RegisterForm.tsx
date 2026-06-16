"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import NoteBanner from "@/components/NoteBanner";
import type { VisitDay } from "@/lib/week";

const ROBIN_NOTE =
  "Robin zou de nieuwe klant graag willen ontmoeten! Roep haar er even bij.";

export default function RegisterForm({
  id,
  defaultDay,
}: {
  // The known stadspas ID (scan flow). When omitted (zoek-op-naam flow) the
  // volunteer can enter the stadspas ID by hand, or leave it blank for a
  // customer without a stadspas — the server then generates a unique ID.
  id?: string;
  defaultDay: VisitDay;
}) {
  const router = useRouter();
  const idKnown = id != null;
  const [stadpasId, setStadpasId] = useState(id ?? "");
  const [voornaam, setVoornaam] = useState("");
  const [achternaam, setAchternaam] = useState("");
  const [postcode, setPostcode] = useState("");
  const [idVerified, setIdVerified] = useState(false);
  const [notes, setNotes] = useState("");

  const [day, setDay] = useState<VisitDay>(defaultDay);
  const [products, setProducts] = useState("");
  const [oil, setOil] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!voornaam.trim() || !achternaam.trim()) {
      setError("Voor- en achternaam zijn verplicht.");
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
      const res = await fetch("/api/customers", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          id: stadpasId.trim(),
          voornaam: voornaam.trim(),
          achternaam: achternaam.trim(),
          postcode: postcode.trim(),
          idVerified,
          notes: notes.trim(),
          visit: { day, products: n, oil },
        }),
      });
      if (res.ok) {
        const data = await res.json().catch(() => ({}));
        const newId = data?.customer?.id ?? stadpasId.trim();
        router.push(`/done/${encodeURIComponent(newId)}?new=1`);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.error === "CUSTOMER_EXISTS") {
        router.push(`/check-in/${encodeURIComponent(stadpasId.trim())}`);
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
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-brand-blue font-semibold py-2 -ml-2 pl-2">
          ← Annuleer
        </Link>
        <h1 className="font-bold text-lg">Nieuwe klant</h1>
        <span className="w-16" />
      </header>

      <p className="text-sm text-gray-500 mb-5">
        {idKnown
          ? "Deze stadspas is nog niet bekend. Registreer de klant en log meteen het eerste bezoek."
          : "Registreer de nieuwe klant en log meteen het eerste bezoek."}
      </p>

      <NoteBanner note={ROBIN_NOTE} />

      <form onSubmit={onSubmit} className="space-y-5">
        <div>
          <label className="label" htmlFor="stadpasId">Stadspas ID</label>
          {idKnown ? (
            <input
              id="stadpasId"
              className="input bg-gray-100 text-gray-500"
              value={stadpasId}
              readOnly
            />
          ) : (
            <>
              <input
                id="stadpasId"
                className="input"
                inputMode="numeric"
                autoComplete="off"
                placeholder="Laat leeg als er geen stadspas is"
                value={stadpasId}
                onChange={(e) => setStadpasId(e.target.value)}
              />
              <p className="text-sm text-gray-500 mt-1">
                Geen stadspas? Laat dit veld leeg — er wordt automatisch een
                uniek ID aangemaakt.
              </p>
            </>
          )}
        </div>

        <div>
          <label className="label" htmlFor="voornaam">Voornaam</label>
          <input
            id="voornaam"
            className="input"
            autoFocus
            value={voornaam}
            onChange={(e) => setVoornaam(e.target.value)}
            autoComplete="given-name"
          />
        </div>

        <div>
          <label className="label" htmlFor="achternaam">Achternaam</label>
          <input
            id="achternaam"
            className="input"
            value={achternaam}
            onChange={(e) => setAchternaam(e.target.value)}
            autoComplete="family-name"
          />
        </div>

        <div>
          <label className="label" htmlFor="postcode">Postcode</label>
          <input
            id="postcode"
            className="input"
            value={postcode}
            onChange={(e) => setPostcode(e.target.value.toUpperCase())}
            autoComplete="postal-code"
            placeholder="1234 AB"
          />
        </div>

        <label className="card flex items-center gap-4 cursor-pointer">
          <input
            type="checkbox"
            checked={idVerified}
            onChange={(e) => setIdVerified(e.target.checked)}
            className="w-7 h-7 accent-brand-orange"
          />
          <div>
            <p className="font-semibold">ID gecontroleerd</p>
            <p className="text-sm text-gray-500">Identiteitsbewijs gezien</p>
          </div>
        </label>

        <div>
          <label className="label" htmlFor="notes">Notities (optioneel)</label>
          <textarea
            id="notes"
            className="input min-h-[100px]"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </div>

        <hr className="border-gray-200" />

        <h2 className="font-bold text-lg text-brand-blue">Eerste bezoek</h2>

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
          <label className="label" htmlFor="products">Aantal producten</label>
          <input
            id="products"
            className="input text-2xl text-center"
            inputMode="numeric"
            pattern="[0-9]*"
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
            <p className="font-semibold">Olie ontvangen</p>
            <p className="text-sm text-gray-500">Vink aan als de klant olie meekrijgt</p>
          </div>
        </label>

        {error && (
          <p className="text-red-600 text-center font-semibold">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting || products === ""}
          className="btn-primary w-full text-xl py-6"
        >
          {submitting ? "Opslaan…" : "Registreer & check in"}
        </button>
      </form>
    </main>
  );
}
