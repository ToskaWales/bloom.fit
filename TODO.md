# Bloom – Roadmap & To-do

Stand: 2026-10-01 · Legende: `[ ]` offen · `[x]` erledigt · 🔴 blockiert andere Punkte · ⚠️ Risiko

Ziel (aus PRD): Bestätigen, dass ernsthafte Gym-Frauen im DACH-Raum für eine zyklus-adaptive Trainings- und Ernährungs-App zahlen (Schwelle: 20–30 zahlende Vorbesteller:innen).
Leitprinzip: **Kleinster Build, der die Kernschleife beweist** – Loggen → Check-in → Muster → Insight → Anpassung.

---

## Phase 0 – Klärung & Entscheidungen (vor dem ersten Code) 🔴

Beim Lesen der vier Dokumente sind Widersprüche/Lücken aufgefallen. Diese zuerst klären, sonst wird später teuer umgebaut.

- [x] Alle vier Dokumente gelesen (PRD, Architektur, Prompt-Bibliothek, Projektnotizen)
- [x] 🔴 **Widerspruch Projektstand:** Notizen sagen „Functioning app with all core features built", Repo ist leer, PRD/Prompt-Bibliothek gehen von Greenfield aus → klären, ob es existierenden Code/Prototyp gibt (anderes Repo?) oder ob die Notiz veraltet ist
- [x] 🔴 **Scope Ernährung-Adaption:** Notizen/Positionierung versprechen „adapts training AND nutrition", PRD v1 passt nur Training an (Ernährung = Tracking + deskriptive Insights). Entscheiden: Versprechen in Hooks/Landingpage anpassen oder Ernährungs-Adaption in v1 aufnehmen
- [x] 🔴 **Schwellenwert „erste Anpassung":** PRD sagt „1–2 Zyklen", Architektur/Prompt sagen „mind. 2 vollständige Zyklen" → verbindlich auf 2 festlegen und im PRD vereinheitlichen
- [x] 🔴 **Schwellenwert „aufgehoben":** 2 widersprechende Zyklen in Folge (Vorschlag aus Architektur) – als konfigurierbare Konstante/Remote-Config festlegen
- [x] Definition **„widersprechender Zyklus"** präzisieren (aktuell undefiniert): z. B. Ist-Last weicht um >X % von `f_phase`-Vorhersage ab; X festlegen (Rauschtoleranz)
- [x] Definition **Zyklusphasen** festlegen: Fensterung relativ zu Periodenstart (nicht starrer 28-Tage-Kalender), Umgang mit variabler Zykluslänge, Vorhersage der nächsten Periode (gleitender Median der letzten N Zyklen)
- [x] ⚠️ **Methodik-Check `f_phase = L_phase / L_gesamt`:** Rohlast (Gewicht×Wdh) ist durch Progressive Overload, Übungsauswahl, Deloads und Trainingshäufigkeit verzerrt. Vorschlag: pro Übung gegen gleitende Baseline normalisieren (z. B. e1RM bzw. Last relativ zum 4-Wochen-Trend), dann über Übungen mitteln; Mindest-Satzzahl pro Phase; Mindest-Effekt (z. B. ≥3–5 %) bevor etwas angepasst wird
- [x] Wer ist **nicht** Zielgruppe der Engine? Hormonelle Verhütung, unregelmäßige Zyklen/PCOS, Schwangerschaft/Postpartum, Menopause → Fallback „nur deskriptiv, keine Zyklus-Anpassung" definieren
- [x] **Offline-Entscheidung:** Gym-Keller ohne Empfang ist Alltag → Empfehlung: Training-Logging offline-first (lokale Queue, Sync später); Entscheidung treffen
- [ ] **Tech-Stack bestätigen:** React Native + Expo (Empfehlung: ja, kein natives Muss-Feature in v1). Konsequenz: HealthKit braucht Expo Dev Build (kein Expo Go)
- [ ] ⚠️ **Google Fit ist veraltet/abgekündigt** → stattdessen **Android Health Connect** einplanen; PRD/Architektur/CLAUDE.md anpassen
- [x] Zyklus-Input im Onboarding: Default = manuell, Health-Sync optional (Empfehlung; reduziert Abhängigkeit/Datenschutzfläche)
- [ ] Barcode-DB: Open Food Facts Stichprobe mit ~50 typischen DACH-Produkten (dm, Rewe, Lidl, Aldi, Billa, Migros), danach Entscheidung
- [ ] Platzhalter-Inhalte für die Wartezeit bis zum ersten Insight festlegen (siehe Phase 5)
- [ ] Preis/Zahlungsweg für Vorbesteller:innen klären (6,99 €/Monat; Stripe/Payment-Link vs. In-App-Kauf; Store-Gebühren einkalkulieren)
- [ ] Rechtsform/Impressum/Datenschutz-Verantwortliche klären (DACH-Pflichten)

