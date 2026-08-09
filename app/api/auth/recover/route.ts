import { NextResponse } from "next/server";
import { hashPassword } from "@/lib/auth/password";
import {
  findUserByEmailOrUsername,
  updateUserById,
} from "@/lib/auth/usersStore";

const RECOVERY_KEY =
  process.env.MASTER_RECOVERY_KEY || "ZimRoads-Master-Recovery-2026";

/**
 * Emergency recovery when Super Master Admin forgot password.
 * Requires recovery key + registered super-admin email.
 */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { email, recovery_key, new_password } = body;

    if (!email || !recovery_key || !new_password) {
      return NextResponse.json(
        { success: false, error: "Email, recovery key, and new password are required." },
        { status: 400 }
      );
    }

    if (String(recovery_key) !== RECOVERY_KEY) {
      return NextResponse.json(
        { success: false, error: "Invalid recovery key." },
        { status: 403 }
      );
    }

    if (String(new_password).length < 8) {
      return NextResponse.json(
        { success: false, error: "New password must be at least 8 characters." },
        { status: 400 }
      );
    }

    const user = findUserByEmailOrUsername(String(email));
    if (!user || !user.is_super_admin) {
      return NextResponse.json(
        { success: false, error: "Super Master Admin account not found for this email." },
        { status: 404 }
      );
    }

    updateUserById(user.id, {
      password_hash: hashPassword(String(new_password)),
      must_change_password: false,
    });

    return NextResponse.json({
      success: true,
      message: "Super Master Admin password recovered. Sign in with your new password.",
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Recovery failed";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
