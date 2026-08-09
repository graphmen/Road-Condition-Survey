import { NextResponse } from "next/server";
import { verifySessionToken } from "./session";
import { findUserById, stripSecrets, type StoredUser } from "./usersStore";
import type { UserProfile } from "@/components/helpers";

export function getBearerToken(request: Request): string | null {
  const auth = request.headers.get("authorization") || request.headers.get("Authorization");
  if (!auth) return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

export function authenticateRequest(request: Request): {
  user: UserProfile;
  stored: StoredUser;
} | null {
  const token = getBearerToken(request);
  const userId = verifySessionToken(token);
  if (!userId) return null;
  const stored = findUserById(userId);
  if (!stored || !stored.is_active) return null;
  return { user: stripSecrets(stored), stored };
}

export function unauthorized(message = "Authentication required") {
  return NextResponse.json({ success: false, error: message }, { status: 401 });
}

export function forbidden(message = "Access denied") {
  return NextResponse.json({ success: false, error: message }, { status: 403 });
}
