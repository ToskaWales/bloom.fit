"use client";

// Settings page (/einstellungen): the opt-out switch that hides all weight features.
// Saves via the setHideWeight server action; the setting reaches the app through LocalProvider (hideWeight).
// Neighbours: clear-cache-on-submit.tsx (same cache reason), daily/weight-card.tsx and daily/overview-view.tsx (honour it).

import { setHideWeight } from "@/app/(app)/einstellungen/actions";
import { secondaryButtonClass } from "@/components/ui";
import { clearPageCache } from "@/lib/local/wipe";

// After the switch, drop cached pages: they carry the old setting and would
// still show weight when opened offline.
export function HideWeightForm({ initial }: { initial: boolean }) {
  return (
    <form
      action={async (formData) => {
        await setHideWeight(formData);
        await clearPageCache().catch(() => {});
      }}
      className="flex flex-col gap-3"
    >
      <label className="flex items-start gap-2 rounded-xl border border-neutral-200 bg-white p-3 text-sm font-normal">
        <input
          type="checkbox"
          name="hideWeight"
          value="on"
          defaultChecked={initial}
          className="mt-1"
        />
        <span>
          Gewicht ausblenden: keine Eingabe, kein Trend und keine Gewichtskurve
          in Bloom. Bereits gespeicherte Werte bleiben erhalten und sind
          weiterhin im Datenexport enthalten.
        </span>
      </label>
      <button className={secondaryButtonClass}>Speichern</button>
    </form>
  );
}
