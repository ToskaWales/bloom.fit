// Landing-page headline copy for the pre-launch A/B/C test (Phase 0). Pure data
// plus a tiny parser; the page rendering lives in src/app/(marketing) and the
// variant is persisted with each signup by src/lib/waitlist (HookVariant).
import type { HookVariant } from "@/lib/waitlist/types";

// Landing-page headline variants for the pre-launch A/B/C test.
// Variant is chosen via ?h=a|b|c (flyer/ad links) and stored with each signup.
export const HOOKS: Record<HookVariant, string> = {
  a: "Einige Wochen hebst du PBs. Andere fühlst du dich wie ein Anfänger. Bloom zeigt dir, warum.",
  b: "Hevy. Yazio. Und trotzdem das Gefühl, dass dir die Hälfte fehlt.",
  c: "Dein Trainingsplan kennt deinen Zyklus nicht. Bloom lernt ihn kennen.",
};

// Turns the raw ?h= query value into a known variant. Anything unknown or missing
// falls back to "a", so a mistyped flyer link still shows a headline.
export function pickVariant(value: string | string[] | undefined): HookVariant {
  const v = Array.isArray(value) ? value[0] : value;
  return v === "b" || v === "c" ? v : "a";
}
