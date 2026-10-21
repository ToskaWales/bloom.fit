// Barcodes are digits only, so they can never smuggle anything into a URL.

export const cleanBarcode = (raw: string) => raw.trim().replace(/[\s-]/g, "");

// EAN-8, UPC-A (12), EAN-13 and GTIN-14 with the GS1 check digit.
export function isValidBarcode(code: string): boolean {
  if (!/^\d+$/.test(code) || ![8, 12, 13, 14].includes(code.length))
    return false;
  const digits = [...code].map(Number);
  const check = digits.pop() as number;
  const sum = digits
    .reverse()
    .reduce((s, d, i) => s + d * (i % 2 === 0 ? 3 : 1), 0);
  return (10 - (sum % 10)) % 10 === check;
}

// One product can be read as UPC-A (12 digits), EAN-13 or GTIN-14 with leading
// zeros. Everything is stored and looked up as the 13-digit form (EAN-8 stays 8).
export function normaliseBarcode(code: string): string | null {
  if (!isValidBarcode(code)) return null;
  if (code.length === 12) return `0${code}`;
  if (code.length === 14) return code.startsWith("0") ? code.slice(1) : code;
  return code;
}
