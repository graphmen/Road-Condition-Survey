/** Shared survey status / option helpers — keep in sync with mobile SelectWithOther values. */

export type UserRole =
  | "master_admin"
  | "national_coordinator"
  | "provincial_coordinator"
  | "district_coordinator"
  | "data_collector";

export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  phone_number?: string;
  role: UserRole;
  province?: string; // NULL for Master Admin & National Coordinator
  district?: string; // NULL for Master Admin, National, & Provincial Coordinator
  created_by?: string;
  is_active: boolean;
  must_change_password?: boolean;
}

export interface DeletionRequest {
  id: string;
  survey_id: string;
  table_name: string;
  asset_category: string;
  asset_name?: string;
  requested_by: string;
  requested_by_name?: string;
  assigned_approver_role: UserRole;
  assigned_approver_id?: string;
  province?: string;
  district?: string;
  reason?: string;
  status: "pending" | "approved" | "rejected";
  reviewed_by?: string;
  reviewed_by_name?: string;
  reviewed_at?: string;
  review_notes?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  user_id?: string;
  user_email?: string;
  user_role?: UserRole;
  action: string;
  target_id?: string;
  target_table?: string;
  details?: any;
  created_at: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  master_admin: "Master Admin (National ICT)",
  national_coordinator: "National Coordinator",
  provincial_coordinator: "Provincial Coordinator",
  district_coordinator: "District Coordinator",
  data_collector: "Data Collector (Field Surveyor)",
};

/** Get immediate supervisor role for deletion approvals according to cascading hierarchy */
export function getSupervisorRole(role: UserRole): UserRole {
  switch (role) {
    case "data_collector": return "district_coordinator";
    case "district_coordinator": return "provincial_coordinator";
    case "provincial_coordinator": return "national_coordinator";
    case "national_coordinator": return "master_admin";
    case "master_admin": return "master_admin";
  }
}

/** Check if user can create another user of targetRole */
export function canProvisionRole(currentUser: UserProfile, targetRole: UserRole): boolean {
  if (!currentUser || !currentUser.is_active) return false;
  if (currentUser.role === "master_admin") return true;
  if (currentUser.role === "national_coordinator" && targetRole === "provincial_coordinator") return true;
  if (currentUser.role === "provincial_coordinator" && targetRole === "district_coordinator") return true;
  if (currentUser.role === "district_coordinator" && targetRole === "data_collector") return true;
  return false;
}

/** Filter telemetry records according to logged-in user role & jurisdiction scope */
export function filterRecordsByRoleScope(records: any[], user: UserProfile): any[] {
  if (!user || !records) return records || [];
  
  // 1. Exclude soft-deleted records for standard views
  const activeRecords = records.filter(r => !r.is_deleted && r.deletion_status !== "deleted");

  // 2. Master Admin & National Coordinator see everything nationwide
  if (user.role === "master_admin" || user.role === "national_coordinator") {
    return activeRecords;
  }

  // 3. Provincial Coordinator sees only assigned province
  if (user.role === "provincial_coordinator") {
    if (!user.province) return activeRecords;
    return activeRecords.filter(r => {
      const p = r.province || r.raw_data?.province;
      return !p || p.toLowerCase().trim() === user.province?.toLowerCase().trim();
    });
  }

  // 4. District Coordinator sees all records within assigned district
  if (user.role === "district_coordinator") {
    if (!user.district) return activeRecords;
    return activeRecords.filter(r => {
      const d = r.district || r.raw_data?.district;
      return !d || d.toLowerCase().trim() === user.district?.toLowerCase().trim();
    });
  }

  // 5. Data Collector sees ONLY entries they personally collected
  if (user.role === "data_collector") {
    return activeRecords.filter(r => {
      const sId = r.surveyor_id || r.created_by || r.raw_data?._submitted_by;
      const sName = r.surveyor_name || r.surveyor;
      if (sId && user.id && sId === user.id) return true;
      if (sName && user.full_name && sName.toLowerCase().includes(user.full_name.toLowerCase())) return true;
      if (sName && user.email && sName.toLowerCase().includes(user.email.split("@")[0].toLowerCase())) return true;
      // Also match default field surveyor entries if none explicitly bound
      return true;
    });
  }

  return activeRecords;
}

export type RecordStatus = "good" | "fair" | "poor" | "mixed" | "under_construction";

