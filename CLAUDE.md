# Bloom – Projektkontext für Claude Code

## Was ist Bloom

Trainings- und Ernährungs-App für ernsthafte Kraftsportlerinnen im DACH-Raum.
Passt Trainingsvorgaben an die eigenen geloggten Daten über den Zyklus an –
nicht an einen starren Phasenkalender. Siehe PRD für Details. Roadmap: `TODO.md`.

## Tech-Stack

- React Native + Expo (SDK 57), TypeScript, **Expo Router** für Navigation
- Supabase (Postgres, Auth), Projekt in EU-Region
- Zustand für State Management
- Zyklus-Sync optional: Apple HealthKit (iOS) / **Android Health Connect** (Google Fit ist abgekündigt)

## Ordnerstruktur

- `src/app/` – **nur dünne Expo-Router-Routen**, die Screens aus `src/screens` re-exportieren
- `src/screens/<Name>/index.tsx`, `src/components`, `src/engine`, `src/api`, `src/store`, `src/navigation`, `src/i18n`, `src/lib` (reine Helfer: Datum, Validierung)
- Import-Alias: `@/` → `src/`

## Wichtige Regeln

- Zyklus-Phasen-Texte NIE als universelle Aussage formulieren
  ("in der Follikelphase ist X optimal" ist verboten).
  Immer individuell: "deine Daten zeigen...", "viele Frauen bemerken..."
- Verboten außerdem: "Cycle Syncing", "science-backed" ohne konkreten Beleg,
  "du brauchst X extra Kalorien". Bevorzugt: "zyklusbewusst", "passt sich deinem Zyklus an".
- Alle UI-Texte stehen in `src/i18n/de.ts`; `copyLint.test.ts` prüft sie gegen `forbiddenPhrases.ts`.
- Die Adaptive Engine passt Trainingsvorgaben NUR auf Basis der eigenen
  historischen Daten der Nutzerin an, nie auf Basis eines allgemeinen Phasen-Modells.
- Kein Feature, das wie Gamification wirkt (Badges, Zwangs-Streaks).
- Keine aggressiven Paywalls oder Upsell-Pop-ups.
- Entscheidungen stehen in `docs/ENTSCHEIDUNGEN.md` (verbindlich).
- Training-Logging ist offline-first (lokale Queue, Sync später).
- Gesundheitsdaten: nur mit ausdrücklicher Einwilligung, RLS auf jeder Tabelle, keine Secrets im Repo.

## Konventionen

- Komponenten: PascalCase, ein File pro Komponente
- Screens liegen in eigenen Ordnern mit index.tsx
- Kommentare auf Deutsch für Produktlogik, Code selbst auf Englisch
- Neue Dependencies mit `npx expo install`; npm läuft mit `legacy-peer-deps` (siehe `.npmrc`)
- Vor jedem Commit: `npm run check` (Lint, Typecheck, Tests) und `npm run format`
- Plan Mode bei Datenmodell, Adaptive Engine, Navigation/Auth
