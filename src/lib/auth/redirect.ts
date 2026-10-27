// Guards the `next` parameter of login redirects against open-redirect attacks.
// Only same-site absolute paths; everything else falls back to /app.
// Rejected: "//host" (protocol-relative), backslashes (some browsers treat them
// as slashes) and control characters (header injection).
export function safeNext(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\") ||
    /[\x00-\x1f\x7f]/.test(next)
  )
    return "/app";
  return next;
}
