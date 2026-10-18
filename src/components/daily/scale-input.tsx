"use client";

interface Props {
  label: string;
  low: string;
  high: string;
  value: number | null;
  onChange: (value: number | null) => void;
}

// Five tap targets; tapping the selected value again clears it. Saved immediately by the caller.
export function ScaleInput({ label, low, high, value, onChange }: Props) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-col gap-1">
      <div className="flex items-baseline justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="text-xs text-neutral-500">
          {low} – {high}
        </span>
      </div>
      <div className="grid grid-cols-5 gap-2">
        {[1, 2, 3, 4, 5].map((n) => {
          const selected = value === n;
          return (
            <button
              key={n}
              type="button"
              role="radio"
              aria-checked={selected}
              aria-label={`${label}: ${n} von 5`}
              onClick={() => onChange(selected ? null : n)}
              className={`h-11 rounded-xl border text-base font-medium ${
                selected
                  ? "border-rose-600 bg-rose-600 text-white"
                  : "border-neutral-300 bg-white text-neutral-800"
              }`}
            >
              {n}
            </button>
          );
        })}
      </div>
    </div>
  );
}
