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
  if (native) {
    try {
      return new native({ formats: FORMATS });
    } catch {
      // unsupported formats: use the bundled detector instead
    }
  }
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
  // The latest callback, so a re-render of the parent never restarts the camera.
  const onCodeRef = useRef(onCode);
  useEffect(() => {
    onCodeRef.current = onCode;
  });

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

    const fail = (text: string) => {
      if (stopped) return;
      setMessage(text);
      stop();
      setOpen(false);
    };

    (async () => {
      if (!navigator.mediaDevices?.getUserMedia)
        return fail(NUTRITION_TEXT.cameraUnavailable);
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
          audio: false,
        });
      } catch (err) {
        const name = err instanceof DOMException ? err.name : "";
        return fail(
          name === "NotFoundError" || name === "OverconstrainedError"
            ? NUTRITION_TEXT.cameraMissing
            : name === "NotReadableError"
              ? NUTRITION_TEXT.cameraBusy
              : NUTRITION_TEXT.cameraDenied,
        );
      }
      if (stopped || !video.current) return stop();
      video.current.srcObject = stream;
      try {
        await video.current.play();
      } catch {
        return fail(NUTRITION_TEXT.cameraUnavailable);
      }
      let detector: Detector;
      try {
        detector = await createDetector();
      } catch {
        return fail(NUTRITION_TEXT.scannerLoadFailed);
      }
      const tick = async () => {
        if (stopped || !video.current) return;
        try {
          const found = await detector.detect(video.current);
          const code = found.map((f) => f.rawValue).find(isValidBarcode);
          if (code && !stopped) {
            stop();
            setOpen(false);
            onCodeRef.current(code);
            return;
          }
        } catch {
          // a frame that cannot be read is skipped
        }
        if (!stopped) timer = setTimeout(tick, SCAN_INTERVAL_MS);
      };
      void tick();
    })();

    return () => {
      document.removeEventListener("visibilitychange", onHidden);
      stop();
    };
  }, [open]);

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
