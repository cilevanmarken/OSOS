"use client";

import { useCallback, useState } from "react";
import { useRouter } from "next/navigation";
import { resolveScan, useBarcodeScanner } from "./scan/scanner-lib";

/**
 * Lets a volunteer scan a stadspas straight from the home page with the USB
 * barcode scanner, without first clicking "Scan stadspas". Clicking the button
 * still works as a manual/camera fallback.
 */
export default function HomeScanListener() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const onScan = useCallback(
    async (code: string) => {
      setBusy(true);
      try {
        await resolveScan(router, code);
      } catch {
        setBusy(false);
      }
    },
    [router]
  );

  useBarcodeScanner(onScan, true);

  if (!busy) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 text-white text-lg">
      Bezig met zoeken…
    </div>
  );
}
