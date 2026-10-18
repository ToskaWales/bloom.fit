# Auswertung der Mustererkennung (Simulation)

Die Mustererkennung (`src/lib/engine/patterns.ts`) wird in `patterns.test.ts` durch Simulation geprüft. Das ist **keine** Validierung mit echten Daten, sondern ein Test, dass die Methode bei reinem Rauschen kaum Fehlalarme erzeugt und einen echten Effekt ausreichend oft findet. Die Schwellen bleiben Startwerte und gehören mit echten Daten und einer sportwissenschaftlichen Prüfung überarbeitet.

## Methode

- Simulierte Nutzerinnen mit Check-ins (Skala 1 bis 5, Rauschen σ = 0,4 bis 1,1), 2 bis 4 Zyklen, Zykluslängen 24 bis 41 Tage, unvollständigen Einträgen.
- Fehlalarm = mindestens ein Muster bei reinem Rauschen (ohne Effekt). Erkennung = der eingebaute Effekt wird gefunden.
- Permutationstest (2000 Permutationen, fester Seed), α = 0,005 (Bonferroni über 10 Vergleiche pro Person).

## Ergebnisse

| Szenario                                     | Ergebnis                                                                              |
| -------------------------------------------- | ------------------------------------------------------------------------------------- |
| Fehlalarme bei reinem Rauschen               | 0 bis 4 % (schlechtester Fall: unregelmäßig 24 bis 34 Tage, 3 Zyklen, σ = 1,1: 4,0 %) |
| Energie 0,8 Punkte niedriger vor der Periode | 21 bis 41 % erkannt                                                                   |
| Energie 1,0 Punkte niedriger                 | 43 bis 71 %                                                                           |
| Energie 1,5 Punkte niedriger                 | 89 bis 98 %                                                                           |
| Energie 2,0 Punkte niedriger                 | 99 %                                                                                  |

Der erste Versuch mit α = 0,01 ergab 6,7 % Fehlalarme; deshalb Bonferroni (α = 0,005) und der Ausschluss von Zyklen über 45 Tage. Kleine Effekte (unter etwa 1 Punkt) werden bewusst oft nicht gemeldet: lieber ein fehlendes Muster als ein erfundenes.

## Bekannte Grenzen

- Der Zufallstest mischt einzelne Tage innerhalb eines Zyklus und behandelt sie als unabhängig. Echte Einträge kommen in Serien (z. B. eine schlechte Woche); die Fehlalarmrate gilt streng nur für unabhängiges Rauschen und kann real höher liegen. Deshalb sagt Bloom „kaum durch Zufall zu erklären“ und nie „bewiesen“.
- Trainingsleistung hat pro Zyklus nur wenige Einheiten; mit 2 Zyklen kann sie das strenge Signifikanzniveau praktisch nicht erreichen und wird meist erst mit 3 oder mehr Zyklen gefunden.
- Sicherheitsregel: bei unregelmäßigen Zyklen oder altem letztem Eintrag gilt die Periode als deutlich überfällig, wenn der letzte Beginn mehr als 35 + 7 Tage zurückliegt.

## Offene Punkte

- Simulation um serielle Abhängigkeit und fehlende Tage erweitern.

- Mit echten Daten prüfen, wie oft Nutzerinnen Hinweise ablehnen („Passt nicht“).
- Zeitliche Abhängigkeit der Tageswerte (aufeinanderfolgende Tage ähneln sich) ist in der Simulation nur grob abgebildet.
- Fenstergrößen (4 und 3 Tage) sind Annahmen.
