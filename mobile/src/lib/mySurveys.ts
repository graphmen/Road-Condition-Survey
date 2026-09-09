import type { SurveyDraft } from "./db";
import type { MobileUserProfile } from "./auth";
import { getRecordId, resolveRecordLocation, type AssetMapLocation } from "./mapLocations";

export type SurveySource = "local_draft" | "local_queued" | "server";

export interface ProgressSurveyItem {
  id: string;
  source: SurveySource;
  asset_category: string;
  road_name: string;
  section_name: string;
  survey_date: string;
  surveyor_name: string;
  status_label: string;
  location: AssetMapLocation | null;
  length_m?: number;
  raw: Record<string, unknown>;
}

function norm(s: string): string {
  return s.trim().toLowerCase();
}

/** Match surveys to the signed-in user (name or email). Ready for future user_id column. */
export function surveyBelongsToUser(record: Record<string, unknown>, user: MobileUserProfile): boolean {
  const uid = record.user_id ? String(record.user_id) : "";
  if (uid && user.id && uid === user.id) return true;

  const surveyor = norm(String(record.surveyor_name || ""));
  const name = norm(user.full_name || "");
  const email = norm(user.email || "");
  const emailLocal = email.split("@")[0] || "";

  if (!surveyor) return false;
  if (name && surveyor === name) return true;
  if (email && surveyor === email) return true;
  if (emailLocal && surveyor === emailLocal) return true;
  if (name && name.length > 3 && (surveyor.includes(name) || name.includes(surveyor))) return true;
  return false;
}

export function localDraftsForUser(drafts: SurveyDraft[], user: MobileUserProfile): ProgressSurveyItem[] {
  return drafts
    .filter((d) => surveyBelongsToUser(d as unknown as Record<string, unknown>, user))
    .map((d) => {
      const raw = d as unknown as Record<string, unknown>;
      return {
        id: d.id,
        source: d.status === "queued" ? "local_queued" : "local_draft",
        asset_category: d.asset_category || "unknown",
        road_name: d.road_name || "",
        section_name: d.section_name || "",
        survey_date: d.survey_date || "",
        surveyor_name: d.surveyor_name || "",
        status_label: d.status === "queued" ? "Queued (local)" : "Draft",
        location: resolveRecordLocation(raw),
        length_m: d.road_segment_length_m,
        raw,
      };
    });
}

export function serverRecordsForUser(records: Record<string, unknown>[], user: MobileUserProfile): ProgressSurveyItem[] {
  return records
    .filter((r) => surveyBelongsToUser(r, user))
    .map((r) => ({
      id: getRecordId(r) || `srv-${String(r.survey_date || "")}-${String(r.road_name || "").slice(0, 12)}`,
      source: "server" as const,
      asset_category: String(r.asset_category || "unknown"),
      road_name: String(r.road_name || ""),
      section_name: String(r.section_name || ""),
      survey_date: String(r.survey_date || r.created_at || ""),
      surveyor_name: String(r.surveyor_name || ""),
      status_label: "Synced",
      location: resolveRecordLocation(r),
      length_m: Number(r.road_segment_length_m || r.segment_length_m) || undefined,
      raw: r,
    }));
}

/** Merge local + server; server wins when same survey id exists locally as queued. */
export function mergeProgressSurveys(local: ProgressSurveyItem[], server: ProgressSurveyItem[]): ProgressSurveyItem[] {
  const byId = new Map<string, ProgressSurveyItem>();
  for (const item of local) {
    if (item.id) byId.set(item.id, item);
  }
  for (const item of server) {
    if (item.id) byId.set(item.id, item);
  }
  return [...byId.values()].sort((a, b) => (b.survey_date || "").localeCompare(a.survey_date || ""));
}

export function summarizeProgress(items: ProgressSurveyItem[]) {
  const byCategory: Record<string, number> = {};
  let withLocation = 0;
  let totalLengthM = 0;
  let points = 0;
  let lines = 0;

  for (const item of items) {
    byCategory[item.asset_category] = (byCategory[item.asset_category] || 0) + 1;
    if (item.location) {
      withLocation += 1;
      if (item.location.kind === "line") lines += 1;
      else points += 1;
    }
    if (item.length_m) totalLengthM += item.length_m;
  }

  return {
    total: items.length,
    withLocation,
    points,
    lines,
    totalLengthKm: Math.round((totalLengthM / 1000) * 100) / 100,
    byCategory,
    localDraft: items.filter((i) => i.source === "local_draft").length,
    localQueued: items.filter((i) => i.source === "local_queued").length,
    synced: items.filter((i) => i.source === "server").length,
  };
}
