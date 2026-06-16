"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Customer } from "@/lib/excel";

export default function SearchClient() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const term = q.trim();
    if (term.length < 2) {
      setResults([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const ctrl = new AbortController();
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/customers/search?q=${encodeURIComponent(term)}`,
          { signal: ctrl.signal, cache: "no-store" }
        );
        const data = await res.json();
        setResults(data.customers ?? []);
      } catch {
        /* abort */
      } finally {
        setLoading(false);
      }
    }, 200);
    return () => {
      ctrl.abort();
      clearTimeout(t);
    };
  }, [q]);

  return (
    <main className="flex-1 flex flex-col px-5 pt-6 pb-8">
      <header className="flex items-center justify-between mb-4">
        <Link href="/" className="text-brand-blue font-semibold py-2 -ml-2 pl-2">
          ← Terug
        </Link>
        <h1 className="font-bold text-lg">Zoek klant</h1>
        <span className="w-16" />
      </header>

      <input
        className="input mb-5"
        placeholder="Voornaam of achternaam"
        value={q}
        onChange={(e) => setQ(e.target.value)}
        autoFocus
        autoComplete="off"
      />

      {loading && q.trim().length >= 2 && (
        <p className="text-center text-gray-400">Zoeken…</p>
      )}

      {!loading && q.trim().length >= 2 && results.length === 0 && (
        <div className="mt-6 text-center">
          <p className="text-gray-500 mb-4">Geen klant gevonden.</p>
          <Link href="/register" className="btn-primary w-full">
            Nieuwe klant toevoegen
          </Link>
        </div>
      )}

      <ul className="space-y-2">
        {results.map((c) => {
          const href = c.lockedThisWeek
            ? `/already-visited/${encodeURIComponent(c.id)}`
            : c.groepId
            ? `/check-in-groep/${encodeURIComponent(c.id)}`
            : `/check-in/${encodeURIComponent(c.id)}`;
          return (
            <li key={c.id}>
              <Link
                href={href}
                className="card flex items-center justify-between hover:bg-brand-blue-light active:bg-brand-blue-light"
              >
                <div>
                  <p className="font-semibold text-lg">
                    {c.voornaam} {c.achternaam}
                  </p>
                  <p className="text-sm text-gray-500">
                    {c.postcode || "—"}
                    {c.groepId ? ` · Groep ${c.groepId}` : ""} · ID {c.id}
                  </p>
                </div>
                {c.lockedThisWeek && (
                  <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-800 font-semibold">
                    Al geweest
                  </span>
                )}
              </Link>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
