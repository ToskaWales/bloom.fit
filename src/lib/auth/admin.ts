// Admin check by email allowlist (env ADMIN_EMAILS, comma separated). Pure
// function; the pages use it through requireAdmin() in ./dal.ts, which also demands a confirmed email.
// Case-insensitive. Closed by default: with no ADMIN_EMAILS nobody is admin.
export function isAdmin(email: string | undefined | null): boolean {
  if (!email) return false;
  const list = (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  return list.includes(email.toLowerCase());
}
