# Code-Landkarte

Zum Nachschlagen: Was liegt wo, und warum. Die Namen der Dateien stehen so, wie sie im Repository heißen. Jede Datei hat zusätzlich oben einen Kommentar, der dasselbe in zwei bis vier Zeilen sagt. Für die Entscheidungen dahinter: `docs/ARCHITECTURE.md`.

## Der Weg eines Eintrags (zum Beispiel ein Check-in)

1. **Eingabe**: `components/daily/checkin-card.tsx` ruft `lib/local/daily.ts`.
2. **Lokal speichern**: `lib/local/repo.ts` schreibt die Zeile in die lokale Datenbank (`lib/local/db.ts`, IndexedDB über Dexie) und legt sie gleichzeitig in die **Outbox** (die Liste „muss noch hochgeladen werden“).
3. **Anzeige**: Die App-Seiten (Heute, Training, Verlauf, Zyklus, Muster, Ernährung) lesen nur lokal und aktualisieren sich von selbst (`useLiveQuery`), auch ohne Netz.
4. **Sync**: `components/local-provider.tsx` startet regelmäßig `lib/sync/client.ts`. Das schickt die Outbox an `app/api/sync/route.ts`, das über `lib/sync/server.ts` prüft (Zod-Schemas aus `lib/sync/tables.ts`) und in Supabase schreibt. Zurück kommen geänderte Zeilen anderer Geräte.
5. **Datenbank**: `supabase/migrations/` legt Tabellen, Zeilen-Sicherheit (RLS) und Trigger fest. Selbst ein manipulierter Client kommt nicht an fremde Daten.
6. **Hinweise**: `lib/local/engine-data.ts` lädt die lokalen Daten, `lib/local/suggestions.ts` ruft die reine Engine (`lib/engine/`) und speichert die Auswahl, `components/engine/` zeigt sie an.

## `src/app/` – Seiten und Routen

Öffentlich: `page.tsx` (Landingpage mit Warteliste), `login/`, `bestaetigen/` (Bestätigung der Warteliste), `impressum/`, `datenschutz/`, `manifest.ts` (App-Manifest), `auth/callback/` (Rückkehr vom Login), `einladen/` (Einladungslink).

Angemeldet, in `(app)/`: `layout.tsx` (Kopfleiste, lokale Datenbank für die ganze App), `einladung/` (Code einlösen), `onboarding/` (Ziele, Zyklus, Basisdaten, Einwilligungen), und die eigentliche App:

| Pfad             | Inhalt                                                            |
| ---------------- | ----------------------------------------------------------------- |
| `app/`           | „Heute“: Check-in, Hinweise, Zyklus, Gewicht, Ernährung           |
| `training/`      | Übersicht, `session/` (Workout), `import/` (Hevy/Strong)          |
| `verlauf/`       | Diagramme über Wochen                                             |
| `zyklus/`        | Zyklus-Protokoll                                                  |
| `muster/`        | Muster rund um die Periode                                        |
| `ernaehrung/`    | Essen eintragen, Lebensmittel, Barcode                            |
| `einstellungen/` | Zyklus, Gewicht, Ernährung, Einwilligungen, Export, Konto löschen |
| `admin/`         | Einladungen verschicken (nur `ADMIN_EMAILS`)                      |

API-Routen: `api/sync/` (Synchronisation), `api/food/lookup/` (Barcode-Suche bei Open Food Facts), `einstellungen/export/` (Datenexport).

## `src/components/` – Oberfläche

Allgemein: `ui.tsx` (Buttons, Eingabefelder, Meldungen, Seitenrahmen), `step-form.tsx` (Formular mit Server-Aktion), `local-provider.tsx` (lokale Datenbank, Sync-Takt, Online-Status, Einstellungen als Kontext), `login-form.tsx`, `waitlist-form.tsx`, `confirm-form.tsx`, `invite-form.tsx`, `delete-account-form.tsx`, `hide-weight-form.tsx`, `logout-button.tsx`, `clear-cache-on-submit.tsx` (leert zwischengespeicherte Seiten nach Einstellungs-Änderung).

- `daily/`: `today-view.tsx` (Startseite), `checkin-card.tsx`, `scale-input.tsx` (1–5-Auswahl), `weight-card.tsx`, `cycle-card.tsx`, `cycle-view.tsx`, `overview-view.tsx` und `overview-chart.tsx` (Verlauf), `use-today.ts` (heutiger Tag, sicher beim Seitenaufbau), `use-daily-data.ts`.
- `training/`: `training-home.tsx`, `session-view.tsx` (laufendes Workout), `exercise-card.tsx` (eine Übung mit ihren Sätzen), `exercise-picker.tsx`, `rest-timer.tsx`, `import-view.tsx`, `sync-status.tsx` („Alles gesichert“).
- `engine/`: `suggestions-card.tsx` (Karte „Für dich heute“), `session-hint.tsx` (eine Zeile im Workout), `muster-view.tsx` (Seite Muster), `use-suggestions.ts` (stößt die Berechnung an).
- `nutrition/`: `nutrition-view.tsx`, `quick-add-form.tsx`, `entry-list.tsx`, `foods-list.tsx`, `food-form.tsx`, `barcode-lookup.tsx`, `barcode-scanner.tsx`, `nutrition-card.tsx`, `use-nutrition.ts`. Regel: keine Signalfarben, keine Fortschrittsbalken (ein Test prüft das).

