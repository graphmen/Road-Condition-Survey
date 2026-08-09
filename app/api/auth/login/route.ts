import { NextResponse } from "next/server";
import {
  findUserByEmailOrUsername,
  stripSecrets,
} from "@/lib/auth/usersStore";
import { verifyPassword } from "@/lib/auth/password";
import { createSessionToken } from "@/lib/auth/session";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { usernameOrEmail, password } = body;

    if (!usernameOrEmail || !password) {
      return NextResponse.json(
        { success: false, error: "Please enter both Email/Username and Password" },
        { status: 400 }
      );
    }

    const foundUser = findUserByEmailOrUsername(String(usernameOrEmail));

    if (!foundUser) {
      return NextResponse.json(
        { success: false, error: "Account not found. Contact your Master Admin (ICT) for access." },
        { status: 401 }
      );
    }

    if (!foundUser.is_active) {
      return NextResponse.json(
        { success: false, error: "This account has been deactivated. Contact Master Admin (ICT)." },
        { status: 403 }
      );
    }

    if (!verifyPassword(String(password), foundUser.password_hash)) {
      return NextResponse.json(
        { success: false, error: "Invalid password. Use Forgot Password or contact Master Admin." },
        { status: 401 }
      );
    }

    const cleanUser = stripSecrets(foundUser);
    const token = createSessionToken(cleanUser.id);

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      user: cleanUser,
      token,
      must_change_password: !!cleanUser.must_change_password,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Authentication error";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
