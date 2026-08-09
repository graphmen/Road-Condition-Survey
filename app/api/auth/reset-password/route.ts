import { NextResponse } from "next/server";
import {
  authenticateRequest,
  unauthorized,
  forbidden,
} from "@/lib/auth/requestAuth";
import { hashPassword, generateTempPassword } from "@/lib/auth/password";
import {
  findUserById,
  stripSecrets,
  updateUserById,
  isSuperAdmin,
} from "@/lib/auth/usersStore";

/** Master Admin / Super Admin resets another user's password. */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth) return unauthorized();

  const caller = auth.user;
  if (caller.role !== "master_admin" && caller.role !== "ict_admin") {
    return forbidden("Only Master Admin or ICT team can reset passwords.");
  }

  try {
    const body = await request.json();
    const { user_id, new_password } = body;

    if (!user_id) {
      return NextResponse.json({ success: false, error: "user_id is required" }, { status: 400 });
    }

    const target = findUserById(String(user_id));
    if (!target) {
      return NextResponse.json({ success: false, error: "User not found" }, { status: 404 });
    }

    if (target.is_super_admin && !isSuperAdmin(caller)) {
      return forbidden("Only the Super Master Admin can reset this account.");
    }

    if (target.role === "master_admin" && !isSuperAdmin(caller) && caller.role !== "master_admin") {
      return forbidden("Insufficient privileges to reset a Master Admin account.");
    }

    const temp = new_password ? String(new_password) : generateTempPassword();
    if (temp.length < 8) {
      return NextResponse.json(
        { success: false, error: "Password must be at least 8 characters." },
        { status: 400 }
      );
    }

    updateUserById(target.id, {
      password_hash: hashPassword(temp),
      must_change_password: true,
    });

    return NextResponse.json({
      success: true,
      message: "Password reset successfully.",
      user: stripSecrets(findUserById(target.id)!),
      temporary_password: temp,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Reset failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