## Phase 1 – Projekt-Fundament

- [ ] 🔴 PRD/Architektur-Änderungen aus Phase 0 in die Dokumente zurückschreiben (Single Source of Truth) und als `/docs` ins Repo legen
- [x] `CLAUDE.md` im Repo-Root aus der Vorlage anlegen (inkl. Korrekturen: Health Connect, Offline-Regel, verbotene Formulierungen)
- [x] Expo-Projekt (TypeScript) initialisieren, Ordnerstruktur `/src/{screens,components,engine,api,store,navigation}`
- [x] Zustand-Setup, Supabase-Client mit Env-Variablen (`.env.example`, keine Secrets im Repo)
- [x] Supabase-Projekt in **EU-Region (Frankfurt)** anlegen
- [x] Linting/Formatting (ESLint, Prettier), `tsc --noEmit`, Jest/Vitest
- [x] CI (GitHub Actions): Lint + Typecheck + Tests auf jedem PR
- [x] Navigation: Tabs (Log, Insights, Profil) + Auth-Flow
- [x] i18n-Grundgerüst, UI-Sprache Deutsch (Texte zentral, nicht hartkodiert)
- [x] **Copy-Lint:** automatischer Test, der verbotene Formulierungen in UI-Texten findet („optimal in der Follikelphase", „Cycle Syncing", „science-backed" ohne Beleg …)
- [ ] Crash-Reporting (Sentry, EU) und datensparsames Produkt-Analytics (z. B. PostHog EU) – nur mit Einwilligung

## Phase 2 – Datenmodell & Auth (Plan Mode!)

- [x] Schema-Vorschlag: User, CycleLog, TrainingLog, NutritionLog, DailyCheckin, PhaseAdjustment (+ Review durch dich vor dem Anlegen)
- [x] Verbesserung prüfen: `TrainingLog` in Workout → Exercise → Set normalisieren (statt eine Zeile mit „Sätze, Wdh, Gewicht"), da pro Satz RPE/Gewicht variiert
- [x] Übungs-Stammdatenliste (deutsche Namen, Aliase) als Seed – nötig für übungsbasierte Normalisierung in der Engine
- [x] Constraint: ein DailyCheckin pro Nutzerin/Tag (Upsert)
- [x] **Row-Level-Security** auf allen Tabellen + automatisierte RLS-Tests (Nutzerin A sieht nie Daten von B)
- [x] Supabase Auth (E-Mail + Passwort), E-Mail-Verifizierung, Passwort-Reset
- [x] Account- und Datenlöschung (Pflicht: DSGVO + App-Store-Regel) inkl. Datenexport
- [x] Migrationen versioniert im Repo

## Phase 3 – Kern-Logging (Muss-Features)

- [x] Onboarding (Zykluslänge, Erfahrung, Ziel, Erwartungsmanagement „Insights brauchen 1–2 Zyklen", optionaler Health-Sync, Einwilligung Gesundheitsdaten)
- [ ] Trainings-Log (Übung, Sätze, Gewicht, Wdh, RPE; Prefill vom letzten Training; Rest-Timer als Hygiene-Feature)
- [ ] Ernährungs-Log (Kalorien/Makros, manuell, Favoriten/Zuletzt-gegessen)
- [ ] Barcode-Scan + Open-Food-Facts-Anbindung (mit manuellem Fallback)
- [x] Zyklus-Log (Periodenstart/-ende manuell, Korrektur nachträglich möglich)
- [ ] Health-Sync Zyklus: HealthKit (iOS) + Health Connect (Android), lesend
- [x] Tägliches Check-in (3 Fragen, <15 Sek.) – _Erinnerung (optional, standardmäßig aus) noch offen_
- [ ] Offline-Queue für Training-Log (laut Entscheidung Phase 0)
- [x] `cyclePhase.ts`: Phasenberechnung + Vorhersage nächste Phase (Unit-Tests: variable Länge, fehlende Daten, Retro-Korrektur)

## Phase 4 – Adaptive Engine (Kern, Plan Mode + Review-Subagent)

- [ ] Engine-Design im Plan Mode: Funktionssignaturen, Datenfluss, reine Funktionen (kein I/O) → gut testbar
- [ ] `f_phase` pro Nutzerin/Phase mit Normalisierung (siehe Phase 0), Mindestdaten: ≥2 vollständige Zyklen
- [ ] `PhaseAdjustment` anlegen/aktualisieren (Status aktiv/aufgehoben, bestätigende/widersprechende Zyklen)
- [ ] Reduzierte Volumen-Vorgabe für kommende Phase ableiten und im Training-Log anzeigen
- [ ] Aufhebe-Logik (konfigurierbare Schwelle, Default 2 in Folge)
- [ ] Manuelles Überschreiben/Deaktivieren jederzeit durch Nutzerin
- [ ] Unit-Tests: zu wenig Daten, exakt an der Schwelle, mehrere Phasen gleichzeitig aktiv, Zyklus-Ausreißer, Pausen/Krankheit
- [ ] **Synthetischer Daten-Generator** (simulierte Nutzerinnen mit/ohne Zyklus-Effekt) → prüfen, dass die Engine Muster findet **und bei Nullrauschen nichts erfindet** (False-Positive-Rate)
- [ ] Review-Subagent gegen die fünf Engine-Regeln aus der Prompt-Bibliothek
- [ ] Transparenz: jede Anpassung erklärbar („deine Daten aus 2 Zyklen zeigen …"), nie universell formuliert

## Phase 5 – Insights & „Sollte"-Features

- [ ] Insights-Screen: aktive PhaseAdjustments + deskriptive Muster
- [ ] **Wartezeit-Zustand** (Zyklus 1–2): Fortschrittsanzeige „Datenbasis x/2 Zyklen", Basis-Auswertungen (Gewicht, Kraft, Kalorien, Schlaf) damit die App nicht leer wirkt
- [ ] Fortschritts-Charts mit Zyklusphasen-Overlay (Gewicht, Kraftwerte, Kalorien)
- [ ] Wochenrückblick
- [ ] Alle Texte durch Copy-Lint + manuelles Science-Communication-Review

## Phase 6 – Datenschutz, Recht, Store-Reife

- [ ] Gesundheitsdaten = besondere Kategorie (DSGVO Art. 9): ausdrückliche Einwilligung, Zweckbindung, Datenschutzerklärung (DE), Auftragsverarbeitung mit Supabase, TOMs
- [ ] Impressum, AGB, Widerrufsbelehrung/Abo-Bedingungen
- [ ] Medizinischer Disclaimer (kein Medizinprodukt, keine Diagnose/Verhütung) – Einordnung als Wellness-App prüfen
- [ ] Apple App Privacy Labels / Google Data-Safety-Formular, Health-Permissions-Texte
- [ ] Apple Developer + Google Play Account, TestFlight / Play Internal Testing
- [ ] Zahlungsabwicklung (Vorbestellung außerhalb der Stores; später IAP/Play Billing) – keine aggressive Paywall

## Phase 7 – Validierung & Go-to-Market (eigentliches Ziel!)

Der Build ist nur Mittel zum Zweck: Zahlungsbereitschaft beweisen.

- [ ] Landingpage + Warteliste (DE), Hook A mit B/C als A/B-Test; Tracking der Conversion
- [ ] Gym-Flyer (QR-Code → Warteliste), Liste Zielstudios, Tracking pro Standort
- [ ] Vorbestell-Angebot (6,99 €/Monat bzw. Founders-Preis) mit echter Zahlung → Metrik: 20–30 zahlende Vorbesteller:innen
- [ ] 8–12 Nutzerinterviews mit Zielgruppe (Problem-/Preisvalidierung, Nutzung von 2–3 Apps heute)
- [ ] Soft-Launch-Kohorte (Closed Beta, 15–30 Nutzerinnen) – Metriken instrumentieren: Woche-2-Retention, Logging ≥4/7 Tage, unaufgeforderte Insight-Nennung
- [ ] Kalibrierung der Zielwerte nach erster Kohorte (PRD-Vorgabe)
- [ ] Named DACH-Sportwissenschaftler:in als Berater ansprechen (z. B. Deutsche Sporthochschule Köln) – Review von Claim-Sprache + Algorithmus
- [ ] Entscheidung Go / Pivot / Stop anhand der Kriterien (vorab schriftlich festlegen)

## Später / bewusst nicht in v1

- [ ] Trainingspläne von Grund auf generieren
- [ ] Ernährungs-Adaption (falls in Phase 0 nicht in v1)
- [ ] Wearable-Integrationen (Whoop/Garmin/Oura)
- [ ] Social Login, Community-Features, kostenpflichtige Lebensmitteldatenbank