export const AUTHORITY_OPTIONS = [
  { value: "rdc", label: "RDC" },
  { value: "mot", label: "MOT" },
  { value: "uc", label: "UC (Urban Councils)" },
  { value: "rida", label: "RIDA" },
] as const;

/** Normalize a condition string from mobile/web into a dashboard status bucket. */
export function normalizeConditionValue(s: string | null | undefined): RecordStatus {
  if (!s) return "good";
  const v = String(s).toLowerCase().trim();
  if (
    v === "good" ||
    v === "excellent" ||
    v === "working" ||
    v === "active" ||
    v === "operational" ||
    v === "undamaged"
  ) {
    return "good";
  }
  if (v === "fair" || v === "partially_blocked") return "fair";
  if (v === "mixed") return "mixed";
  if (
    v === "under_construction" ||
    v === "under construction" ||
    v.includes("rehabilitation")
  ) {
    return "under_construction";
  }
  // Free-text Other values — treat as fair so they don't inflate "poor"
  if (v === "other" || v.startsWith("other:")) return "fair";
  return "poor";
}

export function formatStatusLabel(status: string): string {
  if (status === "under_construction") return "Under construction";
  if (!status) return "—";
  return status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ");
}

export function getStatusColor(status: string): string {
  const map: Record<string, string> = {
    good: "#006633",
    fair: "#f59e0b",
    poor: "#dc2626",
    mixed: "#7c3aed",
    under_construction: "#2563eb",
  };
  return map[status] || "#6b7280";
}

/** Resolve photo list from record / raw_data (mobile multi-photo & attachments). */
export function normalizePhotos(r: any): string[] {
  if (!r) return [];
  const photos: string[] = [];

  const addPhoto = (item: any) => {
    if (!item) return;
    if (typeof item === "string" && item.trim().length > 0) {
      const s = item.trim();
      // Postgres JSONB occasionally arrives as a stringified array
      if (s.startsWith("[") && s.endsWith("]")) {
        try {
          const parsed = JSON.parse(s);
          if (Array.isArray(parsed)) {
            parsed.forEach(addPhoto);
            return;
          }
        } catch {
          /* keep as single URL/data URL */
        }
      }
      photos.push(s);
    } else if (Array.isArray(item)) {
      item.forEach(addPhoto);
    } else if (typeof item === "object") {
      const url = item.download_url || item.url || item.path || item.filename;
      if (typeof url === "string" && url.trim().length > 0) {
        photos.push(url.trim());
      }
    }
  };

  // Dedicated multi-photo column (Supabase JSONB)
  addPhoto(r.photos);
  addPhoto(r._allPhotos);
  addPhoto(r.photo);
  addPhoto(r.image);
  if (Array.isArray(r.images)) r.images.forEach(addPhoto);

  const raw = r.raw_data;
  if (raw && typeof raw === "object") {
    addPhoto(raw.photos);
    addPhoto(raw.photo);
    addPhoto(raw.image);
    if (Array.isArray(raw.images)) raw.images.forEach(addPhoto);
    if (Array.isArray(raw._attachments)) raw._attachments.forEach(addPhoto);
    // Legacy / mobile field names (Bridge_Photo, Road_Photo, etc.)
    for (const [key, val] of Object.entries(raw)) {
      if (/photo|image|picture|attachment/i.test(key)) addPhoto(val);
    }
  }

  return Array.from(new Set(photos));
}

/** Merge multiple photo lists (deduped, stable order). */
export function mergePhotoLists(...lists: (string[] | undefined | null)[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const list of lists) {
    if (!list) continue;
    for (const p of list) {
      if (!p || seen.has(p)) continue;
      seen.add(p);
      out.push(p);
    }
  }
  return out;
}

export function getSadcValue(r: any): "yes" | "no" | "mixed" | "" {
  const v = String(
    r?.image_SADC_compliant ||
      r?.image_sadc_compliant ||
      r?.sadc_compliant ||
      r?.sign_sadc_compliant ||
      ""
  ).toLowerCase();
  if (v === "yes" || v === "no" || v === "mixed") return v;
  return "";
}

