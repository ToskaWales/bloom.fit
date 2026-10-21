export type Parsed = { ok: true; value: number | null } | { ok: false };

// Reads what a person typed into a number field. An empty field is "no value".
// "1,5" and "1.5" are decimals; "1.234,5" uses a dot as thousands separator.
// A lone "1.234" is ambiguous (1,234 or 1234?), so it is refused, not guessed.
export function parseDecimal(raw: string): Parsed {
  const v = raw.trim();
  if (v === "") return { ok: true, value: null };
  let normalized: string;
  if (v.includes(",")) {
    if (!/^-?\d{1,3}(\.\d{3})*,\d+$|^-?\d+,\d+$/.test(v)) return { ok: false };
    normalized = v.replace(/\./g, "").replace(",", ".");
  } else if (/^-?\d+(\.\d{1,2})?$/.test(v) || /^-?\d+\.\d{1,2}$/.test(v)) {
    normalized = v;
  } else if (/^-?\d+$/.test(v)) {
    normalized = v;
  } else {
    return { ok: false };
  }
  const n = Number(normalized);
  return Number.isFinite(n) ? { ok: true, value: n } : { ok: false };
}

export const NUMBER_HELP = "Bitte gib Zahlen so ein: 250 oder 1,5.";

// Reads several fields at once; any non-empty field that is not a clear number is an error.
export function parseFields<K extends string>(
  raw: Record<K, string>,
):
  | { ok: true; values: Record<K, number | null> }
  | { ok: false; error: string } {
  const values = {} as Record<K, number | null>;
  for (const key of Object.keys(raw) as K[]) {
    const p = parseDecimal(raw[key]);
    if (!p.ok) return { ok: false, error: NUMBER_HELP };
    values[key] = p.value;
  }
  return { ok: true, values };
}
