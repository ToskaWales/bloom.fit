# Bloom – Architektur-Entwurf (Phase 0)

Status: Entwurf zur Review vor Phase 1. Stack: Next.js (App Router, PWA) · TypeScript strict · Supabase (EU, Postgres/Auth/RLS).

## Leitprinzipien

1. **Offline-first**: Logging im Gym funktioniert ohne Netz; der Server ist Sync-Ziel, nicht Voraussetzung.
2. **Zuverlässigkeit vor Features**: kein Datenverlust (Konkurrenz-Schwachstelle), idempotente Sync-Operationen, Export von Tag 1.
3. **Engine = reine Funktionen**: keine I/O, keine Framework-Imports, voll unit-testbar und erklärbar.
4. **Privacy by design**: Gesundheitsdaten (DSGVO Art. 9) – Einwilligung, EU-Region, Export/Löschung, keine Gesundheitsdaten in Logs/Analytics.
5. **Phase ist nur ein Input**: Zyklusinformation trägt immer ihre Unsicherheit mit.

## Module

```
src/
  app/(marketing)   Landingpage, Rechtstexte        (Phase 0)
  app/(app)         eingeloggte PWA                  (Phase 1)
  lib/engine/       reine Adaptions-Logik            (Phase 1)
  lib/sync/         Outbox, Pull/Push, Konflikte     (Phase 1)
  lib/waitlist/     Warteliste (fertig)              (Phase 0)
supabase/migrations/  SQL, versioniert
```

## Datenmodell (Phase 1, Entwurf)

Alle Tabellen: `id uuid` (client-generiert → idempotent), `user_id`, `created_at`, `updated_at`, `deleted_at` (Soft-Delete für Sync).

| Tabelle                    | Inhalt                                                                                                                                    |
| -------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                 | Ziel (Muskelaufbau/Recomp/Kraft), Einheiten, Zyklus-Modus (`natural` / `hormonal` / `irregular` / `none`), Einwilligungen mit Zeitstempel |
| `cycle_events`             | `period_start`, `period_end`, optional `ovulation_test_positive`, Quelle (manuell/Test)                                                   |
| `exercises`                | Katalog + eigene Übungen                                                                                                                  |
| `workouts`, `workout_sets` | Session, Satz (Gewicht, Wdh., RPE, Notiz), optionaler Plan-Bezug                                                                          |
| `plans`, `plan_days`       | Vorlagen/Programme                                                                                                                        |
| `checkins`                 | pro Tag: Schlaf, Energie, Motivation, Symptome (Skala 1–5 + Tags)                                                                         |
| `bodyweight_entries`       | Gewicht, Zeitpunkt                                                                                                                        |
| `foods`, `food_logs`       | Nahrungsmittel (OFF-Cache + eigene), Mahlzeiten-Logs, Makros                                                                              |
| `suggestions`              | von der Engine erzeugte Vorschläge inkl. Begründung, Nutzerinnen-Reaktion (angenommen/abgelehnt)                                          |
| `consents`                 | Art, Version, Zeitpunkt, Widerruf                                                                                                         |

**RLS**: jede Tabelle `user_id = auth.uid()` für select/insert/update/delete; Katalogtabellen read-only. Tests für RLS gehören in die CI (pgTAP oder Integrationstests gegen lokale Supabase).

## Offline-Sync

- Lokal: IndexedDB (z. B. Dexie), identisches Schema wie Server.
- Schreiben: immer lokal + Eintrag in **Outbox**; UI reagiert sofort.
- Push: Outbox in Batches an eine Sync-Route, serverseitig `upsert` per `id` (idempotent), Antwort mit serverseitigem `updated_at`.
- Pull: `updated_at > last_sync_cursor` pro Tabelle.
- Konflikte: Last-Write-Wins pro Datensatz; Sätze sind klein genug, dass Konflikte selten und harmlos sind. Löschen = `deleted_at`.
- Service Worker: App-Shell cachen (Phase 1); Hintergrund-Sync, wo der Browser es erlaubt, sonst Sync beim Öffnen.
- **Offene Frage**: iOS-Safari-Grenzen (IndexedDB-Eviction, Push). Frühe Prüfung im Phase-1-Spike.

## Adaptions-Engine (reine Funktionen)

