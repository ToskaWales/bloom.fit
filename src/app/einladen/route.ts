import { NextResponse, type NextRequest } from "next/server";
import { normalizeInviteCode } from "@/lib/invites/code";
import { rememberInvite } from "@/lib/invites/cookie";

// Invite link target: remember the code (if it is well-formed), then send the
// visitor to login.
export async function GET(request: NextRequest) {
  const code = normalizeInviteCode(
    request.nextUrl.searchParams.get("code") ?? "",
  );
  const valid = /^[A-Z2-9]{4}(-[A-Z2-9]{4}){3}$/.test(code);
  if (valid) await rememberInvite(code);
  return NextResponse.redirect(
    new URL(valid ? "/login?invited=1" : "/login", request.url),
  );
}
