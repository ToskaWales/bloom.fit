// Deterministic random numbers for the pattern test and the simulations in
// ./sim.ts. Not for anything security-related; Math.random is avoided on purpose
// so the same data always gives the same result.
// Small seeded generator (mulberry32): returns a function giving numbers in [0, 1).
// Results of the pattern test must be reproducible.
export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
