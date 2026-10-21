"use client";

import { useState } from "react";
import { useLocal } from "@/components/local-provider";
import { inputClass, buttonClass } from "@/components/ui";
import { addQuickEntry } from "@/lib/local/nutrition";
import type { Meal } from "@/lib/local/types";
import { parseFields } from "@/lib/nutrition/parse";
import { MEAL_LABEL, NUTRITION_TEXT } from "@/lib/nutrition/texts";

export function MealSelect({
  value,
  onChange,
}: {
  value: Meal | null;
  onChange: (m: Meal | null) => void;
}) {
  return (
    <select
      aria-label="Mahlzeit"
      value={value ?? ""}
      onChange={(e) => onChange((e.target.value || null) as Meal | null)}
      className={inputClass}
    >
      <option value="">Ohne Mahlzeit</option>
      {(Object.keys(MEAL_LABEL) as Meal[]).map((m) => (
        <option key={m} value={m}>
          {MEAL_LABEL[m]}
        </option>
      ))}
    </select>
  );
}

export function QuickAddForm({ day }: { day: string }) {
  const { db } = useLocal();
  const [name, setName] = useState("");
  const [kcal, setKcal] = useState("");
  const [protein, setProtein] = useState("");
  const [meal, setMeal] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!db) return;
    const parsed = parseFields({ kcal, protein });
    if (!parsed.ok) return setError(parsed.error);
    const r = await addQuickEntry(db, {
      day,
      meal,
      name,
      kcal: parsed.values.kcal,
      proteinG: parsed.values.protein,
    });
    if (!r.ok) return setError(r.error);
    setError(null);
    setName("");
    setKcal("");
    setProtein("");
  }

  return (
    <form
      onSubmit={submit}
      className="flex flex-col gap-3 rounded-2xl border border-neutral-200 bg-white p-4"
    >
      <h2 className="text-lg font-semibold">{NUTRITION_TEXT.quickTitle}</h2>
      <p className="text-sm text-neutral-600">{NUTRITION_TEXT.quickHint}</p>
      <div className="grid grid-cols-2 gap-3">
        <input
          aria-label="Kalorien (kcal)"
          placeholder="kcal"
          inputMode="decimal"
          value={kcal}
          onChange={(e) => setKcal(e.target.value)}
          className={inputClass}
        />
        <input
          aria-label="Eiweiß (g)"
          placeholder="Eiweiß (g)"
          inputMode="decimal"
          value={protein}
          onChange={(e) => setProtein(e.target.value)}
          className={inputClass}
        />
      </div>
      <input
        aria-label="Name (optional)"
        placeholder="Name (optional)"
        maxLength={80}
        value={name}
        onChange={(e) => setName(e.target.value)}
        className={inputClass}
      />
      <MealSelect value={meal} onChange={setMeal} />
      {error && (
        <p
          role="alert"
          className="rounded-xl bg-neutral-100 p-3 text-sm text-neutral-900"
        >
          {error}
        </p>
      )}
      <button className={buttonClass}>Eintragen</button>
    </form>
  );
}
