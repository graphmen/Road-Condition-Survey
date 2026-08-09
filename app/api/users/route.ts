import { NextResponse } from "next/server";
import type { UserProfile, UserRole } from "@/components/helpers";
import { canProvisionRole, isSuperAdmin } from "@/components/helpers";
import {
  authenticateRequest,
  unauthorized,
  forbidden,
} from "@/lib/auth/requestAuth";
import {
  generateTempPassword,
  hashPassword,
} from "@/lib/auth/password";
import {
  getUsersStore,
  writeUsersStore,
  stripSecrets,
  provisionableRoles,
  type StoredUser,
} from "@/lib/auth/usersStore";

function scopeUsersForCaller(allUsers: StoredUser[], caller: UserProfile): UserProfile[] {
  let scoped = allUsers.map(stripSecrets);
  if (isSuperAdmin(caller) || caller.role === "master_admin" || caller.role === "ict_admin") {
    return scoped;
  }
  if (caller.role === "provincial_coordinator" && caller.province) {
    scoped = scoped.filter(
      (u) => !u.province || u.province.toLowerCase() === caller.province!.toLowerCase()
    );
  } else if (caller.role === "district_coordinator" && caller.district) {
    scoped = scoped.filter(
      (u) => !u.district || u.district.toLowerCase() === caller.district!.toLowerCase()
    );
  } else if (caller.role === "national_coordinator") {
    return scoped;
  } else {
    scoped = [];
  }
  return scoped;
}

/** GET /api/users — List users (authenticated, scoped) */
export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth) return unauthorized();

  const allUsers = getUsersStore();
  const scopedUsers = scopeUsersForCaller(allUsers, auth.user);

  return NextResponse.json({
    success: true,
    count: scopedUsers.length,
    users: scopedUsers,
    provisionable_roles: provisionableRoles(auth.user),
  });
}

/** POST /api/users — Provision a new account with temporary password */
export async function POST(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth) return unauthorized();

  try {
    const body = await request.json();
    const { full_name, email, phone_number, role, province, district } = body;
    const targetRole = role as UserRole;

    if (!full_name || !email || !targetRole) {
      return NextResponse.json(
        { success: false, error: "Missing required fields (full_name, email, role)" },
        { status: 400 }
      );
    }

    if (!canProvisionRole(auth.user, targetRole)) {
      return NextResponse.json(
        {
          success: false,
          error: `Your role cannot provision accounts with role '${targetRole}'.`,
        },
        { status: 403 }
      );
    }

    if (targetRole === "master_admin" && !isSuperAdmin(auth.user)) {
      return forbidden("Only the Super Master Admin can create Master Admin accounts.");
    }

    if (targetRole === "ict_admin" && !isSuperAdmin(auth.user) && auth.user.role !== "master_admin") {
      return forbidden("Only Master Admin can register ICT team members.");
    }

    const allUsers = getUsersStore();
    if (allUsers.some((u) => u.email.toLowerCase() === String(email).trim().toLowerCase())) {
      return NextResponse.json({ success: false, error: "User with this email already exists" }, { status: 400 });
    }

    const tempPassword = generateTempPassword();
    const newUser: StoredUser = {
      id: `usr-${Date.now()}`,
      email: String(email).trim(),
      full_name: String(full_name).trim(),
      phone_number: phone_number || "",
      role: targetRole,
      province: province || undefined,
      district: district || undefined,
      created_by: auth.user.id,
      is_active: true,
      must_change_password: true,
      is_super_admin: false,
      password_hash: hashPassword(tempPassword),
    };

    allUsers.push(newUser);
    writeUsersStore(allUsers);

    return NextResponse.json({
      success: true,
      message: "Account created successfully",
      user: stripSecrets(newUser),
      temporary_password: tempPassword,
    });
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Failed to create user";
    return NextResponse.json({ success: false, error: msg }, { status: 500 });
  }
}