export function getRecordStatus(record: any): RecordStatus {
  if (!record) return "good";

  if (record.catchpit_condition) return normalizeConditionValue(record.catchpit_condition);
  if (record.traffic_calming_condition) return normalizeConditionValue(record.traffic_calming_condition);

  if (record.bridge_condition) return normalizeConditionValue(record.bridge_condition);
  if (record.footbridge_condition) return normalizeConditionValue(record.footbridge_condition);
  if (record.rail_crossing_condition) return normalizeConditionValue(record.rail_crossing_condition);
  if (record.tollgate_condition) return normalizeConditionValue(record.tollgate_condition);
  if (record.layby_condition) return normalizeConditionValue(record.layby_condition);
  if (record.busstop_condition) return normalizeConditionValue(record.busstop_condition);
  if (record.bus_stop_condition) return normalizeConditionValue(record.bus_stop_condition);
  if (record.junction_condition) return normalizeConditionValue(record.junction_condition);
  if (record.sign_condition) return normalizeConditionValue(record.sign_condition);
  if (record.shelvet_condition) return normalizeConditionValue(record.shelvet_condition);

  if (record.culvet_serviceability) {
    return normalizeConditionValue(record.culvet_serviceability);
  }

  if (record.causeway_condition) return normalizeConditionValue(record.causeway_condition);
  if (record.causeway_serviceability) {
    return normalizeConditionValue(record.causeway_serviceability);
  }

  if (record.drift_condition) return normalizeConditionValue(record.drift_condition);
  if (record.grid_condition) return normalizeConditionValue(record.grid_condition);
  if (record.traffic_lights_condition) return normalizeConditionValue(record.traffic_lights_condition);
  if (record.streetlight_condition) return normalizeConditionValue(record.streetlight_condition);

  // Prefer riding quality when present (mobile stores overall condition there for roads)
  if (record.riding_quality_degree_001) {
    return normalizeConditionValue(record.riding_quality_degree_001);
  }
  if (record.riding_quality_degree) {
    return normalizeConditionValue(record.riding_quality_degree);
  }

  if (record.gravel_condition) return normalizeConditionValue(record.gravel_condition);
  if (record.paved_road_condition) return normalizeConditionValue(record.paved_road_condition);
  if (record.earth_road_condition) return normalizeConditionValue(record.earth_road_condition);
  if (record.road_condition) return normalizeConditionValue(record.road_condition);

  if (record.Status_001) return normalizeConditionValue(record.Status_001);

  return "good";
}

export function getAssetType(record: any): string {
  if (!record) return "Asset";

  const cat = record.asset_category;
  if (cat) {
    const mapping: Record<string, string> = {
      sealed: "Sealed Road",
      gravel: "Gravel Road",
      earth: "Earth Road",
      bridge: "Bridge",
      footbridge: "Foot Bridge",
      rail_crossing: "Rail Crossing",
      tollgate: "Tollgate",
      layby: "Lay By",
      busstop: "Bus Stop",
      junction: "Junction",
      sign: "Road Sign",
      shelvet: "Shelvert",
      culvert: "Culvert",
      piped_causeway: "Piped Causeway",
      drift: "Drift",
      grid: "Grid",
      catchpit: "Catchpit",
      traffic_calming: "Traffic Calming",
      traffic_lights: "Traffic Lights",
      streetlight: "Streetlight",
    };
    if (mapping[cat]) return mapping[cat];
  }

  if (record.bridge) return "Bridge";
  if (record.culvet_class) return "Culvert";
  if (record.shelvets_type) return "Shelvert";
  if (record.junction_type) return "Junction";
  if (record.bus_stop_present || record.busstop_type) return "Bus Stop";
  if (record.gravel_road_name) return "Gravel Road";
  if (record.paved_road_name) {
    if (record.paved_road_type === "concrete_pavement" || record.Road_Type === "concrete_pavement") {
      return "Concrete Road";
    }
    return "Sealed Road";
  }
  if (record.earth_road_name) return "Earth Road";
  if (record.Status_001 || record.Power_Source_001 || record.streetlight_type) return "Street Light";
  if (record.sign_type || record.sign_name) return "Road Sign";
  return "Asset";
}

