// POST /api/sync: the offline-first sync endpoint (push local changes, pull
// remote ones). Signed-in users only; rows are written through the user's own
// Supabase session, so RLS limits every read/write to their own data.
// Security order: content type, then auth check, then size caps (1 MB), then
// schema validation. Never logs row contents because they are health data.
// Route handler (not a server action) because the client sync loop (lib/sync/client.ts) calls it with fetch.
import { runSync, SyncRequestError } from "@/lib/sync/server";
import { supabaseSyncDb } from "@/lib/sync/supabase-db";
import { syncRequestSchema } from "@/lib/sync/tables";
import { createClient } from "@/lib/supabase/server";

// Hard cap on request size so one client cannot make the server buffer huge payloads.
const MAX_BODY_BYTES = 1_000_000;

export async function POST(request: Request) {
  if (!request.headers.get("content-type")?.startsWith("application/json")) {
    return Response.json({ error: "unsupported" }, { status: 415 });
  }
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user)
    return Response.json({ error: "unauthorized" }, { status: 401 });

  // Check the declared length first (cheap), then the real length, because the
  // Content-Length header can be missing or wrong.
  const declared = Number(request.headers.get("content-length") ?? 0);
  if (declared > MAX_BODY_BYTES)
    return Response.json({ error: "too large" }, { status: 413 });
  const text = await request.text();
  if (Buffer.byteLength(text) > MAX_BODY_BYTES)
    return Response.json({ error: "too large" }, { status: 413 });

  let parsed;
  try {
    parsed = syncRequestSchema.safeParse(JSON.parse(text));
  } catch {
    return Response.json({ error: "bad request" }, { status: 400 });
  }
  if (!parsed.success)
    return Response.json({ error: "bad request" }, { status: 400 });

  try {
    const result = await runSync(
      supabaseSyncDb(supabase),
      data.user.id,
      parsed.data,
    );
    return Response.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (err) {
    if (err instanceof SyncRequestError)
      return Response.json({ error: err.message }, { status: 400 });
    // Message only: rows can contain health data and must not reach the logs.
    console.error(
      "sync failed:",
      err instanceof Error ? err.message : "unknown",
    );
    return Response.json({ error: "sync failed" }, { status: 500 });
  }
}
