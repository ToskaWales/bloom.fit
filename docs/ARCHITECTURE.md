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

## Anpassungs-Engine (Stand 1d-2)

Läuft ausschließlich auf dem Gerät (`src/lib/engine`, reine Funktionen, keine externe KI).

- **Bereitschaft** (`readiness.ts`): Check-in von heute gegen den Median der eigenen letzten 28 Tage (mind. 7 Werte je Größe, mind. 2 Größen). Abstand ≤ −0,8 → „etwas leichter“, ≥ +0,8 → „besser als sonst“, sonst „wie gewohnt“. Nie gegen eine absolute Skala.
- **Plateau** (`plateau.ts`): vier jüngste Einheiten (alle in 8 Wochen) ohne mehr als 1 % besseres geschätztes 1RM als alles davor, mind. 2 frühere Einheiten.
- **Muster rund um die Periode** (`patterns.ts`): pro Zyklus die 4 Tage vor der Periode und die ersten 3 Tage der Periode gegen die übrigen Tage, für Energie, Motivation, Schlaf, Hunger und Trainingsleistung (`performance.ts`: geschätztes 1RM relativ zum eigenen üblichen Niveau). Ein Muster erscheint nur bei: mind. 2 Zyklen mit genug Einträgen, spürbarer Mittelwertdifferenz (0,7 Skalenpunkte bzw. 4 %), gleicher Richtung in jedem Zyklus und Permutationstest mit α = 0,005 (Bonferroni über 10 Vergleiche). Zyklen über 45 Tage zählen nicht (vermutlich vergessener Eintrag). Auswertung der Fehlalarm- und Erkennungsrate: `docs/ENGINE-EVALUATION.md`. „Kein klares Muster“ ist ein gleichwertiges Ergebnis (Seite `/muster`).
- **Sicherheitsregel** (`safety.ts`): Periode deutlich überfällig (mind. 7 Tage über dem üblichen Fenster) UND (Energie über 14 Tage meist niedrig ODER Gewichtstrend deutlich gefallen). Gewicht wird nie gelesen, wenn es ausgeblendet ist. Folge: ruhiger Hinweis „sprich mit einer Ärztin oder einem Arzt“, keine Steigerungs-, Plateau- oder Musterhinweise, kein „eine Wiederholung mehr“.
- **Auswahl** (`select.ts`): höchstens 2 Hinweise pro Tag, Priorität Sicherheit > Bereitschaft > Muster > Plateau. Abgelehnte Art 14 Tage ruhig; Plateau je Übung höchstens alle 14 Tage, Muster je Befund alle 28 Tage, höchstens eines je Art und Tag; Sicherheitshinweise werden nie durch Ablehnung stummgeschaltet (nur „Habe ich gelesen“ ruht 7 Tage).
- **Texte** (`texts.ts`): einziger Ort für Formulierungen. Ein Test prüft jeden möglichen Satz gegen die Verbotsliste aus `CLAUDE.md`. In der Datenbank liegen nur Art, Tag, Zahlen und Reaktion (`suggestions`).
- **Schreiben** (`src/lib/local/suggestions.ts`): idempotent (Id aus Tag+Art+Gegenstand), Reaktionen werden nie überschrieben, Aufrufe werden pro Datenbank serialisiert.
- Alle Schwellen sind begründete Startwerte, keine bewiesenen Grenzen. Sie sollen mit echten Daten und einer sportwissenschaftlichen Prüfung überarbeitet werden.

Nur Art, Gegenstand, wenige Zahlen und Reaktion werden gespeichert; die Zahlen unter „Warum sehe ich das?“ für Bereitschaft werden lokal neu berechnet. Eine Reaktion kann serverseitig nicht auf „shown“ zurückgesetzt werden (Trigger `suggestions_keep_reaction`).

Noch offen: Kalorien-/Protein-Anpassungen gibt es bewusst nicht; frühestens nach der Validierung und nur als weiche Option.

