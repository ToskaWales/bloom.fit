"use client";

import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { buttonClass, inputClass } from "@/components/ui";
import { saveFood } from "@/lib/local/nutrition";

const num = (v: string): number | null => {
  const n = Number(v.replace(",", "."));
  return v.trim() === "" || !Number.isFinite(n) ? null : n;
};

export function FoodForm({ onSaved }: { onSaved: () => void }) {
  const { db } = useLocal();
  const [name, setName] = useState("");
  const [basis, setBasis] = useState<"100g" | "portion">("100g");
  const [portion, setPortion] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [carbs, setCarbs] = useState("");
  const [fat, setFat] = useState("");
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    const r = await saveFood(db, {
      name,
      basis,
      portionG: basis === "portion" ? num(portion) : null,
      kcal: num(kcal),
      proteinG: num(protein),
      carbsG: num(carbs),
      fatG: num(fat),
    });
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
      <button className={buttonClass}>Lebensmittel speichern</button>
    </form>
  );
}
