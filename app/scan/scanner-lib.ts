"use client";

import { useEffect } from "react";
import type { useRouter } from "next/navigation";

type AppRouter = ReturnType<typeof useRouter>;

/**
 * Listens for input from a USB barcode scanner. Such scanners act like a
 * keyboard: they "type" the barcode very fast and finish with an Enter key.
 * Keystrokes are buffered globally and the code is submitted on Enter.
 */
export function useBarcodeScanner(
  onScan: (code: string) => void,
  enabled = true
) {
  useEffect(() => {
    if (!enabled) return;

    let buffer = "";
    let lastKeyTime = 0;

    const onKeyDown = (e: KeyboardEvent) => {
      // Ignore keystrokes aimed at a real input/textarea.
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable)
      ) {
        return;
      }

      const now = Date.now();
      // A gap longer than 100ms means a new scan (or stray human keypress).
      if (now - lastKeyTime > 100) buffer = "";
      lastKeyTime = now;

      if (e.key === "Enter") {
        const code = buffer;
        buffer = "";
        if (code) onScan(code);
        return;
      }

      // Only collect printable single characters (digits/letters).
      if (e.key.length === 1) buffer += e.key;
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onScan, enabled]);
}

/**
 * Looks up the customer for a scanned/entered id and navigates to the
 * appropriate page. Throws if the server cannot be reached.
 */
export async function resolveScan(router: AppRouter, id: string): Promise<void> {
  const trimmed = id.trim();
  if (!trimmed) return;

  const res = await fetch(`/api/customers/${encodeURIComponent(trimmed)}`, {
    cache: "no-store",
  });
  if (res.status === 404) {
    router.push(`/register/${encodeURIComponent(trimmed)}`);
    return;
  }
  const data = await res.json();
  const customer = data?.customer;
  if (customer?.lockedThisWeek) {
    router.push(`/already-visited/${encodeURIComponent(trimmed)}`);
  } else if (customer?.groepId) {
    router.push(`/check-in-groep/${encodeURIComponent(trimmed)}`);
  } else {
    router.push(`/check-in/${encodeURIComponent(trimmed)}`);
  }
}
