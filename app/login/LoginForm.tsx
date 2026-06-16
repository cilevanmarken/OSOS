"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm({ next }: { next: string }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!password) return;
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch("/api/login", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (res.ok) {
        // Full navigation so the new cookie is sent and middleware re-runs.
        window.location.assign(next);
        return;
      }
      const data = await res.json().catch(() => ({}));
      if (data?.error === "NOT_CONFIGURED") {
        setError("Er is nog geen wachtwoord ingesteld. Neem contact op met de beheerder.");
      } else {
        setError("Onjuist wachtwoord. Probeer opnieuw.");
      }
    } catch {
      setError("Geen verbinding met de server.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="space-y-5">
      <div>
        <label className="label" htmlFor="password">Wachtwoord</label>
        <input
          id="password"
          type="password"
          className="input"
          autoFocus
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error && <p className="text-red-600 text-center font-semibold">{error}</p>}

      <button
        type="submit"
        disabled={submitting || !password}
        className="btn-primary w-full text-xl py-6"
      >
        {submitting ? "Bezig…" : "Inloggen"}
      </button>
    </form>
  );
}
