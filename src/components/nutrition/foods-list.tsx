"use client";

import { useState } from "react";
import { FoodForm } from "@/components/nutrition/food-form";
import { MealSelect } from "@/components/nutrition/quick-add-form";
import { useFoods } from "@/components/nutrition/use-nutrition";
import { useLocal } from "@/components/local-provider";
import { inputClass, secondaryButtonClass } from "@/components/ui";
import { addFoodEntry, deleteFood, setFavorite } from "@/lib/local/nutrition";
import type { FoodRow, Meal } from "@/lib/local/types";
import { NUTRITION_TEXT } from "@/lib/nutrition/texts";

const detail = (f: FoodRow) =>
  `${f.kcal !== null ? `${Math.round(f.kcal)} kcal` : ""}${f.kcal !== null && f.protein_g !== null ? " · " : ""}${f.protein_g !== null ? `${f.protein_g.toLocaleString("de-DE")} g Eiweiß` : ""} ${f.basis === "100g" ? "pro 100 g" : `pro Portion (${f.portion_g} g)`}`;

export function FoodsList({ day }: { day: string }) {
  const { db } = useLocal();
  const foods = useFoods();
  const [adding, setAdding] = useState(false);
  const [open, setOpen] = useState<string | null>(null);
  const [amount, setAmount] = useState("");
  const [meal, setMeal] = useState<Meal | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function log(food: FoodRow) {
    if (!db) return;
    const n = Number(amount.replace(",", "."));
    const r = await addFoodEntry(
      db,
      food,
      food.basis === "100g" ? { grams: n } : { portions: n },
      { day, meal },
    );
    if (!r.ok) return setError(r.error);
    setError(null);
    setOpen(null);
    setAmount("");
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="foods-title">
      <h2 id="foods-title" className="text-lg font-semibold">
        {NUTRITION_TEXT.foodsTitle}
      </h2>
      {foods?.length === 0 && !adding && (
        <p className="text-sm text-neutral-700">{NUTRITION_TEXT.foodsEmpty}</p>
      )}
      <ul className="flex flex-col gap-2">
        {(foods ?? []).map((f) => (
          <li
            key={f.id}
            className="rounded-xl border border-neutral-200 bg-white p-3 text-sm"
          >
            <div className="flex items-center justify-between gap-2">
              <span>
                <span className="font-medium">{f.name}</span>
                <span className="block text-neutral-600">{detail(f)}</span>
              </span>
              <span className="flex gap-2">
                <button
                  aria-pressed={f.favorite}
                  aria-label={`${f.name} ${f.favorite ? "aus Favoriten entfernen" : "zu Favoriten"}`}
                  onClick={() =>
                    db &&
                    void setFavorite(db, f.id, !f.favorite).catch(() => {})
                  }
                  className="rounded-lg border border-neutral-300 px-3 py-1.5"
                >
                  {f.favorite ? "★" : "☆"}
                </button>
                <button
                  onClick={() => {
                    setOpen(open === f.id ? null : f.id);
                    setAmount(f.basis === "portion" ? "1" : "");
                    setError(null);
                  }}
                  className="rounded-lg border border-neutral-300 px-3 py-1.5"
                >
                  Eintragen
                </button>
              </span>
            </div>
            {open === f.id && (
              <div className="mt-3 flex flex-col gap-2">
                <input
                  aria-label={
                    f.basis === "100g" ? "Menge in Gramm" : "Anzahl Portionen"
                  }
                  placeholder={f.basis === "100g" ? "Gramm" : "Portionen"}
                  inputMode="decimal"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  className={inputClass}
                />
                <MealSelect value={meal} onChange={setMeal} />
                {error && (
                  <p
                    role="alert"
                    className="rounded-xl bg-neutral-100 p-3 text-neutral-900"
                  >
                    {error}
                  </p>
                )}
                <div className="flex gap-2">
                  <button
                    onClick={() => void log(f)}
                    className={secondaryButtonClass}
                  >
                    Hinzufügen
                  </button>
                  <button
                    onClick={() =>
                      db && void deleteFood(db, f.id).catch(() => {})
                    }
                    className={secondaryButtonClass}
                  >
                    Lebensmittel löschen
                  </button>
                </div>
              </div>
            )}
          </li>
        ))}
      </ul>
      {adding ? (
        <FoodForm onSaved={() => setAdding(false)} />
      ) : (
        <button
          onClick={() => setAdding(true)}
          className={secondaryButtonClass}
        >
          Lebensmittel hinzufügen
        </button>
      )}
    </section>
  );
}