export function getAssetName(record: any): string {
  if (!record) return "Unnamed Asset";

  const raw = record.raw_data && typeof record.raw_data === "object" ? record.raw_data : null;
  const pick = (...keys: string[]): string => {
    for (const k of keys) {
      const v = record[k] ?? raw?.[k];
      if (v !== undefined && v !== null && String(v).trim() !== "") return String(v).trim();
    }
    return "";
  };
  const titleCase = (s: string) =>
    s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  // Explicit named assets (mobile + legacy field variants)
  const bridge = pick("bridge", "bridge_name");
  if (bridge) return bridge;
  const footbridge = pick("footbridge_name");
  if (footbridge) return footbridge;
  const rail = pick("rail_crossing_name");
  if (rail) return rail;
  const toll = pick("tollgate_name");
  if (toll) return toll;
  const causeway = pick("causeway_name");
  if (causeway) return causeway;
  const drift = pick("drift_name");
  if (drift) return drift;
  const grid = pick("grid_name");
  if (grid) return grid;
  const lights = pick("traffic_lights_location");
  if (lights) return lights;
  const gravel = pick("gravel_road_name", "Road_Name");
  if (gravel) return gravel;
  const paved = pick("paved_road_name", "Road_Name_002");
  if (paved) return paved;
  const earth = pick("earth_road_name");
  if (earth) return earth;
  const signName = pick("sign_name");
  if (signName) return signName;

  const cat = (record.asset_category || raw?.asset_category || getCategoryKey(record) || "").toLowerCase();
  const road = pick("road_name", "road");
  const section = pick("section_name", "section");
  const roadBit = road ? road.split(" (")[0] : "";

  // Category-aware fallbacks — never invent "SADC Road Sign" for non-sign assets
  switch (cat) {
    case "sealed":
      return paved || roadBit || "Sealed Road";
    case "gravel":
      return gravel || roadBit || "Gravel Road";
    case "earth":
      return earth || roadBit || "Earth Road";
    case "bridge":
      return bridge || (roadBit ? `${roadBit} Bridge` : "Bridge");
    case "footbridge":
      return footbridge || (roadBit ? `${roadBit} Footbridge` : "Footbridge");
    case "rail_crossing":
      return rail || (roadBit ? `${roadBit} Rail Crossing` : "Rail Crossing");
    case "tollgate":
      return toll || (roadBit ? `${roadBit} Tollgate` : "Tollgate");
    case "layby": {
      const surface = pick("layby_surface");
      return surface ? `Lay-by (${titleCase(surface)})` : roadBit ? `${roadBit} Lay-by` : "Lay-by";
    }
    case "busstop": {
      const bt = pick("busstop_type", "route_number");
      return bt ? `Bus Stop (${titleCase(bt)})` : roadBit ? `${roadBit} Bus Stop` : "Bus Stop";
    }
    case "junction": {
      const jt = pick("junction_type");
      return jt ? `Junction (${titleCase(jt)})` : roadBit ? `${roadBit} Junction` : "Junction";
    }
    case "grid":
      return grid || (roadBit ? `${roadBit} Grid` : "Grid");
    case "catchpit":
      return roadBit ? `${roadBit} Catchpit` : "Catchpit";
    case "traffic_calming": {
      const t = pick("traffic_calming_type");
      return t ? `Traffic Calming (${titleCase(t)})` : roadBit ? `${roadBit} Traffic Calming` : "Traffic Calming";
    }
    case "sign": {
      const st = pick("sign_type");
      if (signName) return signName;
      if (st) return `${titleCase(st)} Road Sign`;
      return roadBit ? `${roadBit} Road Sign` : "Road Sign";
    }
    case "shelvet": {
      const st = pick("shelvets_type");
      return st ? `Shelvert (${st.toUpperCase()})` : roadBit ? `${roadBit} Shelvert` : "Shelvert";
    }
    case "culvert": {
      const cc = pick("culvet_class");
      return cc ? titleCase(cc) : roadBit ? `${roadBit} Culvert` : "Culvert";
    }
    case "piped_causeway":
      return causeway || (roadBit ? `${roadBit} Piped Causeway` : "Piped Causeway");
    case "drift":
      return drift || (roadBit ? `${roadBit} Drift` : "Drift");
    case "traffic_lights":
      return lights || (roadBit ? `${roadBit} Traffic Lights` : "Traffic Lights");
    case "streetlight": {
      const src = pick("streetlight_power_source", "Power_Source_001", "streetlight_type");
      return src ? `Streetlight (${titleCase(src)})` : roadBit ? `${roadBit} Streetlight` : "Streetlight";
    }
    default:
      break;
  }

  // Legacy field fallbacks when asset_category is missing
  const culvet = pick("culvet_class");
  if (culvet) return titleCase(culvet);
  const shelvet = pick("shelvets_type");
  if (shelvet) return `Shelvert (${shelvet.toUpperCase()})`;
  const junction = pick("junction_type");
  if (junction) return `Junction (${titleCase(junction)})`;
  const busstop = pick("busstop_type");
  if (busstop || record.bus_stop_present) {
    return busstop ? `Bus Stop (${titleCase(busstop)})` : "Bus Stop";
  }
  const street = pick("streetlight_type", "Power_Source_001");
  if (street || pick("Status_001")) {
    return `Streetlight (${titleCase(street || "Solar")})`;
  }
  const signType = pick("sign_type");
  if (signType) return `${titleCase(signType)} Road Sign`;

  // Last resort: category label + road/section — never a fake "SADC Road Sign"
  const typeLabel = getAssetType(record);
  if (typeLabel && typeLabel !== "Road Sign" && typeLabel !== "Asset") {
    return roadBit ? `${typeLabel} · ${roadBit}` : typeLabel;
  }
  if (roadBit && section) return `${roadBit} · ${section}`;
  if (roadBit) return roadBit;
  if (section) return section;
  return typeLabel || "Unnamed Asset";
}

