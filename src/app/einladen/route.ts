import { NextResponse, type NextRequest } from "next/server";
import { rememberInvite } from "@/lib/invites/cookie";

// Invite link target: remember the code, then send the visitor to login.
export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  if (code) await rememberInvite(code);
  return NextResponse.redirect(
    new URL(code ? "/login?invited=1" : "/login", request.url),
  );
}
