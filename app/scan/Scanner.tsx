"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { BrowserMultiFormatReader, type IScannerControls } from "@zxing/browser";
import { resolveScan, useBarcodeScanner } from "./scanner-lib";

type Mode = "scanner" | "camera" | "manual";

export default function Scanner() {
  const router = useRouter();
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<IScannerControls | null>(null);
  const handledRef = useRef(false);
  const [mode, setMode] = useState<Mode>("scanner");
  const [status, setStatus] = useState<"loading" | "scanning" | "error">("loading");
  const [errorMsg, setErrorMsg] = useState<string>("");
  const [manualId, setManualId] = useState("");
  const [scannerBusy, setScannerBusy] = useState(false);

  // Default mode: USB barcode scanner (keyboard-wedge). Active only in scanner
  // mode so it doesn't fight the camera or the manual input field.
  const onScannerInput = useCallback((code: string) => {
    setScannerBusy(true);
    handleScan(code);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useBarcodeScanner(onScannerInput, mode === "scanner");

  // Camera mode (backup): decode the barcode from the webcam with ZXing.
  useEffect(() => {
    if (mode !== "camera") return;

    let cancelled = false;
    setStatus("loading");
    setErrorMsg("");
    const reader = new BrowserMultiFormatReader();

    (async () => {
      if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
        setStatus("error");
        setErrorMsg(
          "Camera niet beschikbaar in deze browser. Open de app via HTTPS of localhost."
        );
        return;
      }

      const onDecoded = (text: string) => {
        if (handledRef.current) return;
        handledRef.current = true;
        controlsRef.current?.stop();
        handleScan(text);
      };

      const tryStart = async (constraints: MediaStreamConstraints) => {
        const controls = await reader.decodeFromConstraints(
          constraints,
          videoRef.current!,
          (result) => {
            if (result) onDecoded(result.getText());
          }
        );
        controlsRef.current = controls;
      };

      try {
        await tryStart({ video: { facingMode: { ideal: "environment" } } });
        if (!cancelled) setStatus("scanning");
      } catch (err1: unknown) {
        // Retry with no constraints — laptops without a rear camera need this.
        try {
          await tryStart({ video: true });
          if (!cancelled) setStatus("scanning");
        } catch (err2: unknown) {
          if (cancelled) return;
          const msg =
            (err2 instanceof Error ? err2.message : String(err2)) +
            " " +
            (err1 instanceof Error ? err1.message : String(err1));
          setStatus("error");
          if (/Permission|NotAllowed|denied/i.test(msg)) {
            setErrorMsg(
              "Cameratoegang geweigerd. Sta de camera toe in de browser en probeer opnieuw."
            );
          } else if (/NotFound|DevicesNotFound/i.test(msg)) {
            setErrorMsg(
              "Geen camera gevonden op dit apparaat. Gebruik handmatige invoer."
            );
          } else if (/NotReadable|TrackStart/i.test(msg)) {
            setErrorMsg(
              "Camera is in gebruik door een andere app. Sluit andere apps en probeer opnieuw."
            );
          } else {
            setErrorMsg(
              "Camera kon niet gestart worden. Gebruik handmatige invoer."
            );
          }
        }
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
      controlsRef.current = null;
      handledRef.current = false;
    };
  }, [mode]);

  async function handleScan(id: string) {
    if (!id.trim()) {
      handledRef.current = false;
      setScannerBusy(false);
      return;
    }
    try {
      await resolveScan(router, id);
    } catch {
      setStatus("error");
      setErrorMsg("Kon de server niet bereiken.");
      handledRef.current = false;
      setScannerBusy(false);
    }
  }

  return (
    <main className="flex-1 flex flex-col px-5 pt-6 pb-8">
      <header className="flex items-center justify-between mb-4">
        <Link
          href="/"
          className="text-brand-blue font-semibold py-2 -ml-2 pl-2"
        >
          ← Terug
        </Link>
        <h1 className="font-bold text-lg">Scan stadspas</h1>
        <span className="w-12" />
      </header>

      {mode === "scanner" && (
        <div className="flex-1 flex flex-col">
          <div className="bg-brand-blue/5 border-2 border-dashed border-brand-blue/30 rounded-2xl px-6 py-32 text-center mb-5">
            <p className="font-semibold text-lg text-brand-blue mb-1">
              {scannerBusy ? "Bezig met zoeken…" : "Klaar om te scannen"}
            </p>
            <p className="text-gray-500 text-sm">
              Scan de barcode van de stadspas met de handscanner
            </p>
          </div>

          <p className="text-center text-gray-500 text-sm mb-4">
            Werkt de scanner niet? Kies een andere optie hieronder.
          </p>

          <div className="space-y-3 mt-auto">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setMode("camera")}
            >
              Gebruik camera
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setMode("manual")}
            >
              Handmatig invoeren
            </button>
          </div>
        </div>
      )}

      {mode === "camera" && (
        <div className="flex-1 flex flex-col">
          <div className="relative aspect-[3/4] bg-black rounded-2xl overflow-hidden mb-5">
            <video
              ref={videoRef}
              playsInline
              muted
              className="absolute inset-0 w-full h-full object-cover"
            />
            <div className="absolute inset-0 pointer-events-none">
              <div className="absolute inset-x-6 top-1/2 -translate-y-1/2 h-32 border-4 border-brand-orange rounded-2xl shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            {status === "loading" && (
              <div className="absolute inset-0 flex items-center justify-center text-white">
                Camera laden…
              </div>
            )}
            {status === "error" && (
              <div className="absolute inset-0 flex items-center justify-center text-white text-center p-6 bg-black/70">
                {errorMsg}
              </div>
            )}
          </div>

          <p className="text-center text-gray-500 text-sm mb-4">
            Richt de camera op de barcode van de stadspas
          </p>

          <div className="space-y-3 mt-auto">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setMode("scanner")}
            >
              Terug naar handscanner
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setMode("manual")}
            >
              Handmatig invoeren
            </button>
          </div>
        </div>
      )}

      {mode === "manual" && (
        <div className="flex-1 flex flex-col">
          <div className="card">
            <h2 className="font-semibold text-brand-blue mb-3">
              Handmatig ID invoeren
            </h2>
            <form
              className="space-y-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (manualId.trim()) handleScan(manualId);
              }}
            >
              <input
                className="input"
                inputMode="numeric"
                autoComplete="off"
                autoFocus
                placeholder="Stadspas ID"
                value={manualId}
                onChange={(e) => setManualId(e.target.value)}
              />
              <button type="submit" className="btn-primary w-full">
                Zoek klant
              </button>
            </form>
          </div>

          <div className="space-y-3 mt-auto">
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setMode("scanner")}
            >
              Terug naar handscanner
            </button>
            <button
              type="button"
              className="btn-secondary w-full"
              onClick={() => setMode("camera")}
            >
              Gebruik camera
            </button>
          </div>
        </div>
      )}
    </main>
  );
}
