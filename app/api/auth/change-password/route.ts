import { NextResponse } from "next/server";
import { authenticateRequest, unauthorized } from "@/lib/auth/requestAuth";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { updateUserById } from "@/lib/auth/usersStore";

export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth) return unauthorized();

  try {
    const body = await request.json();
    const { current_password, new_password } = body;

    if (!current_password || !new_password) {
      return NextResponse.json(
        { success: false, error: "Current and new password are required." },
        { status: 400 }
      );
    }

    if (String(new_password).length < 8) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }

    if (!verifyPassword(String(current_password), auth.stored.password_hash)) {
      return NextResponse.json(
        { success: false, error: "Current password is incorrect." },
        { status: 401 }
      );
    }

    updateUserById(auth.user.id, {
      password_hash: hashPassword(String(new_password)),
      must_change_password: false,
    });

    return NextResponse.json({ success: true, message: "Password updated successfully." });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to change password";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
