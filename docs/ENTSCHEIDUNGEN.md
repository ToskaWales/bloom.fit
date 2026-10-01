# Bloom – Entscheidungslog

Verbindlich für PRD, Architektur und Code, bis neue Daten etwas anderes zeigen. Stand: 2026-10-01.

| #   | Thema                                                                                 | Entscheidung                                                                                                                                                                                                     |
| --- | ------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0   | Supabase                                                                              | Projekt läuft in Frankfurt (eu-central-1)                                                                                                                                                                        |
| 1   | Projektstand                                                                          | Greenfield, kein Vorgängercode; die Notiz „all core features built" ist veraltet                                                                                                                                 |
| 2   | Ernährung                                                                             | v1 passt nur das Training an. Ernährung = Tracking + beschreibende Insights. Hooks und Landingpage dürfen keine Ernährungs-Adaption versprechen                                                                  |
| 3   | Erste Anpassung                                                                       | Frühestens nach 2 vollständigen Zyklen mit Trainingsdaten in der jeweiligen Phase                                                                                                                                |
| 4   | Aufheben                                                                              | Nach 2 widersprechenden Zyklen in Folge; Wert konfigurierbar                                                                                                                                                     |
| 5   | Widersprechender Zyklus                                                               | Ist-Last weicht um mehr als 5 % von der Vorhersage ab, **bereinigt** um Progressive Overload und um Störfaktoren (z. B. schlechter Schlaf, zu wenig Essen laut Check-in/Ernährungs-Log). Schwelle konfigurierbar |
| 6   | Zyklusphasen                                                                          | Fenster relativ zum Periodenstart der Nutzerin, kein starrer 28-Tage-Kalender. Nächste Periode = Median der letzten Zyklen                                                                                       |
| 7   | Trainingslast                                                                         | Pro Übung gegen die eigene Baseline normalisiert (z. B. e1RM-Trend), dann gemittelt. Datenmodell: Workout → Übung → Satz                                                                                         |
| 8   | Sonderfälle (hormonelle Verhütung, unregelmäßiger Zyklus, Schwangerschaft, Menopause) | Engine läuft trotzdem, verlangt aber mehr Logs von der Nutzerin. Welche Zusatzdaten genau, ist offen und wird mit dem Schema geklärt                                                                             |
| 9   | Offline                                                                               | Training-Logging offline-first (lokal speichern, später sync). Übrige Logs online                                                                                                                                |
| 10  | Zyklus-Input                                                                          | Standard manuell, Health-Sync (HealthKit / Android Health Connect) optional                                                                                                                                      |

## Offen aus diesen Entscheidungen

- Entscheidung 5: Wie genau werden Schlaf/Ernährung als Störfaktor gewichtet? (Schwellen, z. B. Schlaf unter X Stunden)
- Entscheidung 8: Welche Zusatz-Logs braucht die Engine je Sonderfall? Schwangerschaft: Engine sollte aus Sicherheitsgründen eher pausieren und auf ärztliche Beratung verweisen – bitte bestätigen

## Schema-Entscheidungen (Phase 2)

- Zyklusphase wird nicht am Training gespeichert, sondern aus `cycles` abgeleitet (View `workout_cycle_context`), damit nachträgliche Korrekturen nichts veralten lassen.
- Training: `workouts` → `workout_exercises` → `sets`; Ernährung pro Lebensmittel (`nutrition_entries`, Tagessummen per View).
- Schwangerschaft/Postpartum setzt `engine_mode = paused` per DB-Trigger (Sicherheitsnetz, Annahme aus dem Plan – bei Bedarf ändern).
- Kinder-Tabellen erzwingen per zusammengesetztem Fremdschlüssel denselben Besitzer wie der Parent.
- RLS ist aktiviert, aber nicht `force`d (Supabase-Owner-Rolle `postgres` umgeht RLS ohnehin; `force` würde Migrationen/Trigger unnötig erschweren).
- Engine-Schwellenwerte (2 Zyklen, 5 %, 2 widersprechende) leben als Konstanten in `src/engine`, nicht im Schema.
