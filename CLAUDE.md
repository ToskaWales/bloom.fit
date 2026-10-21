# Bloom – Projektkontext

Trainings- und Ernährungs-App für Frauen, die ernsthaft Krafttraining machen (3x+/Woche, Muskelaufbau/Recomp), Markt DACH, Solo-Gründer (Tech). Preis 6,99 €/Monat. Ziel jetzt: **Validierung** (zahlen DACH-Lifterinnen dafür?), kein Full Launch.

**Status:** Phase 0 (Landingpage/Warteliste), 1a (Auth/Onboarding), 1b (Training offline, Vorlagen, PRs, Hevy/Strong-Import) 1c (Check-ins, Gewicht, Zyklus, Verlauf) und 1d (Anpassungs-Engine: Bereitschaft, Plateau, Muster rund um die Periode, Sicherheitsregel) sind gebaut. Ernährung (optionales Logging, Sicherheitssignal, Barcode/Open Food Facts, weicher Hunger-Hinweis) ist gebaut. Offen: Validierung mit echten Nutzerinnen. Stack: Next.js (PWA, offline-first) + Supabase (EU-Region, Postgres, Auth, RLS) + TypeScript. Architektur und Entscheidungen: `docs/ARCHITECTURE.md`, Setup-Schritte: `docs/SETUP.md`.

## Kernmechanismus

Intensität und Ernährungsziele passen sich an die **eigenen geloggten Daten** an (Gewicht, Energie, Schlaf, Motivation, Trainingsleistung, Skip-Rate) über den Zyklus – **kein fixer Phasenkalender**. Zyklusphase ist nur _ein_ Input unter mehreren.

## Wissenschafts-Leitplanken (verbindlich für Code, Texte, UI, Push-Nachrichten)

- Erlaubt: „viele Frauen bemerken…“, „manche Frauen können…“, „deine Daten zeigen…“, „cycle-aware“, „passt sich deinem Zyklus an“.
- Verboten: „Follikelphase ist optimal für Muskelaufbau“, „Lutealphase senkt Kraft“, „du brauchst X extra kcal“, „Cycle Syncing“, „science-backed“ ohne konkrete Quelle, Verletzungs-/ACL-Warnungen nach Phase.
- Kalorien/Protein: nur als weiche, optionale Anpassung auf Basis von Hunger, Gewichtstrend, Leistung – nie als pauschale Phasen-Zahl.
- Standardtext: „Die Forschung ist bei einem Punkt klar: Zykluseffekte unterscheiden sich stark zwischen Frauen. Deshalb passt sich Bloom deinen Daten an, nicht einem festen Phasenkalender.“
- Zwei Nutzerinnen-Typen unterstützen: „Durchziehen“ (kaum Zyklus-Effekt) und „Anpassen“.

## Produkt-Leitplanken

- „No bullshit“: minimal, keine Pop-ups/Streak-Spam, keine aggressiven Paywalls, kein Gamification-Overkill.
- Ziele nie als „Abnehmen für Frauen“ voraussetzen; Muskelaufbau/Kraft ist Default-Vokabular (Muskelaufbau, definiert, Rekomposition, Fortschritt).
- Ernährungs-Tracking darf Essstörungen nicht triggern: kein rot/grün-Kalorienfeedback, keine Streaks auf Defizit, Hinweis bei sehr niedriger Energieverfügbarkeit / ausbleibender Periode.
- Zuverlässigkeit und Datensicherheit vor Features (Konkurrenz scheitert an Bugs und Datenverlust).
- Gesundheitsdaten (DSGVO Art. 9): EU-Hosting, Export + Löschung, Opt-in, minimale Datenerhebung.

## Arbeitsweise

Erst `/plan`, dann `/tdd`, dann `/verify` und `/code-review`. Details siehe `docs/PLAN.md`.