## Ernährung (Stand N-1)

Optional und standardmäßig aus (`profiles.nutrition_mode`: `off`, `log`, `log_no_totals`). Einschalten braucht eine eigene Einwilligung (`consents.kind = 'nutrition'`). Die Datenbank erzwingt sie auch auf den Datentabellen (Schreiben ohne aktive Einwilligung wird abgelehnt, Soft-Delete geht immer). Widerruf schaltet aus, löscht Einträge, Lebensmittel und aus der Zufuhr abgeleitete Hinweise (endgültig nach der Aufbewahrungsfrist der Aufräumfunktion), und jedes Gerät löscht seine lokale Kopie beim nächsten Sync. Bei `off` gibt es keine Karte, keinen Menüpunkt, und die Engine liest keine Essensdaten.

- **Daten** (`foods`, `food_logs`, Migration `20261109`): pro Nutzerin, gleiche Sync-/RLS-Muster wie die übrigen Tabellen. Jeder Eintrag kopiert die Werte (Snapshot), damit Verlauf und Export ein gelöschtes Lebensmittel überleben. Pflicht ist nur kcal oder Eiweiß, Kohlenhydrate und Fett sind optional.
- **Logik** (`src/lib/nutrition/calc.ts`, `src/lib/local/nutrition.ts`): nichts wird geschätzt; Grenzen sind in Zod, SQL-Checks und Eingabeprüfung gleich.
- **Darstellung**: eine neutrale Zeile „Heute eingetragen: …“ (ausblendbar), kein Ring, kein Balken, keine Farbe, kein Ziel, kein Vergleich. `src/lib/nutrition/texts.test.ts` prüft alle Texte und dass die Komponenten keine Signalfarben oder Fortschrittsanzeigen nutzen.
- **Sicherheit** (`safety.ts`): „wenig eingetragen“ (Median unter 1200 kcal an mind. 7 sorgfältig geloggten Tagen der letzten 14, mind. 2 Einträge pro Tag) ist ein weiteres Signal neben der überfälligen Periode. Ohne Periodensignal (Pille, keine Angabe) gibt es denselben ruhigen Hinweis (`subject = energy`) bei niedriger Zufuhr, niedriger Energie und mind. 6 Trainingstagen in 14 Tagen. Der Schwellenwert ist ein interner Startwert ohne Anzeige und braucht eine fachliche Prüfung.

Bekannt: Zwischengespeicherte Seiten tragen den Schalter; auf einem zweiten Gerät kann offline kurz der alte Stand erscheinen, die Datenbank lässt in dieser Zeit aber nichts mehr speichern.

Noch offen: N-2 (Barcode, Open Food Facts über eigene Server-Route), N-3 (weiche Hunger-Hinweise).

### Barcode und Open Food Facts (Stand N-2)

