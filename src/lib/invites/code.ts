// Invite codes (format XXXX-XXXX-XXXX-XXXX): generation, normalisation of typed
// input, and hashing. Only the hash is stored in the database (invites.code_hash);
// redemption itself is the SQL function redeem_invite, see ./cookie.ts.
import { createHash, randomInt } from "node:crypto";

// No 0/1/I/O to avoid transcription errors.
const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

// Accepts any case, spaces or missing dashes and returns the canonical dashed form.
export function normalizeInviteCode(input: string): string {
  const raw = input.replace(/[^a-z0-9]/gi, "").toUpperCase();
  return raw.match(/.{1,4}/g)?.join("-") ?? "";
}

// Must match the database: encode(sha256(convert_to(code, 'UTF8')), 'hex').
export function hashInviteCode(code: string): string {
  return createHash("sha256").update(code, "utf8").digest("hex");
}

// 16 random characters from a typo-safe alphabet via crypto randomInt; returns the code (for the person) and its hash (for the database).
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
