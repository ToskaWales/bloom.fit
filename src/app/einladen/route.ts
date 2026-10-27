// GET /einladen?code=...: target of the invite link in the invite email.
// Public (the visitor has no account yet). It only stores a well-formed code
// in a cookie and redirects to /login; the code is checked and used later,
// after sign-in (redeem_invite in the database). Nothing is read or written here.
import { NextResponse, type NextRequest } from "next/server";
import { normalizeInviteCode } from "@/lib/invites/code";
import { rememberInvite } from "@/lib/invites/cookie";

// Invite link target: remember the code (if it is well-formed), then send the
// visitor to login.
export async function GET(request: NextRequest) {
  const code = normalizeInviteCode(
    request.nextUrl.searchParams.get("code") ?? "",
  );
  // Format check only (no database lookup), so this URL cannot be used to
  // find out which codes exist.
  const valid = /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(code);
  if (valid) await rememberInvite(code);
  return NextResponse.redirect(
    new URL(valid ? "/login?invited=1" : "/login", request.url),
  );
}
