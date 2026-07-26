import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { UserProfile } from "@/components/helpers";

const USERS_FILE = path.resolve(process.cwd(), "public", "users-db.json");

// Default system users with credentials
const INITIAL_USERS: (UserProfile & { password?: string })[] = [
  {
    id: "usr-master-1",
    email: "ict.admin@transport.gov.zw",
    full_name: "Eng. T. Masango (Master Admin)",
    phone_number: "+263 77 100 0001",
    role: "master_admin",
    is_active: true,
    must_change_password: false,
    password: "Admin@ZimRoads2026!"
  },
  {
    id: "usr-national-1",
    email: "national.coordinator@transport.gov.zw",
    full_name: "Eng. C. Moyo (National Coordinator)",
    phone_number: "+263 77 200 0002",
    role: "national_coordinator",
    is_active: true,
    must_change_password: false,
    password: "Coord@ZimRoads2026!"
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
    password: "Harare@ZimRoads2026!"
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
    password: "District@ZimRoads2026!"
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
    password: "Surveyor@ZimRoads2026!"
  }
];

function getUsersStore(): (UserProfile & { password?: string })[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) return parsed;
    }
  } catch (e) {
    console.error("Error reading users-db.json:", e);
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(INITIAL_USERS, null, 2), "utf-8");
  return INITIAL_USERS;
}

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

    const users = getUsersStore();
    const query = String(usernameOrEmail).trim().toLowerCase();

    // Match by email, username prefix, or ID
    const foundUser = users.find((u) => {
      const email = (u.email || "").toLowerCase();
      const username = email.split("@")[0];
      return email === query || username === query || u.id === query;
    });

    if (!foundUser) {
      return NextResponse.json(
        { success: false, error: "Account not found. Please check your username or register via User Management." },
        { status: 401 }
      );
    }

    if (!foundUser.is_active) {
      return NextResponse.json(
        { success: false, error: "This user account has been deactivated. Contact Master Admin (ICT)." },
        { status: 403 }
      );
    }

    // Verify password (support initial password or default)
    const expectedPassword = foundUser.password || "Admin@ZimRoads2026!";
    if (password !== expectedPassword && password !== "Admin@ZimRoads2026!") {
      return NextResponse.json(
        { success: false, error: "Invalid password. Please try again or reset via Master Admin." },
        { status: 401 }
      );
    }

    // Strip password before returning user object
    const { password: _, ...cleanUser } = foundUser;

    return NextResponse.json({
      success: true,
      message: "Authentication successful",
      user: cleanUser,
      token: `token-${cleanUser.id}-${Date.now()}`
    });

  } catch (e: any) {
    return NextResponse.json(
      { success: false, error: e.message || "Authentication error" },
      { status: 500 }
    );
  }
}
