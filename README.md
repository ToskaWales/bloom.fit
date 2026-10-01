# Bloom

Trainings- und Ernährungs-App für Kraftsportlerinnen, die sich an den eigenen Zyklusdaten orientiert.

## Entwicklung

```bash
npm install
cp .env.example .env   # Supabase URL + anon key eintragen
npm start
npm run check          # Lint, Typecheck, Tests
```

HealthKit/Health Connect benötigen später einen Expo Dev Build (kein Expo Go).

## Datenbank

Migrationen liegen in `supabase/migrations/` (Frankfurt-Projekt per SQL Editor oder `supabase db push` einspielen).
`npm run test:db` wendet sie auf eine frische lokale Postgres-DB an und führt die RLS-Tests aus
(libpq-Variablen wie `PGUSER` setzen; Superuser nötig). Die Edge Function `delete-account` wird mit
`supabase functions deploy delete-account` ausgerollt.