- **Route** `POST /api/food/lookup` (POST, damit der Barcode in keiner URL und keinem Zugriffslog steht): Login, Prüfziffer (GS1), dann `consume_food_lookup()` in der Datenbank. Sie erlaubt nur mit Zugang, eingeschalteter Ernährung und aktiver Einwilligung und zählt pro Nutzerin (20 je 10 Minuten, 100 je Tag; Tabelle `food_lookup_quota`, speichert keinen Barcode). Erst danach geht eine Anfrage an Open Food Facts.
- **Abruf** (`off-fetch.ts`): feste Adresse, nur geprüfte Ziffern im Pfad, keine Cookies oder Client-Header, eigener User-Agent, `redirect: "error"`, Timeout 4 s, höchstens 200 KB. Fehler werden zu ruhigen Meldungen; der Barcode wird nie geloggt.
- **Bereinigung** (`off.ts`): nur Werte pro 100 g (kJ wird umgerechnet), fehlende bleiben leer, unplausible werden verworfen, Namen werden von Steuerzeichen befreit und gekürzt. Nicht übernommen werden Bilder, Nutri-Score, NOVA, Eco-Score.
- **Speichern:** Das Ergebnis erscheint als vorausgefülltes, änderbares Formular und wird als eigenes Lebensmittel (`source = 'off'`) gespeichert, danach offline nutzbar. Vor jeder Abfrage wird lokal nach dem Barcode gesucht. Ohne Netz: „Gerade offline, trag es kurz von Hand ein.“
- **Barcode-Eindeutigkeit:** Migration `20261110` ersetzt den Unique-Index durch einen normalen Index. Doppelte Lebensmittel sind harmlos (Einträge tragen eigene Werte) und blockieren keinen Sync mehr.
- **Scanner:** der Detektor des Browsers (Chrome Android), sonst `barcode-detector` (MIT, zxing-cpp/Apache-2.0) per dynamischem Import, die WebAssembly-Datei kommt aus `/vendor/` der eigenen Domain (Kopie per `scripts/copy-zxing-wasm.mjs` vor Build und Dev, nicht im Repository). Die Kamera startet erst nach einem Tipp, stoppt beim Schließen und beim Verlassen der App, kein Bild wird gespeichert oder gesendet. Das Ziffernfeld ist immer verfügbar. Header `Permissions-Policy: camera=(self)`. Eine spätere CSP braucht `'wasm-unsafe-eval'`.
- **Lizenz:** „Daten: Open Food Facts (ODbL)“ in der Oberfläche, im Export (`attribution`) und in der Datenschutzerklärung. Bloom veröffentlicht keine abgeleitete Datenbank.

Barcodes werden einheitlich als 13-stellige Form gespeichert und gesucht (UPC-A, EAN-13 und GTIN-14 mit führenden Nullen sind dasselbe Produkt). Der Server liest den Request-Body nur bis 1000 Bytes und verlangt `content-length`.

Bekannt: Es gibt noch keine Content-Security-Policy. Eine spätere CSP braucht `connect-src 'self' <Supabase>`, `script-src 'self' 'wasm-unsafe-eval'` und `frame-ancestors 'none'`; sie würde auch absichern, dass der Scanner seine WebAssembly-Datei nie von einem fremden CDN lädt (heute nur durch die Überschreibung in `barcode-scanner.tsx`). Ohne Netz startet der Scanner nur, wenn der Browser einen eigenen Barcode-Leser hat; die Ziffern-Eingabe geht immer.

### Hunger-Hinweis (Stand N-3)

`hunger.ts`: Der Median ihrer Hunger-Einträge der letzten 7 Tage (mind. 4 Werte) liegt mindestens 1 Punkt über ihrem Median der 4 Wochen davor (mind. 10 Werte), und sie hat in 14 Tagen an mindestens 4 Tagen trainiert. Startwerte, nicht belegt. Optional kommt eine „weil“-Zeile dazu, wenn die Trainingsleistung der letzten zwei Wochen mindestens 4 % unter ihrem üblichen Niveau liegt. Gewicht und Ernährungs-Einträge werden dafür nie gelesen, es gilt für alle Zyklus-Modi und ohne Ernährungs-Logging.

- Der Text beobachtet („Hunger ist ein Signal, kein Fehler“) und bietet nur weich an („Wenn du magst, kannst du an Trainingstagen etwas mehr oder öfter essen“), nie eine Zahl, nie „weniger“. Tests verbieten „weniger“, „Eiweiß“ und Zahlen mit kcal/g in allen Engine-Texten.
- Höchstens alle 28 Tage, egal wie sie reagiert; Rang unter Bereitschaft, Muster und Plateau; bei aktivem Sicherheitshinweis nie. Gibt es ein gefundenes Hunger-Muster rund um die Periode, entfällt dieser Hinweis (das Muster sagt es schon und trägt denselben weichen Satz bei steigendem Hunger).
- Gespeichert werden nur `recent`, `before`, `trainingDays` und ggf. `perfDrop`.
