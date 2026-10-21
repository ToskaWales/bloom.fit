# Offene Punkte (nach Wert sortiert)

Stand nach den Reviews zu 1d, N-1, N-2 und N-3. Nichts davon blockiert die geschlossene Beta (`docs/BETA.md`), außer wo es steht.

## Vor der Beta, wenn die Zeit reicht

1. **E2E-Test gegen ein echtes Supabase-Testprojekt** (Login → Einladung → Onboarding → Check-in → Export → Löschung). Heute gibt es Unit-, Datenbank- und Browser-Stichproben, aber keinen Durchlauf mit echtem Login. Größter Hebel gegen Überraschungen am ersten Tag. Braucht ein Testprojekt, das nur du anlegen kannst.
2. **Rate-Limit/Captcha** für Login-Code, Warteliste und Code-Einlösung (aus der Sicherheitsprüfung 1a, siehe `docs/PLAN.md`). Bei einer kleinen, eingeladenen Beta vertretbar offen, vor öffentlichem Zugang nicht.
3. **Fehler-Überwachung** (Abstürze, Sync-Fehler). Ohne sie erfährst du von Datenverlust nur durch Nachfragen.

## Vor einem öffentlichen Start

4. **Content-Security-Policy** (Anforderungen in `docs/ARCHITECTURE.md`, Abschnitt Barcode).
5. **Admin-Zugang** an eine feste Nutzer-ID oder Rolle mit Zweitfaktor binden (heute: bestätigte E-Mail in `ADMIN_EMAILS`).
6. **Supabase-Hook „before user created“**, damit die Login-Sperre auch bei direkten API-Aufrufen wirkt.
7. **Fachliche Prüfung** der Schwellen und Texte zu Hunger, niedriger Zufuhr und ausbleibender Periode (Sportwissenschaft, Ernährung, Essstörungen).
8. **Bezahlfunktion** (Stripe, 14 Tage Test, 6,99 €), falls die Beta Zahlungsbereitschaft zeigt. Entscheidung offen, siehe `docs/BETA.md` §5.

## Qualität, wenn Zeit ist

9. **Komponententests** für Scanner, Barcode-Suche, Muster-Seite und Formulare (Kamera- und Fetch-Mocks). Die Logik darunter ist getestet, die Oberfläche bisher nur per Browser-Stichprobe. Braucht eine Testumgebung mit DOM.
10. **Simulation der Mustererkennung** um aufeinanderfolgende Tage und fehlende Tage erweitern (`docs/ENGINE-EVALUATION.md`, Bekannte Grenzen).
11. **Seitenkopf-Schalter auf zweiten Geräten:** Zwischengespeicherte Seiten tragen den Ernährungs- und Gewichts-Schalter; offline kann kurz der alte Stand erscheinen (Daten werden dabei serverseitig trotzdem nicht gespeichert). Lösung: Schalter aus dem lokalen Speicher lesen, den der Sync aktualisiert.
12. **Einwilligung und Profil-Schalter atomar** speichern (heute zwei Schritte; bei einem Fehler bleibt die Einwilligung aktiv, der Schalter aus).
13. **Zufallstest der Mustererkennung** mit Blöcken statt einzelnen Tagen, falls echte Daten stark zeitlich zusammenhängen.

## Bewusst nicht geplant

- Kalorien- oder Protein-Vorgaben, Tagesziele, Bewertungen von Lebensmitteln (Nutri-Score u. ä.), Streaks. Siehe `CLAUDE.md`.