Eingänge: Check-ins, Sätze (Last, Wdh., RPE), Gewichtstrend, Zyklusereignisse, Nutzerinnen-Reaktionen auf frühere Vorschläge. Ausgänge: `Suggestion { kind, text, because[], confidence, dismissible }`.

1. **Tages-Readiness (ab Tag 1)**: gewichteter Wert aus Schlaf/Energie/Motivation relativ zur _eigenen_ Baseline (gleitendes Mittel) → Vorschlag, Volumen/Intensität heute halten, leicht senken oder steigern (RPE-basiert, Autoregulation).
2. **Zyklusschätzung mit Unsicherheit**: Phase als Wahrscheinlichkeit/Spanne aus bisherigen Zyklen; bei Pille/unregelmäßig/keine Angabe → _kein_ Phasen-Input.
3. **Mustererkennung (ab ~2 Zyklen und Mindestzahl an Beobachtungen)**: vergleicht eigene Leistung/Befinden je Zyklusabschnitt mit der eigenen Gesamtbaseline; meldet nur Abweichungen oberhalb eines Rauschschwellenwerts; sonst „Daten reichen noch nicht / bei dir zeigt sich bisher kein klares Muster“ (unterstützt „Durchziehen“-Typ).
4. **Ernährungsvorschläge (weich)**: Hunger-Check-in + Gewichtstrend + Leistung → optionaler Hinweis, keine pauschale Phasen-kcal-Zahl. Sicherheitsgrenzen: keine Defizit-Empfehlung bei Anzeichen niedriger Energieverfügbarkeit (ausbleibende Periode, starker Leistungsabfall) → Hinweis auf ärztliche Abklärung.
5. **Erklärbarkeit**: jeder Vorschlag nennt die verwendeten Daten (`because`), ist ablehnbar; Reaktionen fließen in künftige Vorschläge ein.
6. **Test-Strategie**: Property-/Szenario-Tests mit synthetischen Verläufen (regelmäßig, unregelmäßig, kein Effekt, starker Effekt) und Snapshot der Begründungstexte gegen die Verbotsliste in `CLAUDE.md`.

## Datenschutz & Sicherheit

- Supabase-Projekt in der EU; Auth per E-Mail/Magic-Link (+ optional Apple/Google später).
- Service-Role-Key nur serverseitig; Client nutzt Anon-Key + RLS.
- Einwilligung für Gesundheitsdaten explizit und versioniert (`consents`), widerrufbar.
- Export (JSON/CSV) und Konto-Löschung (Kaskade) als Kernfunktion, nicht Nachgedanke.
- Keine Gesundheitsdaten in Server-Logs, Fehlertracking oder Analytics; Fehlertracking mit Scrubbing.
- Rate-Limiting auf Auth- und Sync-Routen; Eingabevalidierung (Zod) an jeder Server-Grenze.
- Wartelisten-Mails: Double-Opt-in, Tokens nur gehasht gespeichert, Antwort verrät nicht, ob eine Adresse existiert.

## Entscheidungen (ADR-Kurzform)

| #   | Entscheidung                                | Grund                                       | Alternative                    |
| --- | ------------------------------------------- | ------------------------------------------- | ------------------------------ |
| 1   | PWA statt nativ                             | ein Codebase, Test ohne App-Store-Review    | Expo, später Capacitor-Wrapper |
| 2   | Supabase EU                                 | Postgres + Auth + RLS, schnell, DSGVO-Story | eigener Node/Postgres          |
| 3   | Offline-first mit Outbox                    | Gym ohne Netz, Datenverlust vermeiden       | Online-only                    |
| 4   | Regelbasierte, erklärbare Engine v1         | zu wenig Daten für ML, Glaubwürdigkeit      | ML/LLM-Empfehlungen            |
| 5   | Zyklus-Phase nur als Input mit Unsicherheit | Evidenzlage (McNulty 2020 u. a.)            | Fester Phasenkalender          |
| 6   | Hook-Variante per URL-Parameter (`?h=`)     | einfach, Kanal-zuordenbar                   | zufällige Zuweisung (später)   |

## Offene Punkte

- Lebensmitteldatenbank: Open Food Facts reicht für Packungsware, wie sieht es bei Frischware/Gerichten aus (BLS)? Lizenz prüfen.
- Zahlung: Stripe (SEPA, Karte, Apple/Google Pay) – ab Beta.
- Push-Benachrichtigungen auf iOS-PWA: Verfügbarkeit/Zuverlässigkeit prüfen.
