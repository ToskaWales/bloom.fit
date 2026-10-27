# Bloom

Trainings- und Ernährungs-App für Frauen, die ernsthaft Krafttraining machen (DACH). Training, Check-ins, Zyklus und Ernährung werden **offline-first** auf dem Gerät gespeichert; Hinweise entstehen aus den **eigenen Daten** der Nutzerin, nicht aus einem festen Phasenkalender. Stand: Validierungsphase (Details: `CLAUDE.md`).

## Schnellstart (lokal)

```bash
npm install
cp .env.example .env.local   # Werte eintragen, siehe docs/SETUP.md
npm run dev                  # http://localhost:3000
```

| Befehl              | Zweck                                                |
| ------------------- | ---------------------------------------------------- |
| `npm run dev`       | Entwicklungsserver                                   |
| `npm test`          | alle Tests (Logik, Datenbank-Regeln, lokale Schicht) |
| `npm run typecheck` | Typen prüfen                                         |
| `npm run lint`      | Lint                                                 |
| `npm run build`     | Produktions-Build (kopiert vorher die Scanner-Datei) |

Einmalige Einrichtung (Supabase, Login-Mail, Hosting, Migrationen): `docs/SETUP.md`. Test mit echten Nutzerinnen: `docs/BETA.md`.

## Wie die App aufgebaut ist

- **Next.js 16 (App Router) + TypeScript**, Oberfläche auf Deutsch, Code und Kommentare auf Englisch.
- **Supabase (EU)**: Postgres mit Zeilen-Sicherheit (RLS), Login per E-Mail-Code (optional Google/Apple), Einladungspflicht.
- **Offline-first**: Alles Tägliche (Training, Check-in, Ernährung) wird zuerst in der lokalen Datenbank (Dexie/IndexedDB) gespeichert und im Hintergrund synchronisiert. Die App-Seiten (Training, Heute, Verlauf, Zyklus, Muster, Ernährung) lesen nur lokal.
- **Anpassungs-Engine**: reine Funktionen, die auf dem Gerät aus den eigenen Daten Hinweise berechnen (Bereitschaft, Plateau, Muster rund um die Periode, Sicherheitshinweis, Hunger). Keine externe KI.

Das ausführliche Bild steht in `docs/ARCHITECTURE.md`, jeder Ordner und die wichtigsten Dateien in `docs/CODEMAP.md`. Jede Quelldatei beginnt mit einem Kommentar, der sagt, wofür sie da ist und was nicht in sie gehört.

## Wo finde ich was?

| Ich will …                                        | Dann in …                                            |
| ------------------------------------------------- | ---------------------------------------------------- |
| einen Text oder eine Schwelle der Hinweise ändern | `src/lib/engine/` (Texte nur in `texts.ts`)          |
| eine Seite oder ein Formular ändern               | `src/app/` (Seite) und `src/components/` (Inhalt)    |
| ändern, wie etwas gespeichert/synchronisiert wird | `src/lib/local/` und `src/lib/sync/`                 |
| eine Datenbank-Regel ändern                       | neue Datei in `supabase/migrations/` (nie eine alte) |
| verstehen, warum etwas so entschieden wurde       | `docs/ARCHITECTURE.md`, `docs/PLAN.md`               |
| Offenes und Geplantes                             | `docs/BACKLOG.md`                                    |

## Spielregeln (kurz)

- Produkt- und Textleitplanken stehen in `CLAUDE.md` und sind **verbindlich** (keine Phasen-Versprechen, keine Kalorienvorgaben, keine Bewertungen). Tests prüfen sie.
- Migrationen sind **nur anhängend**: Einmal eingespielt, wird eine Datei nie mehr geändert. Änderungen kommen als neue Datei.
- Arbeitsweise: Plan → Tests zuerst → Umsetzung → Review (`docs/PLAN.md`).
