"use client";

import { useRef, useState } from "react";
import { BarcodeScanner } from "@/components/nutrition/barcode-scanner";
import { FoodForm, type FoodPrefill } from "@/components/nutrition/food-form";
import { useLocal } from "@/components/local-provider";
import { buttonClass, inputClass } from "@/components/ui";
import { findFoodByBarcode } from "@/lib/local/nutrition";
import { cleanBarcode, normaliseBarcode } from "@/lib/nutrition/barcode";
import { NUTRITION_TEXT } from "@/lib/nutrition/texts";

const STATUS_TEXT: Record<number, string> = {
  400: NUTRITION_TEXT.barcodeInvalid,
  401: NUTRITION_TEXT.barcodeLogin,
  403: NUTRITION_TEXT.barcodeNotAllowed,
  404: NUTRITION_TEXT.barcodeNotFound,
  422: NUTRITION_TEXT.barcodeUnusable,
  429: NUTRITION_TEXT.barcodeLimited,
};

interface FoundFood {
  name: string;
  brand: string | null;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

export function BarcodeLookup({
  onKnown,
  onSaved,
  onPrefillChange,
}: {
  onKnown: (foodId: string) => void;
  onSaved: () => void;
  /** True while a found product waits to be saved (the manual form steps aside). */
  onPrefillChange: (showing: boolean) => void;
}) {
  const { db, nutritionMode } = useLocal();
  const [digits, setDigits] = useState("");
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // Only the newest search may show its result; older answers are dropped.
  const latest = useRef(0);
  const [prefill, setPrefillState] = useState<FoodPrefill | null>(null);
  const setPrefill = (p: FoodPrefill | null) => {
    setPrefillState(p);
    onPrefillChange(p !== null);
  };

  async function search(raw: string) {
    if (busy) return;
    const mine = ++latest.current;
    const current = () => mine === latest.current;
    setMessage(null);
    setPrefill(null);
    const code = normaliseBarcode(cleanBarcode(raw));
    if (!code) return setMessage(NUTRITION_TEXT.barcodeInvalid);
    if (!db) return;
    setBusy(true);
    try {
      // Already saved on this device: no request, works offline.
      const known = await findFoodByBarcode(db, code);
      if (!current()) return;
      if (known) return onKnown(known.id);
      if (nutritionMode === "off") return setMessage(NUTRITION_TEXT.barcodeOff);
      if (!navigator.onLine) return setMessage(NUTRITION_TEXT.barcodeOffline);
      const res = await fetch("/api/food/lookup", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ barcode: code }),
        cache: "no-store",
        signal: AbortSignal.timeout(8000),
      });
      if (!current()) return;
      if (!res.ok)
        return setMessage(
          STATUS_TEXT[res.status] ?? NUTRITION_TEXT.barcodeUpstream,
        );
      const body = (await res.json()) as { data?: { food: FoundFood } };
      if (!current()) return;
      if (!body.data) return setMessage(NUTRITION_TEXT.barcodeUpstream);
      setPrefill({ ...body.data.food, barcode: code });
    } catch {
      if (current())
        setMessage(
          navigator.onLine
            ? NUTRITION_TEXT.barcodeUpstream
            : NUTRITION_TEXT.barcodeOffline,
        );
    } finally {
      if (current()) setBusy(false);
    }
  }

  return (
    <section
      aria-labelledby="barcode-title"
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <h3 id="barcode-title" className="font-semibold">
        {NUTRITION_TEXT.barcodeTitle}
      </h3>
      <p className="text-sm text-neutral-600">{NUTRITION_TEXT.barcodeHint}</p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          void search(digits);
        }}
        className="flex gap-2"
      >
        <input
          aria-label="Barcode-Ziffern"
          placeholder="z. B. 4006381333931"
          inputMode="numeric"
          autoComplete="off"
          value={digits}
          onChange={(e) => setDigits(e.target.value)}
          className={`${inputClass} min-w-0 flex-1`}
        />
        <button disabled={busy} className={buttonClass}>
          {NUTRITION_TEXT.barcodeSearch}
        </button>
      </form>
      <BarcodeScanner
        onCode={(code) => {
          setDigits(code);
          void search(code);
        }}
      />
      {message && (
        <p
          role="status"
          className="rounded-xl bg-neutral-100 p-3 text-sm text-neutral-900"
        >
          {message}
        </p>
      )}
      {prefill && (
        <FoodForm
          key={prefill.barcode}
          prefill={prefill}
          onSaved={() => {
            setPrefill(null);
            setDigits("");
            onSaved();
          }}
          onDismiss={() => setPrefill(null)}
        />
      )}
    </section>
  );
}
