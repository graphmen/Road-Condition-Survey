import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { DeletionRequest, UserRole, getSupervisorRole } from "@/components/helpers";

const DELETIONS_FILE = path.resolve(process.cwd(), "public", "deletions-db.json");
const AUDIT_FILE = path.resolve(process.cwd(), "public", "audit-logs.json");

function getDeletionsStore(): DeletionRequest[] {
  try {
    if (fs.existsSync(DELETIONS_FILE)) {
      const data = fs.readFileSync(DELETIONS_FILE, "utf-8");
      const parsed = JSON.parse(data);
      if (Array.isArray(parsed)) return parsed;
    }
  } catch (e) {
    console.error("Error reading deletions-db.json:", e);
  }
  return [];
}

function writeDeletionsStore(items: DeletionRequest[]): void {
  try {
    fs.writeFileSync(DELETIONS_FILE, JSON.stringify(items, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing deletions-db.json:", e);
  }
}

function appendAuditLog(log: any): void {
  try {
    let logs: any[] = [];
    if (fs.existsSync(AUDIT_FILE)) {
      const data = fs.readFileSync(AUDIT_FILE, "utf-8");
      logs = JSON.parse(data);
    }
    logs.unshift({ id: `log-${Date.now()}`, ...log, created_at: new Date().toISOString() });
    fs.writeFileSync(AUDIT_FILE, JSON.stringify(logs.slice(0, 500), null, 2), "utf-8");
  } catch (e) {
    console.error("Error appending audit log:", e);
  }
}

/** GET /api/deletions — List deletion requests assigned to caller role/jurisdiction */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const callerRole = (searchParams.get("role") || "master_admin") as UserRole;
  const callerProvince = searchParams.get("province") || "";
  const callerDistrict = searchParams.get("district") || "";

  const allRequests = getDeletionsStore();

  // Filter requests that fall under caller's supervisor approval scope
  const scopedRequests = allRequests.filter(r => {
    if (r.status !== "pending") return true; // Show historical reviewed too
    
    // Master Admin sees all pending requests assigned to master_admin
    if (callerRole === "master_admin") return true;
    
    // National Coordinator sees requests assigned to national_coordinator
    if (callerRole === "national_coordinator") return r.assigned_approver_role === "national_coordinator";

    // Provincial Coordinator sees requests in their assigned province
    if (callerRole === "provincial_coordinator") {
      if (r.assigned_approver_role !== "provincial_coordinator") return false;
      return !callerProvince || !r.province || r.province.toLowerCase() === callerProvince.toLowerCase();
    }

    // District Coordinator sees requests in their assigned district
    if (callerRole === "district_coordinator") {
      if (r.assigned_approver_role !== "district_coordinator") return false;
      return !callerDistrict || !r.district || r.district.toLowerCase() === callerDistrict.toLowerCase();
    }

    return false;
  });

  return NextResponse.json({ success: true, count: scopedRequests.length, requests: scopedRequests });
}

/** POST /api/deletions — Submit a new deletion request or review an existing request */
export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { action } = body;

    // Action A: Request Deletion
    if (action === "request_deletion") {
      const {
        survey_id, table_name, asset_category, asset_name,
        requested_by, requested_by_name, user_role, province, district, reason
      } = body;

      if (!survey_id || !user_role) {
        return NextResponse.json({ success: false, error: "Missing survey_id or user_role" }, { status: 400 });
      }

      const assigned_approver_role = getSupervisorRole(user_role as UserRole);

      const newRequest: DeletionRequest = {
        id: `del-${Date.now()}`,
        survey_id,
        table_name: table_name || "road_surveys",
        asset_category: asset_category || "unknown",
        asset_name: asset_name || survey_id,
        requested_by: requested_by || "usr-current",
        requested_by_name: requested_by_name || "Field User",
        assigned_approver_role,
        province: province || undefined,
        district: district || undefined,
        reason: reason || "Field defect error / duplicate entry",
        status: "pending",
        created_at: new Date().toISOString()
      };

      const store = getDeletionsStore();
      store.unshift(newRequest);
      writeDeletionsStore(store);

      appendAuditLog({
        user_id: requested_by,
        user_role,
        action: "DELETION_REQUESTED",
        target_id: survey_id,
        target_table: table_name,
        details: { reason, assigned_approver_role }
      });

      return NextResponse.json({
        success: true,
        message: `Deletion request submitted. Escalated to ${assigned_approver_role.replace(/_/g, " ")} for review.`,
        request: newRequest
      });
    }

    // Action B: Review (Approve / Reject) Deletion
    if (action === "review_deletion") {
      const { request_id, reviewer_id, reviewer_name, reviewer_role, decision, review_notes } = body;

      if (!request_id || !decision || !["approved", "rejected"].includes(decision)) {
        return NextResponse.json({ success: false, error: "Missing request_id or valid decision" }, { status: 400 });
      }

      const store = getDeletionsStore();
      const target = store.find(r => r.id === request_id);

      if (!target) {
        return NextResponse.json({ success: false, error: "Deletion request not found" }, { status: 404 });
      }

      target.status = decision;
      target.reviewed_by = reviewer_id || "usr-reviewer";
      target.reviewed_by_name = reviewer_name || "Supervisor";
      target.reviewed_at = new Date().toISOString();
      target.review_notes = review_notes || "";

      writeDeletionsStore(store);

      appendAuditLog({
        user_id: reviewer_id,
        user_role: reviewer_role,
        action: decision === "approved" ? "DELETION_APPROVED" : "DELETION_REJECTED",
        target_id: target.survey_id,
        target_table: target.table_name,
        details: { decision, review_notes }
      });

      return NextResponse.json({
        success: true,
        message: `Deletion request ${decision} successfully.`,
        request: target
      });
    }

    return NextResponse.json({ success: false, error: "Invalid action" }, { status: 400 });
  } catch (e: any) {
    return NextResponse.json({ success: false, error: e.message || "Failed to process request" }, { status: 500 });
  }
}
