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
