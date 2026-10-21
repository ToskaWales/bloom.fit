"use client";

import { useEffect, useRef, useState } from "react";
import { secondaryButtonClass } from "@/components/ui";
import { isValidBarcode } from "@/lib/nutrition/barcode";
import { NUTRITION_TEXT } from "@/lib/nutrition/texts";

const FORMATS = ["ean_13", "ean_8", "upc_a"];
const SCAN_INTERVAL_MS = 250;

interface Detector {
  detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]>;
}

// The browser's own detector where it exists (Chrome on Android); otherwise a
// small WebAssembly one that is only loaded now and served from our own origin.
async function createDetector(): Promise<Detector> {
  const native = (
    globalThis as { BarcodeDetector?: new (o: object) => Detector }
  ).BarcodeDetector;
  if (native) return new native({ formats: FORMATS });
  const mod = await import("barcode-detector/ponyfill");
  mod.setZXingModuleOverrides({
    locateFile: (path: string, prefix: string) =>
      path.endsWith(".wasm") ? "/vendor/zxing_reader.wasm" : prefix + path,
  });
  return new mod.BarcodeDetector({
    formats: FORMATS as ConstructorParameters<
      typeof mod.BarcodeDetector
    >[0] extends { formats?: infer F }
      ? Extract<F, unknown[]>
      : never,
  }) as unknown as Detector;
}

// The camera only starts after a tap, runs only while this is open, and no
// frame is ever stored or sent anywhere: detection happens on the device.
export function BarcodeScanner({ onCode }: { onCode: (code: string) => void }) {
  const [open, setOpen] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const video = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    if (!open) return;
    let stopped = false;
    let stream: MediaStream | null = null;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const stop = () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      stream?.getTracks().forEach((t) => t.stop());
      stream = null;
    };
    const onHidden = () => {
      if (document.visibilityState === "hidden") {
        stop();
        setOpen(false);
      }
    };
    document.addEventListener("visibilitychange", onHidden);

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setMessage(NUTRITION_TEXT.cameraUnavailable);
        setOpen(false);
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch {
        setMessage(NUTRITION_TEXT.cameraDenied);
        setOpen(false);
        return;
      }
      if (stopped || !video.current) return stop();
      video.current.srcObject = stream;
      await video.current.play().catch(() => {});
      let detector: Detector;
      try {
        detector = await createDetector();
      } catch {
        setMessage(NUTRITION_TEXT.cameraUnavailable);
        stop();
        setOpen(false);
        return;
      }
      const tick = async () => {
        if (stopped || !video.current) return;
        try {
          const found = await detector.detect(video.current);
          const code = found.map((f) => f.rawValue).find(isValidBarcode);
          if (code) {
            stop();
            setOpen(false);
            onCode(code);
            return;
          }
        } catch {
          // a frame that cannot be read is skipped
        }
        timer = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      void tick();
    })();

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      stop();
    };
  }, [open, onCode]);

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={() => {
          setMessage(null);
          setOpen((o) => !o);
        }}
        className={secondaryButtonClass}
      >
        {open ? NUTRITION_TEXT.barcodeScanClose : NUTRITION_TEXT.barcodeScan}
      </button>
      {open && (
        <>
          <video
            ref={video}
            playsInline
            muted
            aria-label="Kamerabild zum Scannen"
            className="w-full rounded-xl bg-neutral-900"
          />
          <p className="text-xs text-neutral-600">
            {NUTRITION_TEXT.cameraHint}
          </p>
        </>
      )}
      {message && (
        <p
          role="status"
          className="rounded-xl bg-neutral-100 p-3 text-sm text-neutral-900"
        >
          {message}
        </p>
      )}
    </div>
  );
}