## `src/lib/` – Logik ohne Oberfläche

**`engine/`** (reine Funktionen, ohne Datenbank und ohne React; Schwellen sind ungeprüfte Startwerte)

| Datei            | Aufgabe                                                                       |
| ---------------- | ----------------------------------------------------------------------------- |
| `index.ts`       | sammelt alle möglichen Hinweise des Tages (`buildCandidates`)                 |
| `select.ts`      | wählt aus: höchstens 2 pro Tag, Ruhezeiten, Rangfolge                         |
| `readiness.ts`   | Tagesform im Vergleich zu den eigenen letzten 4 Wochen                        |
| `plateau.ts`     | Stillstand bei einer Übung                                                    |
| `patterns.ts`    | Muster rund um die Periode (Zufallstest), dazu `rng.ts`, `sim.ts` (nur Tests) |
| `performance.ts` | Trainingsleistung relativ zum eigenen Niveau                                  |
| `safety.ts`      | Sicherheitshinweis (späte Periode plus weitere Zeichen; niedrige Zufuhr)      |
| `hunger.ts`      | Hunger-Anstieg                                                                |
| `texts.ts`       | **einziger Ort für Hinweis-Texte**, getestet gegen Verbotslisten              |

**`daily/`**: `day.ts` (Tage als `YYYY-MM-DD`), `cycle.ts` (Zykluslängen, Vorhersage, überfällig), `weight.ts` (Gewichts-Trend), `overview.ts` (Daten für den Verlauf), `chart-geometry.ts` (Zeichenhilfen für das Diagramm, getestet), `validate.ts` (erlaubte Tage), `symptoms.ts`.

**`local/`** (lokale Datenbank): `db.ts` (Schema und Versionen), `types.ts`, `repo.ts` (Schreiben + Outbox), `workouts.ts`, `templates.ts`, `prs.ts`, `daily.ts`, `nutrition.ts`, `engine-data.ts` (liest die eigenen Daten für die Engine: Übungseinheiten, Check-ins, Zyklus, Gewicht, Essen; prüft per Signatur, ob sich etwas geändert hat), `suggestions.ts` (Engine anwenden und die Hinweise speichern), `overview-data.ts`, `wipe.ts` (alles lokal löschen beim Abmelden).

**`sync/`**: `tables.ts` (Tabellenliste und erlaubte Felder), `client.ts` (Gerät), `server.ts` (Prüfung und Speichern), `supabase-db.ts` (Anbindung an Supabase).

**`nutrition/`**: `calc.ts` (Mengen umrechnen, Summen), `parse.ts` (Zahleneingabe), `texts.ts` (Texte, getestet), `barcode.ts`, `off.ts` (Open-Food-Facts-Daten bereinigen), `off-fetch.ts` (Abruf), `lookup-handler.ts` (Ablauf der Server-Route).

**Weitere**: `workout/` (PR, Statistik, Einheiten), `exercises/` (Übungskatalog, Namenssuche), `import/` (Hevy/Strong lesen), `onboarding/`, `waitlist/`, `invites/`, `auth/` (Zugriffsprüfung, Admin, sichere Weiterleitung), `supabase/` (Clients, Cookie-Härtung), `ids.ts` (stabile IDs), `math.ts` (Median, Runden; der Zyklus rundet Median-Tage zusätzlich, siehe `daily/cycle.ts`), `hooks.ts` (Überschriften-Varianten der Landingpage).

## Weitere Ordner

- `supabase/migrations/`: Datenbank in Reihenfolge, nur anhängend. `supabase/queries/`: Auswertung für die Beta.
- `src/db-tests/`: Datenbank-Regeln gegen ein eingebettetes Postgres (läuft ohne echtes Supabase).
- `public/`: Service Worker `sw.js` (Offline-Seiten), Icons. `scripts/`: Hilfsskripte für den Build.
- `src/proxy.ts`: läuft vor jeder Seite, erneuert die Anmeldung und leitet nicht angemeldete Besucher um.
- `docs/`: Plan, Architektur, Setup, Beta, Backlog, Auswertung, Interviews, Lizenzen.