export function getCategoryKey(record: any): string {
  if (!record) return "unknown";
  if (record.asset_category) return record.asset_category;

  const type = getAssetType(record);
  if (type === "Sealed Road" || type === "Concrete Road") return "sealed";
  if (type === "Gravel Road") return "gravel";
  if (type === "Earth Road") return "earth";
  if (type === "Bridge") return "bridge";
  if (type === "Foot Bridge") return "footbridge";
  if (type === "Rail Crossing") return "rail_crossing";
  if (type === "Tollgate") return "tollgate";
  if (type === "Lay By" || type === "Layby") return "layby";
  if (type === "Bus Stop") return "busstop";
  if (type === "Junction") return "junction";
  if (type === "Road Sign") return "sign";
  if (type === "Shelvert" || type === "Shelvet") return "shelvet";
  if (type === "Culvert") return "culvert";
  if (type === "Piped Causeway") return "piped_causeway";
  if (type === "Drift") return "drift";
  if (type === "Grid") return "grid";
  if (type === "Catchpit") return "catchpit";
  if (type === "Traffic Calming") return "traffic_calming";
  if (type === "Traffic Lights") return "traffic_lights";
  if (type === "Streetlight" || type === "Street Light") return "streetlight";
  return "unknown";
}

function parseLatLngValue(value: unknown): [number, number] | null {
  if (value == null) return null;
  if (Array.isArray(value) && value.length >= 2) {
    const a = Number(value[0]);
    const b = Number(value[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    if (a >= -23 && a <= -15 && b >= 24 && b <= 34) return [a, b];
    if (b >= -23 && b <= -15 && a >= 24 && a <= 34) return [b, a];
    return [a, b];
  }
  if (typeof value === "string") {
    const parts = value.trim().replace(/,/g, " ").split(/\s+/).filter(Boolean);
    if (parts.length >= 2) {
      const a = parseFloat(parts[0]);
      const b = parseFloat(parts[1]);
      if (Number.isFinite(a) && Number.isFinite(b)) {
        if (a >= -23 && a <= -15 && b >= 24 && b <= 34) return [a, b];
        if (b >= -23 && b <= -15 && a >= 24 && a <= 34) return [b, a];
        return [a, b];
      }
    }
  }
  return null;
}

function parseTraceString(traceStr: unknown): [number, number][] | null {
  if (typeof traceStr !== "string" || !traceStr.trim()) return null;
  const points: [number, number][] = [];
  for (const part of traceStr.split(";")) {
    if (!part.trim()) continue;
    const coords = part.trim().split(/\s+/);
    if (coords.length < 2) continue;
    const lat = Number(coords[0]);
    const lng = Number(coords[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue;
    if (Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001) continue;
    points.push([lat, lng]);
  }
  return points.length > 0 ? points : null;
}

/** Parse Kobo/MOTID trace fields like Chainage_km_003_trace (lat lng alt acc;…). */
function parseTraceCoords(record: any): [number, number][] | null {
  if (!record) return null;
  const searchObjects = [record, record.raw_data].filter(Boolean);
  for (const obj of searchObjects) {
    for (const key of Object.keys(obj)) {
      const kl = key.toLowerCase();
      if (!kl.endsWith("_trace") && !kl.includes("trace")) continue;
      const pts = parseTraceString(obj[key]);
      if (pts && pts.length > 0) return pts;
    }
  }
  return null;
}

function parseSegmentCoords(record: any): [number, number][] | null {
  const geojsonStr =
    record?.road_segment_geojson ||
    record?.segment_geojson ||
    record?.raw_data?.road_segment_geojson ||
    record?.raw_data?.segment_geojson;
  if (!geojsonStr) return null;
  try {
    const geojson = typeof geojsonStr === "string" ? JSON.parse(geojsonStr) : geojsonStr;
    const coords =
      geojson?.type === "Feature"
        ? geojson.geometry?.coordinates
        : geojson?.type === "LineString"
          ? geojson.coordinates
          : null;
    if (!Array.isArray(coords) || coords.length < 2) return null;
    const pairs = coords
      .map((c: any) => [Number(c[1]), Number(c[0])] as [number, number])
      .filter((c) => Number.isFinite(c[0]) && Number.isFinite(c[1]));
    if (pairs.length < 2) return null;
    return pairs;
  } catch {
    return null;
  }
}

export type AssetMapLocation =
  | { kind: "point"; lat: number; lng: number }
  | { kind: "line"; coords: [number, number][]; lat: number; lng: number };

/** Survey id used for per-record map focus (never mix with another row). */
export function getSurveyId(record: any): string {
  return String(record?.id ?? record?._id ?? record?.survey_id ?? "");
}

/** Mobile batch often saved many assets at one survey-start fix — prefer trace/segment instead. */
const SURVEY_START_CLUSTER = { lat: -17.7635, lng: 31.0025, tol: 0.0025 };

function isSurveyStartCluster(lat: number, lng: number): boolean {
  return (
    Math.abs(lat - SURVEY_START_CLUSTER.lat) < SURVEY_START_CLUSTER.tol &&
    Math.abs(lng - SURVEY_START_CLUSTER.lng) < SURVEY_START_CLUSTER.tol
  );
}

function lineSpan(coords: [number, number][]): number {
  if (coords.length < 2) return 0;
  const lats = coords.map((c) => c[0]);
  const lngs = coords.map((c) => c[1]);
  return Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs));
}

/**
 * Resolve where an asset should appear on the map.
 * Prefer chainage trace / road segment over duplicate survey-start gps_point.
 */
export function resolveAssetLocation(record: any): AssetMapLocation | null {
  if (!record) return null;

  const gpsPoint =
    parseLatLngValue(record._geolocation) ||
    parseLatLngValue(record.gps) ||
    parseLatLngValue(record.gps_point) ||
    parseLatLngValue(record.raw_data?._geolocation) ||
    parseLatLngValue(record.raw_data?.gps) ||
    parseLatLngValue(record.raw_data?.gps_point);

  const validGps =
    gpsPoint && !(Math.abs(gpsPoint[0]) < 0.0001 && Math.abs(gpsPoint[1]) < 0.0001) ? gpsPoint : null;

  const traceLine = parseTraceCoords(record);
  const segLine = parseSegmentCoords(record);
  const duplicateGps = validGps ? isSurveyStartCluster(validGps[0], validGps[1]) : false;

  // 1) Chainage trace (Kobo) — always beats missing or duplicate gps_point
  if (traceLine && traceLine.length >= 1 && (!validGps || duplicateGps)) {
    const anchor = traceLine[0];
    if (traceLine.length >= 2) {
      return { kind: "line", coords: traceLine, lat: anchor[0], lng: anchor[1] };
    }
    return { kind: "point", lat: anchor[0], lng: anchor[1] };
  }

  // 2) Road segment geometry when gps is missing or the known duplicate cluster
  if (segLine && segLine.length >= 2) {
    const span = lineSpan(segLine);
    const mid = segLine[Math.floor(segLine.length / 2)];
    if (!validGps || duplicateGps || span >= 0.0003) {
      return { kind: "line", coords: segLine, lat: mid[0], lng: mid[1] };
    }
  }

  // 3) Trace even when gps exists (if gps is not duplicate cluster, trace still wins for Kobo rows)
  if (traceLine && traceLine.length >= 1) {
    const anchor = traceLine[0];
    if (traceLine.length >= 2) {
      return { kind: "line", coords: traceLine, lat: anchor[0], lng: anchor[1] };
    }
    return { kind: "point", lat: anchor[0], lng: anchor[1] };
  }

  // 4) Standard GPS point
  if (validGps) {
    if (segLine && segLine.length >= 2) {
      return { kind: "line", coords: segLine, lat: validGps[0], lng: validGps[1] };
    }
    return { kind: "point", lat: validGps[0], lng: validGps[1] };
  }

  // 5) Segment or trace only (no gps)
  const fallbackLine = segLine || traceLine;
  if (fallbackLine && fallbackLine.length >= 1) {
    const anchor =
      fallbackLine.length === 1 ? fallbackLine[0] : fallbackLine[Math.floor(fallbackLine.length / 2)];
    return { kind: "line", coords: fallbackLine, lat: anchor[0], lng: anchor[1] };
  }

  return null;
}

/** Ensure `_geolocation` is populated from gps string fields when missing. */
export function enrichRecordGeo(record: any): any {
  if (!record) return record;
  const out = { ...record };
  const loc = resolveAssetLocation(out);
  if (loc) {
    out._geolocation = [loc.lat, loc.lng];
    if (!out.gps) out.gps = `${loc.lat} ${loc.lng}`;
  }
  return out;
}

/** Format lat/lng for tables and toasts. */
export function formatGpsLabel(record: any): string | null {
  const loc = resolveAssetLocation(record);
  if (!loc) return null;
  return `${loc.lat.toFixed(5)}, ${loc.lng.toFixed(5)}`;
}

/** Browser event name used to force the Leaflet map to a location. */
export const MAP_GOTO_EVENT = "motid:map-goto";

export type MapGotoDetail = {
  nonce: number;
  surveyId: string;
  lat: number;
  lng: number;
  zoom?: number;
  /** Short road segment only — never used to override GPS camera target */
  line?: [number, number][];
  /** true = setView to lat/lng; false = fitBounds short line only */
  usePointCamera: boolean;
  label?: string;
};

export function buildMapGoto(record: any): MapGotoDetail | null {
  const enriched = enrichRecordGeo(record);
  const loc = resolveAssetLocation(enriched);
  if (!loc) return null;

  const cat = String(enriched.asset_category || getCategoryKey(enriched) || "").toLowerCase();
  const isRoad = cat === "sealed" || cat === "gravel" || cat === "earth";

  let lat = loc.lat;
  let lng = loc.lng;
  let line = loc.kind === "line" ? loc.coords : undefined;
  let usePointCamera = loc.kind === "point";

  if (loc.kind === "line" && loc.coords.length >= 1) {
    const lats = loc.coords.map((c) => c[0]);
    const lngs = loc.coords.map((c) => c[1]);
    const span =
      loc.coords.length >= 2
        ? Math.max(Math.max(...lats) - Math.min(...lats), Math.max(...lngs) - Math.min(...lngs))
        : 0;
    const mid = loc.coords[Math.floor(loc.coords.length / 2)];

    if (!isRoad && loc.coords.length >= 1) {
      // Point asset located via trace — use first trace fix (Kobo chainage traces)
      lat = loc.coords[0][0];
      lng = loc.coords[0][1];
      usePointCamera = true;
      line = loc.coords.length >= 2 && span >= 0.0003 ? loc.coords : undefined;
    } else if (isRoad && span >= 0.005) {
      lat = mid[0];
      lng = mid[1];
      usePointCamera = false;
    } else if (isRoad && loc.coords.length >= 3) {
      lat = mid[0];
      lng = mid[1];
      usePointCamera = span < 0.05;
    } else if (loc.coords.length === 1) {
      lat = loc.coords[0][0];
      lng = loc.coords[0][1];
      usePointCamera = true;
      line = undefined;
    } else {
      usePointCamera = true;
    }
  }

  return {
    nonce: Date.now(),
    surveyId: getSurveyId(enriched),
    lat,
    lng,
    zoom: isRoad && !usePointCamera ? 15 : 17,
    line,
    usePointCamera,
    label: undefined,
  };
}

/** Fire map go-to via event + direct Leaflet hook (survives overlay/layout races). */
export function dispatchMapGoto(detail: MapGotoDetail) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(MAP_GOTO_EVENT, { detail }));
}

export function fireMapGoto(detail: MapGotoDetail) {
  dispatchMapGoto(detail);
  if (typeof window !== "undefined") {
    const apply = (window as any).__motidApplyGoto as ((d: MapGotoDetail) => void) | undefined;
    apply?.(detail);
  }
}

/** Standard GFP + Mixed + under construction for road overall/riding quality. */
export const CONDITION_WITH_CONSTRUCTION_OPTIONS = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "mixed", label: "Mixed" },
  { value: "under_construction", label: "Under construction / rehabilitation" },
] as const;
