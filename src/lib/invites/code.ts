import { createHash, randomInt } from "node:crypto";

// No 0/1/I/O to avoid transcription errors.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export function normalizeInviteCode(input: string): string {
  const raw = input.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return raw.match(/.{1,4}/g)?.join("-") ?? "";
}

// Must match the database: encode(sha256(convert_to(code, 'UTF8')), 'hex').
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

export function generateInviteCode(): { code: string; hash: string } {
  const chars = Array.from(
    { length: 16 },
    () => ALPHABET[randomInt(ALPHABET.length)],
  );
  const code = [0, 4, 8, 12]
    .map((i) => chars.slice(i, i + 4).join(""))
    .join("-");
  return { code, hash: hashInviteCode(code) };
}
