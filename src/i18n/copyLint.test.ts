import { de } from './de';
import { forbiddenPhrases } from './forbiddenPhrases';

function collectStrings(value: unknown): string[] {
  if (typeof value === 'string') return [value];
  if (value && typeof value === 'object') return Object.values(value).flatMap(collectStrings);
  return [];
}

describe('Copy-Lint', () => {
  it('enthält keine verbotenen Phasen-/Claim-Formulierungen', () => {
    const hits = collectStrings(de).flatMap((text) =>
      forbiddenPhrases.filter((f) => f.pattern.test(text)).map((f) => `"${text}" → ${f.reason}`),
    );
    expect(hits).toEqual([]);
  });

  it('erkennt verbotene Formulierungen (Selbsttest)', () => {
    const bad = ['Cycle Syncing für dich', 'In der Follikelphase ist Muskelaufbau optimal'];
    for (const text of bad) {
      expect(forbiddenPhrases.some((f) => f.pattern.test(text))).toBe(true);
    }
  });
});
