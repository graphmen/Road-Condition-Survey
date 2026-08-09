import { NextResponse } from "next/server";
import { authenticateRequest, unauthorized } from "@/lib/auth/requestAuth";

export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth) return unauthorized("Session expired. Please sign in again.");
  return NextResponse.json({ success: true, user: auth.user });
}
