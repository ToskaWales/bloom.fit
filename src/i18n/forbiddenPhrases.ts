// Verbotene Formulierungen laut Science-Communication-Richtlinie (Projektnotizen).
export const forbiddenPhrases: { pattern: RegExp; reason: string }[] = [
  { pattern: /cycle[\s-]?syncing/i, reason: 'Begriff „Cycle Syncing" vermeiden' },
  { pattern: /follikelphase\s+ist\s+optimal/i, reason: 'universelle Phasen-Vorschrift' },
  { pattern: /lutealphase\s+(senkt|reduziert|verringert)/i, reason: 'universelle Phasen-Aussage' },
  {
    pattern: /\bin\s+der\s+\w*phase\s+(ist|sind|musst|solltest)\b/i,
    reason: 'universelle Phasen-Aussage',
  },
  {
    pattern: /du\s+brauchst\s+\d+\s*(extra\s+)?(kcal|kalorien)/i,
    reason: 'universelle Kalorien-Vorschrift',
  },
  {
    pattern: /science[\s-]?backed|wissenschaftlich\s+bewiesen/i,
    reason: 'Claim nur mit konkretem Beleg',
  },
  {
    pattern: /zyklusbasiert/i,
    reason: 'bevorzugt „zyklusbewusst" / „passt sich deinem Zyklus an"',
  },
];
