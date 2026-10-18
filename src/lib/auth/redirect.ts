// Only same-site absolute paths; everything else falls back to /app.
export function safeNext(next: string | null | undefined): string {
  if (
    !next ||
    !next.startsWith("/") ||
    next.startsWith("//") ||
    next.includes("\\")
  )
    return "/app";
  return next;
}
