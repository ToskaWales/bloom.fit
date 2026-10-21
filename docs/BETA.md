# Geschlossene Beta und Validierung

Ziel: beantworten, ob Lifterinnen in DACH für Bloom zahlen würden. Gebaut ist der Kern; was fehlt, ist Nutzung durch echte Menschen. Dieses Dokument ist der Ablauf dafür.

## 1. Vorbereitung (einmalig, deine Aufgaben)

- [ ] Migrationen 01 bis 11 im Supabase SQL-Editor, Reihenfolge in `docs/SETUP.md` §9.
- [ ] Hosting, Umgebungsvariablen (`docs/SETUP.md`), `npm run build` als Build-Befehl (kopiert die Scanner-Datei).
- [ ] Login-Anbieter aktivieren (Google, Apple braucht ein Entwicklerkonto), Resend für Mails.
- [ ] `purge_deleted_rows(30)` per pg_cron planen.
- [ ] Impressum und Datenschutz: alle `[[...]]`-Platzhalter ausfüllen.
- [ ] Eigener Durchlauf auf dem Handy, installiert als App: Login, Onboarding, Check-in, Training offline loggen und synchronisieren, Barcode scannen (iOS fragt die Kamera in installierten Web-Apps oft erneut), Export, Konto löschen.
- [ ] Support-Adresse festlegen und in der App und der Einladung nennen.

## 2. Einladung

- Einladungen über die Admin-Seite (`/einladen`). Beta-Größe laut Plan: 20 bis 50 Personen aus der Warteliste und den Interviews.
- Erste Nachricht an Testerinnen (Vorlage): Was Bloom ist (Training, Check-in, Hinweise aus den eigenen Daten, optional Zyklus und Ernährung), dass es eine Beta ist, dass Daten jederzeit exportiert und gelöscht werden können, was von ihnen gebraucht wird (zwei Wochen ehrlich nutzen, ein kurzes Gespräch), und die Support-Adresse.
- Nichts versprechen, was nicht gebaut ist: Es gibt keine Bezahlfunktion und keine App-Store-App.

## 3. Was du beobachtest

Bloom speichert bewusst keine Nutzungs-Tracker. Zahlen kommen aus der Datenbank, nur als Zählungen:

- `supabase/queries/beta_metrics.sql` im SQL-Editor ausführen (wöchentlich). Es zeigt: Mitglieder, Aktivierung (mindestens 7 Aktivitätstage in den ersten 14), Bindung in Woche 4, Anteil mit Zyklus-Tracking und eingeschalteter Ernährung, und je Hinweisart wie oft angenommen oder abgelehnt wurde. Es liest weder Gesundheitswerte noch E-Mail-Adressen (ein Test stellt das sicher).
- Hinweise, die oft abgelehnt werden, sind das stärkste Signal, dass eine Regel nicht passt. Schwellen sind Startwerte und gehören danach angepasst.

## 4. Wöchentliche Fragen (5 Minuten, per Nachricht oder Gespräch)

1. Was hast du diese Woche in Bloom gemacht, was in anderen Apps?
2. Welcher Hinweis war passend, welcher nicht? Wo hast du „Passt nicht“ gedrückt und warum?
3. Hat dich etwas genervt, verwirrt oder irritiert (Texte, Fragen, Zyklus, Ernährung)?
4. Was hat dir gefehlt, damit du Hevy oder Yazio ersetzt?

In Woche 3 bis 4 zusätzlich die Zahlungsfragen aus `docs/INTERVIEWS.md` (Preis offen fragen, nicht vorschlagen).

## 5. Go/No-Go (mit dir festlegen)

Vorschlag als Startpunkt, ausdrücklich nicht belegt:

| Messung                                          | Vorschlag „weiter“              |
| ------------------------------------------------ | ------------------------------- |
| Aktivierung (7 Tage von 14)                      | mindestens 40 %                 |
| Bindung Woche 4                                  | mindestens 25 %                 |
| Würden zahlen (klare Zusage, nicht „vielleicht“) | mindestens 5 Personen oder 20 % |
| Hinweise: Anteil abgelehnt                       | unter 50 % je Art               |

Wichtig: „Würden zahlen“ ist erst belastbar mit einer echten Handlung (Vorbestellung, hinterlegte Zahlungsmethode, Zahlungslink). Die Bezahlfunktion (Stripe, 14 Tage Test, 6,99 €) ist nicht gebaut. Entscheidung für dich: Zahlungslink von Hand als Test (schnell) oder Stripe zuerst bauen (aufwendig).

## 6. Fürsorge und Grenzen

- Wenn eine Testerin Essprobleme, eine ausbleibende Periode oder Beschwerden erwähnt: zuhören, auf Ärztin oder Arzt verweisen, nichts diagnostizieren, Ernährung für sie ausschalten (Einstellungen) anbieten.
- Der Hinweis „sprich mit einer Ärztin oder einem Arzt“ ist ein Hinweis, keine Beratung. Keine Regel oder Zahl wird Nutzerinnen als medizinischer Rat dargestellt.
- Die Texte zu Hunger und die Schwelle „wenig eingetragen“ sind ungeprüfte Startwerte. Vor einem öffentlichen Start von einer Fachperson (Sportwissenschaft, Ernährung, Essstörungen) ansehen lassen.
- Wer aussteigt, bekommt auf Wunsch sofort Export und Löschung. Das Löschen entfernt Konto und alle Daten.

## 7. Abbruch oder Pause

Sofort pausieren bei: Datenverlust oder Sync-Fehlern bei mehreren Personen, einem Sicherheitsproblem, einer Rückmeldung, dass ein Text verletzt oder triggert. Zuerst beheben, dann weitermachen: Zuverlässigkeit und Ruhe sind das Produkt.

## 8. Danach

Ergebnisse in `docs/INTERVIEWS.md` (Auswertung) festhalten, Schwellen der Engine anhand der Hinweisreaktionen anpassen, Entscheidung über Bezahlfunktion und Beirat (siehe `docs/PLAN.md`, Phase 4).
