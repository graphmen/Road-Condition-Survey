import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UserProfile, UserRole, canProvisionRole } from "@/components/helpers";

const USERS_FILE = path.resolve(process.cwd(), "public", "users-db.json");

// Default initial system users matching all role scopes
const INITIAL_USERS: UserProfile[] = [
  {
    id: "usr-master-1",
    email: "ict.admin@transport.gov.zw",
    full_name: "Eng. T. Masango (Master Admin)",
    phone_number: "+263 77 100 0001",
    role: "master_admin",
    is_active: true,
    must_change_password: false,
  },
  {
    id: "usr-national-1",
    email: "national.coordinator@transport.gov.zw",
    full_name: "Eng. C. Moyo (National Coordinator)",
    phone_number: "+263 77 200 0002",
    role: "national_coordinator",
    is_active: true,
    must_change_password: false,
  },
  {
    id: "usr-provincial-harare",
    email: "harare.coord@transport.gov.zw",
    full_name: "Eng. R. Ndlovu (Harare Provincial Coordinator)",
    phone_number: "+263 77 300 0003",
    role: "provincial_coordinator",
    province: "Harare",
    is_active: true,
    must_change_password: false,
  },
  {
    id: "usr-district-harare",
    email: "harare.district@transport.gov.zw",
    full_name: "Eng. S. Sibanda (Harare Central District Coordinator)",
    phone_number: "+263 77 400 0004",
    role: "district_coordinator",
    province: "Harare",
    district: "Harare",
    is_active: true,
    must_change_password: false,
  },
  {
    id: "usr-collector-1",
    email: "field.surveyor1@transport.gov.zw",
    full_name: "Eng. Z. Chitate (Field Surveyor)",
    phone_number: "+263 77 500 0005",
    role: "data_collector",
    province: "Harare",
    district: "Harare",
    is_active: true,
    must_change_password: false,
  }
];

function getUsersStore(): UserProfile[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error reading users-db.json:", e);
  }
  // Initialize with seed users if file doesn't exist
  fs.writeFileSync(USERS_FILE, JSON.stringify(INITIAL_USERS, null, 2), "utf-8");
  return INITIAL_USERS;
}

function writeUsersStore(users: UserProfile[]): void {
  try {
    fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing users-db.json:", e);
  }
}

/** GET /api/users — List users scoped by caller role */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callerRole = (searchParams.get("role") || "master_admin") as UserRole;
  const callerProvince = searchParams.get("province") || "";
  const callerDistrict = searchParams.get("district") || "";

  const allUsers = getUsersStore();

  // Scoped user list depending on caller role
  let scopedUsers = allUsers;
  if (callerRole === "provincial_coordinator" && callerProvince) {
    scopedUsers = allUsers.filter(u => !u.province || u.province.toLowerCase() === callerProvince.toLowerCase());
  } else if (callerRole === "district_coordinator" && callerDistrict) {
    scopedUsers = allUsers.filter(u => !u.district || u.district.toLowerCase() === callerDistrict.toLowerCase());
  } else if (callerRole === "data_collector") {
    scopedUsers = [];
  }

  return NextResponse.json({ success: true, count: scopedUsers.length, users: scopedUsers });
}

/** POST /api/users — Provision a new account */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { full_name, email, phone_number, role, province, district, creator_role } = body;

    if (!full_name || !email || !role) {
      return NextResponse.json({ success: false, error: "Missing required fields (full_name, email, role)" }, { status: 400 });
    }

    // Role privilege verification
    const creatorUser: UserProfile = {
      id: "creator",
      email: "creator@gov.zw",
      full_name: "Creator",
      role: (creator_role || "master_admin") as UserRole,
      is_active: true,
    };

    if (!canProvisionRole(creatorUser, role as UserRole)) {
      return NextResponse.json({
        success: false,
        error: `Role '${creator_role}' does not have authority to provision account with role '${role}'`
      }, { status: 403 });
    }

    const allUsers = getUsersStore();
    if (allUsers.some(u => u.email.toLowerCase() === email.toLowerCase())) {
      return NextResponse.json({ success: false, error: "User with this email already exists" }, { status: 400 });
    }

    const newUser: UserProfile = {
      id: `usr-${Date.now()}`,
      email: email.trim(),
      full_name: full_name.trim(),
      phone_number: phone_number || "",
      role: role as UserRole,
      province: province || undefined,
      district: district || undefined,
      is_active: true,
      must_change_password: true,
    };

    allUsers.push(newUser);
    writeUsersStore(allUsers);

    return NextResponse.json({ success: true, message: "Account created successfully", user: newUser });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Failed to create user" }, { status: 500 });
  }
}
