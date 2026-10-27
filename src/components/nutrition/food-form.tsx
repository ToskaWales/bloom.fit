"use client";

// Form to save a food (name, kcal, protein, optional carbs/fat) per 100 g or per portion, or to confirm a barcode result.
// Writes to the local food table (saveFood); values are text until parsed, so German decimal commas work.
// Neighbours: foods-list.tsx, barcode-lookup.tsx (prefill from Open Food Facts), lib/nutrition/parse.

import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { buttonClass, inputClass } from "@/components/ui";
import { parseFields } from "@/lib/nutrition/parse";
import { NUTRITION_TEXT } from "@/lib/nutrition/texts";
import { saveFood } from "@/lib/local/nutrition";

export interface FoodPrefill {
  name: string;
  brand: string | null;
  barcode: string;
  kcal: number | null;
  proteinG: number | null;
  carbsG: number | null;
  fatG: number | null;
}

// Number to input text with a decimal comma.
const text = (n: number | null) =>
  n === null ? "" : String(n).replace(".", ",");

// With a prefill (an Open Food Facts product) the values are per 100 g and can
// be corrected before saving; the source is remembered with the food.
export function FoodForm({
  onSaved,
  prefill,
  onDismiss,
}: {
  onSaved: () => void;
  prefill?: FoodPrefill;
  onDismiss?: () => void;
}) {
  const { db } = useLocal();
  const [name, setName] = useState(prefill?.name ?? "");
  const [basis, setBasis] = useState<"100g" | "portion">("100g");
  const [portion, setPortion] = useState("");
  const [kcal, setKcal] = useState(text(prefill?.kcal ?? null));
  const [protein, setProtein] = useState(text(prefill?.proteinG ?? null));
  const [carbs, setCarbs] = useState(text(prefill?.carbsG ?? null));
  const [fat, setFat] = useState(text(prefill?.fatG ?? null));
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!db || saving) return;
    const parsed = parseFields({
      portion: basis === "portion" ? portion : "",
      kcal,
      protein,
      carbs,
      fat,
    });
    if (!parsed.ok) return setError(parsed.error);
    const v = parsed.values;
    setSaving(true);
    const r = await saveFood(
      db,
      {
        name,
        basis,
        portionG: v.portion,
        kcal: v.kcal,
        proteinG: v.protein,
        carbsG: v.carbs,
        fatG: v.fat,
      },
      prefill
        ? {
            barcode: prefill.barcode,
            brand: prefill.brand ?? undefined,
            source: "off",
          }
        : {},
    );
    setSaving(false);
    if (!r.ok) return setError(r.error);
    onSaved();
  }

  const per = basis === "100g" ? "pro 100 g" : "pro Portion";
  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <input
        aria-label="Name"
        placeholder="Name"
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      {prefill ? (
        <p className="text-sm text-neutral-700">
          Werte pro 100 g (bei Getränken pro 100 ml).{" "}
          {NUTRITION_TEXT.attribution}
        </p>
      ) : (
        <div
          role="group"
          aria-label="Werte beziehen sich auf"
          className="flex gap-2"
        >
          {(["100g", "portion"] as const).map((b) => (
            <button
              type="button"
              key={b}
              aria-pressed={basis === b}
              onClick={() => setBasis(b)}
              className={`rounded-full border px-3 py-1.5 text-sm ${basis === b ? "border-rose-600 bg-rose-50 text-rose-800" : "border-neutral-300 bg-white"}`}
            >
              {b === "100g" ? "Pro 100 g" : "Pro Portion"}
            </button>
          ))}
        </div>
      )}
      {basis === "portion" && (
        <input
          aria-label="Portionsgröße (g)"
          placeholder="Portionsgröße (g)"
          inputMode="decimal"
          value={portion}
          onChange={(e) => setPortion(e.target.value)}
          className={inputClass}
        />
      )}
      <div className="grid grid-cols-2 gap-3">
        <input
          aria-label={`Kalorien ${per}`}
          placeholder={`kcal ${per}`}
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label={`Eiweiß ${per}`}
          placeholder="Eiweiß (g)"
          inputMode="decimal"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label={`Kohlenhydrate ${per} (optional)`}
          placeholder="Kohlenhydrate (g, optional)"
          inputMode="decimal"
          value={carbs}
          onChange={(e) => setCarbs(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label={`Fett ${per} (optional)`}
          placeholder="Fett (g, optional)"
          inputMode="decimal"
          value={fat}
          onChange={(e) => setFat(e.target.value)}
          className={inputClass}
        />
      </div>
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-neutral-100 p-3 text-sm text-neutral-900"
        >
          {error}
        </p>
      )}
      {prefill?.brand && (
        <p className="text-sm text-neutral-600">Marke: {prefill.brand}</p>
      )}
      <button disabled={saving} className={buttonClass}>
        Lebensmittel speichern
      </button>
      {onDismiss && (
        <button type="button" onClick={onDismiss} className="text-sm underline">
          {NUTRITION_TEXT.barcodeDismiss}
        </button>
      )}
    </form>
  );
}
