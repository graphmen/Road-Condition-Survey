import fs from "fs";
import path from "path";
import type { UserProfile, UserRole } from "@/components/helpers";
import { hashPassword } from "./password";

export type StoredUser = UserProfile & {
  password_hash?: string;
  /** Legacy plaintext — migrated on read */
  password?: string;
};

const USERS_FILE = path.resolve(process.cwd(), "public", "users-db.json");

const DEFAULT_PASSWORDS: Record<string, string> = {
  "ict.admin@transport.gov.zw": "Admin@ZimRoads2026!",
  "national.coordinator@transport.gov.zw": "Coord@ZimRoads2026!",
  "harare.coord@transport.gov.zw": "Harare@ZimRoads2026!",
  "harare.district@transport.gov.zw": "District@ZimRoads2026!",
  "field.surveyor1@transport.gov.zw": "Surveyor@ZimRoads2026!",
  "hurungwetrees@gmail.com": "Master@ZimRoads2026!",
};

export const INITIAL_USERS: StoredUser[] = [
  {
    id: "usr-super-1",
    email: "hurungwetrees@gmail.com",
    full_name: "Manuel Ndebele (Super Master Admin)",
    phone_number: "+263773807928",
    role: "master_admin",
    is_active: true,
    is_super_admin: true,
    must_change_password: false,
    password_hash: hashPassword("Master@ZimRoads2026!"),
  },
  {
    id: "usr-master-1",
    email: "ict.admin@transport.gov.zw",
    full_name: "Eng. T. Masango (Master Admin)",
    phone_number: "+263 77 100 0001",
    role: "master_admin",
    is_active: true,
    must_change_password: false,
    password_hash: hashPassword("Admin@ZimRoads2026!"),
  },
  {
    id: "usr-national-1",
    email: "national.coordinator@transport.gov.zw",
    full_name: "Eng. C. Moyo (National Coordinator)",
    phone_number: "+263 77 200 0002",
    role: "national_coordinator",
    is_active: true,
    must_change_password: false,
    password_hash: hashPassword("Coord@ZimRoads2026!"),
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
    password_hash: hashPassword("Harare@ZimRoads2026!"),
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
    password_hash: hashPassword("District@ZimRoads2026!"),
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
    password_hash: hashPassword("Surveyor@ZimRoads2026!"),
  },
];

function migrateUserPasswords(users: StoredUser[]): StoredUser[] {
  let changed = false;
  const migrated = users.map((u) => {
    let next = { ...u };
    if (next.email.toLowerCase() === "hurungwetrees@gmail.com") {
      next = {
        ...next,
        role: "master_admin",
        is_super_admin: true,
        full_name: next.full_name.includes("Super") ? next.full_name : `${next.full_name} (Super Master Admin)`,
      };
      changed = true;
    }
    if (next.password_hash) {
      delete next.password;
      return next;
    }
    const plain =
      next.password ||
      DEFAULT_PASSWORDS[(next.email || "").toLowerCase()] ||
      "Admin@ZimRoads2026!";
    next.password_hash = hashPassword(plain);
    delete next.password;
    changed = true;
    return next;
  });
  if (changed) writeUsersStore(migrated);
  return migrated;
}

export function getUsersStore(): StoredUser[] {
  try {
    if (fs.existsSync(USERS_FILE)) {
      const data = fs.readFileSync(USERS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return migrateUserPasswords(parsed);
      }
    }
  } catch (e) {
    console.error("Error reading users-db.json:", e);
  }
  fs.writeFileSync(USERS_FILE, JSON.stringify(INITIAL_USERS, null, 2), "utf-8");
  return INITIAL_USERS;
}

export function writeUsersStore(users: StoredUser[]): void {
  const sanitized = users.map(({ password_hash, password: _p, ...rest }) => ({
    ...rest,
    password_hash,
  }));
  fs.writeFileSync(USERS_FILE, JSON.stringify(sanitized, null, 2), "utf-8");
}

export function findUserById(id: string): StoredUser | undefined {
  return getUsersStore().find((u) => u.id === id);
}

export function findUserByEmailOrUsername(query: string): StoredUser | undefined {
  const q = query.trim().toLowerCase();
  return getUsersStore().find((u) => {
    const email = (u.email || "").toLowerCase();
    const username = email.split("@")[0];
    return email === q || username === q || u.id === q;
  });
}

export function stripSecrets(user: StoredUser): UserProfile {
  const { password_hash: _h, password: _p, ...clean } = user;
  return clean;
}

export function updateUserById(
  id: string,
  patch: Partial<StoredUser>
): StoredUser | null {
  const users = getUsersStore();
  const idx = users.findIndex((u) => u.id === id);
  if (idx === -1) return null;
  users[idx] = { ...users[idx], ...patch };
  writeUsersStore(users);
  return users[idx];
}

export function isSuperAdmin(user: UserProfile | StoredUser | undefined): boolean {
  return !!user && user.role === "master_admin" && !!(user as UserProfile).is_super_admin;
}

/** Roles the caller may provision. */
export function provisionableRoles(caller: UserProfile): UserRole[] {
  if (isSuperAdmin(caller) || caller.role === "master_admin") {
    return [
      "master_admin",
      "ict_admin",
      "national_coordinator",
      "provincial_coordinator",
      "district_coordinator",
      "data_collector",
    ];
  }
  if (caller.role === "ict_admin") {
    return [
      "national_coordinator",
      "provincial_coordinator",
      "district_coordinator",
      "data_collector",
    ];
  }
  if (caller.role === "national_coordinator") return ["provincial_coordinator"];
  if (caller.role === "provincial_coordinator") return ["district_coordinator"];
  if (caller.role === "district_coordinator") return ["data_collector"];
  return [];
}
