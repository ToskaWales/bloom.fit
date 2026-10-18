# Bloom – Projektplan (Validierungsphase)

Quellen: Produktbrief, Evidenz-Review Zyklus & Training, Zielgruppen-Research DACH, Apps/Wettbewerb-Research.

## 0. Ausgangslage und offene Punkte
- Brief sagt „funktionierende App, alle Kernfeatures gebaut“ – im Repo `bloom.fit` liegt aktuell **kein App-Code** (nur `.claude/`). **Blocker: Code-Quelle klären** (anderes Repo / lokal / Tool) und hier importieren.
- Tech-Stack unbekannt → Stack-Audit ist Schritt 1.
- Wettbewerb existiert in DACH (Lunaletics 7,99 €, Drop It 9,99 €, Essence, Wild.AI, FitrWoman) – aber winzig (4–8 Reviews) und schwach in Ausführung. Fenster offen, schließt sich.
- Hook C („ignoriert vier Wochen im Monat“) impliziert einen festen Phasenkalender → widerspricht der eigenen Autoregulations-Linie. Umformulieren oder als Risiko testen.
- Preis (6,99 €) ist unvalidiert; Zahlungsbereitschaft ist die wichtigste offene Frage.

## Phase 1 – Bestandsaufnahme (Woche 1)
1. Code ins Repo bringen; `/update-codemaps`, Architektur-Review (Agent `architect`).
2. Feature-Inventar vs. Produktbrief: Logging (Training, Gewicht, Check-in), Ernährung/Makros, Adaptions-Logik, Zyklus-Eingabe.
3. Testbasis herstellen (`/test-coverage`, `/tdd` für Lücken, v. a. Adaptions-Algorithmus).
4. Security/Privacy-Audit (`security-reviewer`): Gesundheitsdaten, Auth, Hosting-Region, Export/Löschung.

## Phase 2 – Glaubwürdigkeit & Sicherheit (Woche 1–2)
1. **Claim-Audit**: alle UI-Texte, Onboarding, Push, Store-Listing gegen Verbotsliste in `CLAUDE.md` prüfen und fixen.
2. **Algorithmus-Audit**: Zyklusphase nur als ein Input; kalender-geschätzte Phase nicht als Wahrheit (Anovulation, unregelmäßige Zyklen, Pille); Mindestdatenmenge, bevor Anpassungen vorgeschlagen werden; „Daten reichen noch nicht“-Zustand; Vorschläge erklärbar („weil…“) und ablehnbar.
3. **Ernährungs-Safety**: kein rot/grün, kein pauschales „+300 kcal“, Warnlogik bei zu niedriger Energie / ausbleibender Periode, Hinweis auf Ärztin.
4. Onboarding ohne sexistische Defaults („Muskelaufbau/Kraft“ gleichrangig, Abnehmen optional).

## Phase 3 – Produktqualität („no bullshit“) (Woche 2–3)
1. Zuverlässigkeit: Offline-Logging, Sync ohne Datenverlust, Backups, Crash-Monitoring.
2. Schmerzpunkte der Konkurrenz abräumen: keine Pop-ups, kein Paywall-Spam, schnelle Eingabe.
3. **Migration**: Hevy/Strong-CSV-Import (Pflicht, sonst wechselt keine „Hevy-Frau“), Datenexport.
4. Lebensmitteldatenbank + Barcode (Open Food Facts o. Ä. prüfen; Yazios große DB ist die Hürde).
5. Kernaussage im Produkt: Overlay-View „Zyklus × Leistung × Gewicht × Schlaf“ (das, was Frauen heute manuell machen).

## Phase 4 – Validierung (parallel ab Woche 1)
1. Landingpage + Warteliste (Hook A/B/C testen, Pre-Launch-Messaging in Hook-Varianten ohne Verbotsclaims).
2. Kanäle: r/FitnessDE, r/Kraftsport, workout.de, Gym-Flyer (QR → Warteliste). Kein Spam – echte Beiträge/Interviews.
3. 15–20 Interviews mit Zielgruppe (3x+/Woche, Plateau); Skript: aktueller Stack, manuelles Cross-Referencing, Zahlungsbereitschaft.
4. WTP-Test: Preisvarianten (6,99 / 9,99 / Jahresplan) auf Landingpage bzw. Closed Beta.
5. Closed Beta mit 20–50 Nutzerinnen; Metriken: Aktivierung (7-Tage-Logging), Retention W4, Check-in-Quote, Zahlungsbereitschaft.
6. Teardown Lunaletics + Drop It (hands-on), Ergebnis als Differenzierungs-Matrix.

## Phase 5 – Nach ersten Daten
- Benannte/r DACH-Sportwissenschaftler:in (z. B. DSHS Köln) prüft Claim-Sprache und Algorithmus.
- Prospektive Auswertung: verbessert Anpassung Adhärenz/Readiness/Trainingskonsistenz gegenüber nicht-adaptiver Baseline?
- Wearable-Anbindung, Preis-Anhebung, App-Store-Launch erst nach Go/No-Go.

## Go/No-Go-Kriterien (Vorschlag, anpassen)
- ≥ X Wartelisten-Anmeldungen aus Zielgruppe, ≥ Y % Beta-Aktivierung, ≥ Z zahlungsbereit zu 6,99 €. (Schwellen mit dir festlegen.)

## Arbeitsweise mit dem Toolkit
`/plan` → Bestätigung → `/tdd` → `/verify` → `/code-review` → `/checkpoint`. Security-sensitive Änderungen immer durch `security-reviewer`.
