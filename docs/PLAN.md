# Bloom – Projektplan (Greenfield, Validierungsphase)

Quellen: Produktbrief, Evidenz-Review Zyklus & Training, Zielgruppen-Research DACH, Apps/Wettbewerb-Research.
Status: **Es gibt noch keinen Code.** Stack (entschieden): Next.js PWA + Supabase (EU) + TypeScript.

## Leitgedanke

Ziel ist nicht „App fertig“, sondern „beweisen, dass Lifterinnen in DACH zahlen“. Deshalb: **erst Nachfrage testen (Landingpage/Interviews), parallel den kleinsten MVP bauen, der die Kernaussage erlebbar macht.**

## Wettbewerb/Risiken (aus Research)

- Lunaletics (7,99 €), Drop It (9,99 €), Essence, Wild.AI, FitrWoman existieren; DACH-Anbieter winzig, aber Fenster schließt sich. Yazio könnte Zyklusfeatures ergänzen.
- Konkurrenz scheitert an Ausführung: Bugs, Datenverlust, Paywall-Spam, Pop-ups → Zuverlässigkeit und Ruhe sind Feature Nr. 1.
- Wissenschaft: Phasenregeln sind umstritten → nur datenbasierte Autoregulation, Sprache gemäß `CLAUDE.md`.
- Hook C („ignoriert vier Wochen im Monat“) impliziert Phasenkalender → umformulieren oder als Risiko testen.
- Nutzerinnen haben schon Hevy + Yazio: ohne Import und große Lebensmitteldatenbank wechselt niemand.
- Cold-Start: In den ersten 1–2 Zyklen gibt es zu wenig Daten für „Muster“. Ehrlich kommunizieren; Wert ab Tag 1 kommt aus Tages-Readiness-Autoregulation, Muster-Erkennung ab ~2 Zyklen.
- Ernährungs-Tracking kann Essstörungen triggern → Safety-Design von Anfang an.
- Gesundheitsdaten = DSGVO Art. 9 → Einwilligung, EU-Hosting, Export/Löschung von Anfang an.

## Phase 0 – Fundament & Nachfrage (Woche 1)

1. Repo-Setup: Next.js + TS, Supabase-Projekt (EU), CI (lint, typecheck, tests), Deploy (z. B. Vercel EU), `CLAUDE.md` finalisieren.
2. Architektur-Entwurf (`architect`): Datenmodell, Offline-/Sync-Strategie, RLS, Adaptions-Engine als reine, testbare Funktionen.
3. Landingpage + Warteliste (DE), Hook A/B/C als Test, Double-Opt-in, Datenschutz/Impressum.
4. Interviewskript + Outreach (r/FitnessDE, r/Kraftsport, workout.de, Gym-Flyer mit QR). Ziel: 15–20 Gespräche.

## Phase 1 – MVP-Kern (Woche 2–4)

Reihenfolge nach Wert; jeweils `/plan` → `/tdd` → `/verify` → `/code-review`.

1. Auth + Onboarding (Ziel: Muskelaufbau/Recomp/Kraft gleichrangig, keine sexistischen Defaults, Zyklus-Einstieg optional, Pille/unregelmäßig berücksichtigt).
2. Trainings-Logging (offline-first, schnell): Übungen, Sätze, Gewicht, Wdh., RPE, PRs, Vorlagen/Pläne; Hevy/Strong-CSV-Import.
3. Täglicher Check-in (Schlaf, Energie, Motivation, Symptome; <15 s) + Gewichtseintrag.
4. Zyklus-Eingabe (Perioden-Start, optional Ovulationstest/Symptome); Phase nur als _eine_ Eingangsgröße, Unsicherheit mitführen.
5. Ernährung: Makro-/Kalorien-Logging, Barcode, Datenbank (Open Food Facts + deutsche Daten prüfen), Rezept/Favoriten; kein rot/grün, keine Streaks.
6. Adaptions-Engine v1 (regelbasiert, erklärbar): Readiness-basierte Tagesvorschläge (Volumen/Intensität), Gewichts-Trend, optionale weiche Kalorien-/Protein-Vorschläge – jeweils mit „weil…“, ablehnbar, Mindestdatenmenge.
7. Muster-Ansicht: Overlay Zyklus × Leistung × Gewicht × Schlaf × Motivation („Bloom zeigt dir, warum“).
8. Paywall minimal: 14 Tage Trial, 6,99 €/Monat, kein Pop-up-Spam (Stripe, SEPA/Karte/Apple Pay).

## Phase 2 – Härtung (Woche 4–5)

Security-Review (`security-reviewer`), RLS-Tests, E2E (`e2e-runner`) für Kernflows, Datenexport + Konto-Löschung, Crash-/Fehler-Monitoring, Claim-Audit aller Texte, Ernährungs-Safety (Warnlogik bei sehr niedriger Energie/ausbleibender Periode).

## Phase 3 – Closed Beta & Validierung (ab Woche 5)

Ablauf, Checkliste, Metriken und Fragen: `docs/BETA.md`.

- 20–50 Nutzerinnen aus Warteliste. Metriken: Aktivierung (7-Tage-Logging), W4-Retention, Check-in-Quote, Trial→bezahlt.
- Preistest 6,99 / 9,99 / Jahresplan. Teardown Lunaletics + Drop It.
- Go/No-Go-Schwellen (mit dir festlegen): ≥X Warteliste, ≥Y % Aktivierung, ≥Z zahlend.

## Phase 4 – Nach Daten

Beirat DACH-Sportwissenschaft (z. B. DSHS Köln), prospektive Auswertung (Adhärenz/Readiness vs. nicht-adaptive Baseline), Wearables, App-Store-Wrapper (Capacitor), Preisanpassung.

## Arbeitsweise

`/plan` → Bestätigung → `/tdd` → `/verify` → `/code-review` → `/checkpoint`. Gesundheitsdaten-/Auth-Änderungen immer durch `security-reviewer`.

## Vor dem öffentlichen Launch (aus Security-Review Phase 1a)

- **Rate-Limit/Captcha** pro IP und Adresse für Login-Code, Warteliste, Code-Einlösung (Cloudflare Turnstile + Supabase-Captcha, Custom SMTP mit sinnvollen Limits). Aktuell nur Schutz durch Cooldowns pro Adresse.
- Admin-Zugang an unveränderliche User-ID oder `app_metadata.role` + MFA binden (heute: bestätigte E-Mail in `ADMIN_EMAILS`).
- Supabase „before user created“-Hook, falls die Login-Sperre auch gegen direkte API-Aufrufe wirken soll (heute nur Mail-Spam-Filter).
- E2E-Tests (Playwright) für Login → Einladung → Onboarding → Export → Löschung gegen ein echtes Supabase-Testprojekt.
