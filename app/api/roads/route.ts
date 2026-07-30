import { NextResponse } from "next/server";
import roadsData from "@/public/roads-data.json";
import { mergePhotoLists, normalizePhotos } from "@/components/helpers";
import fs from "fs";
import path from "path";

export const dynamic = "force-dynamic";

// Corporate SSL inspection breaks Node's default CA trust for Supabase HTTPS.
// Without this, /api/roads silently falls back to local cache and live point surveys vanish.
if (process.env.NODE_TLS_REJECT_UNAUTHORIZED !== "0") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

const OFFLINE_MODE = process.env.OFFLINE_MODE === "true"; // Defaults to false (online)
const BACKEND_URL = process.env.BACKEND_URL || "http://localhost:8000";

const HIGHWAYS: Record<string, [number, number][]> = {
  "A1 Highway (Harare - Chirundu)": [
    [-17.8292, 31.0522],  // Harare
    [-17.3606, 30.2014],  // Chinhoyi
    [-16.8833, 29.6167],  // Karoi
    [-16.0392, 28.8475]   // Chirundu
  ],
  "A2 Highway (Harare - Nyamapanda)": [
    [-17.8292, 31.0522],  // Harare
    [-17.4333, 32.2167],  // Mutoko
    [-16.9667, 32.8500]   // Nyamapanda
  ],
  "A3 Highway (Harare - Bulawayo)": [
    [-17.8292, 31.0522],  // Harare
    [-18.0833, 30.4500],  // Chegutu
    [-18.9167, 29.8167],  // Kwekwe
    [-19.4500, 29.8167],  // Gweru
    [-20.1500, 28.5833]   // Bulawayo
  ],
  "A4 Highway (Harare - Masvingo - Beitbridge)": [
    [-17.8292, 31.0522],  // Harare
    [-19.0167, 30.8833],  // Chivhu
    [-20.0833, 30.8333],  // Masvingo
    [-22.2178, 30.0000]   // Beitbridge
  ],
  "A5 Highway (Harare - Mutare)": [
    [-17.8292, 31.0522],  // Harare
    [-18.1833, 31.5500],  // Marondera
    [-18.5333, 32.1167],  // Rusape
    [-18.9667, 32.6333]   // Mutare
  ]
};

function pointToSegmentDistance(px: number, py: number, x1: number, y1: number, x2: number, y2: number): number {
  const dx = x2 - x1;
  const dy = y2 - y1;
  if (dx === 0 && dy === 0) {
    return Math.sqrt((px - x1) ** 2 + (py - y1) ** 2);
  }
  let t = ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  const closestX = x1 + t * dx;
  const closestY = y1 + t * dy;
  return Math.sqrt((px - closestX) ** 2 + (py - closestY) ** 2);
}

function pointToPathDistance(px: number, py: number, path: [number, number][]): number {
  let minDistance = Infinity;
  for (let i = 0; i < path.length - 1; i++) {
    const dist = pointToSegmentDistance(px, py, path[i][0], path[i][1], path[i + 1][0], path[i + 1][1]);
    if (dist < minDistance) {
      minDistance = dist;
    }
  }
  return minDistance;
}

function classifyHighway(lat: number | null | undefined, lng: number | null | undefined): string {
  if (lat === null || lat === undefined || lng === null || lng === undefined || isNaN(lat) || isNaN(lng)) {
    return "A4 Highway (Harare - Masvingo - Beitbridge)";
  }
  let minDistance = Infinity;
  let bestHighway = "A4 Highway (Harare - Masvingo - Beitbridge)";
  for (const [name, path] of Object.entries(HIGHWAYS)) {
    const dist = pointToPathDistance(lat, lng, path);
    if (dist < minDistance) {
      minDistance = dist;
      bestHighway = name;
    }
  }
  return bestHighway;
}

interface ZimLocation {
  name: string;
  province: string;
  district: string;
  lat: number;
  lng: number;
}

const ZIM_LOCATIONS: ZimLocation[] = [
  { name: "Harare", province: "Harare", district: "Harare", lat: -17.8292, lng: 31.0522 },
  { name: "Chinhoyi", province: "Mashonaland West", district: "Makonde", lat: -17.3606, lng: 30.2014 },
  { name: "Karoi", province: "Mashonaland West", district: "Hurungwe", lat: -16.8833, lng: 29.6167 },
  { name: "Chirundu", province: "Mashonaland West", district: "Hurungwe", lat: -16.0392, lng: 28.8475 },
  { name: "Mutoko", province: "Mashonaland East", district: "Mutoko", lat: -17.4333, lng: 32.2167 },
  { name: "Nyamapanda", province: "Mashonaland East", district: "Mudzi", lat: -16.9667, lng: 32.8500 },
  { name: "Chegutu", province: "Mashonaland West", district: "Chegutu", lat: -18.0833, lng: 30.4500 },
  { name: "Kadoma", province: "Mashonaland West", district: "Sanyati", lat: -18.3333, lng: 29.9167 },
  { name: "Kwekwe", province: "Midlands", district: "Kwekwe", lat: -18.9167, lng: 29.8167 },
  { name: "Gweru", province: "Midlands", district: "Gweru", lat: -19.4500, lng: 29.8167 },
  { name: "Bulawayo", province: "Bulawayo", district: "Bulawayo", lat: -20.1500, lng: 28.5833 },
  { name: "Chivhu", province: "Mashonaland East", district: "Chikomba", lat: -19.0167, lng: 30.8833 },
  { name: "Mvuma", province: "Midlands", district: "Chirumhanzu", lat: -19.2792, lng: 30.2045 },
  { name: "Masvingo", province: "Masvingo", district: "Masvingo", lat: -20.0833, lng: 30.8333 },
  { name: "Beitbridge", province: "Matabeleland South", district: "Beitbridge", lat: -22.2178, lng: 30.0000 },
  { name: "Marondera", province: "Mashonaland East", district: "Marondera", lat: -18.1833, lng: 31.5500 },
  { name: "Rusape", province: "Mashonaland East", district: "Makoni", lat: -18.5333, lng: 32.1167 },
  { name: "Mutare", province: "Manicaland", district: "Mutare", lat: -18.9667, lng: 32.6333 }
];

function classifyProvinceDistrict(lat: number | null | undefined, lng: number | null | undefined): { province: string; district: string } {
  if (lat === null || lat === undefined || lng === null || lng === undefined || isNaN(lat) || isNaN(lng)) {
    return { province: "Harare", district: "Harare" };
  }
  let minDistance = Infinity;
  let bestLoc = ZIM_LOCATIONS[0];
  for (const loc of ZIM_LOCATIONS) {
    const dist = Math.sqrt((lat - loc.lat) ** 2 + (lng - loc.lng) ** 2);
    if (dist < minDistance) {
      minDistance = dist;
      bestLoc = loc;
    }
  }
  return { province: bestLoc.province, district: bestLoc.district };
}

/** Parse lat/lng from gps string, array, GeoJSON point, or WKT-ish forms. */
function parseLatLng(value: unknown): [number, number] | null {
  if (value == null) return null;

  if (Array.isArray(value) && value.length >= 2) {
    const a = Number(value[0]);
    const b = Number(value[1]);
    if (!Number.isFinite(a) || !Number.isFinite(b)) return null;
    // Prefer [lat, lng] when first value looks like Zimbabwe latitude
    if (a >= -23 && a <= -15 && b >= 24 && b <= 34) return [a, b];
    if (b >= -23 && b <= -15 && a >= 24 && a <= 34) return [b, a];
    // Fallback: treat as [lat, lng]
    return [a, b];
  }

  if (typeof value === "object") {
    const obj = value as Record<string, unknown>;
    if (obj.type === "Point" && Array.isArray(obj.coordinates) && obj.coordinates.length >= 2) {
      const lng = Number(obj.coordinates[0]);
      const lat = Number(obj.coordinates[1]);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }
    if (obj.lat != null && (obj.lng != null || obj.lon != null)) {
      const lat = Number(obj.lat);
      const lng = Number(obj.lng ?? obj.lon);
      if (Number.isFinite(lat) && Number.isFinite(lng)) return [lat, lng];
    }
  }

  if (typeof value === "string") {
    const trimmed = value.trim();
    if (!trimmed) return null;
    // "lat lng ..." or "lat,lng"
    const parts = trimmed.replace(/,/g, " ").split(/\s+/).filter(Boolean);
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

/** Midpoint of a LineString segment so road rows without gps_point still map. */
function midpointFromSegment(geojsonVal: unknown): [number, number] | null {
  try {
    const geo = typeof geojsonVal === "string" ? JSON.parse(geojsonVal) : geojsonVal;
    if (!geo || typeof geo !== "object") return null;
    const coords =
      (geo as any).type === "Feature"
        ? (geo as any).geometry?.coordinates
        : (geo as any).type === "LineString"
          ? (geo as any).coordinates
          : null;
    if (!Array.isArray(coords) || coords.length === 0) return null;
    const mid = coords[Math.floor(coords.length / 2)];
    if (!Array.isArray(mid) || mid.length < 2) return null;
    const lng = Number(mid[0]);
    const lat = Number(mid[1]);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
    return [lat, lng];
  } catch {
    return null;
  }
}

/** First valid lat/lng from Kobo trace strings (Chainage_km_003_trace, etc.). */
function pointFromTrace(record: any): [number, number] | null {
  const searchObjects = [record, record?.raw_data].filter(Boolean);
  for (const obj of searchObjects) {
    for (const key of Object.keys(obj)) {
      const kl = key.toLowerCase();
      if (!kl.endsWith("_trace") && !kl.includes("trace")) continue;
      const traceStr = obj[key];
      if (typeof traceStr !== "string" || !traceStr.trim()) continue;
      for (const part of traceStr.split(";")) {
        if (!part.trim()) continue;
        const coords = part.trim().split(/\s+/);
        if (coords.length < 2) continue;
        const lat = parseFloat(coords[0]);
        const lng = parseFloat(coords[1]);
        if (Number.isFinite(lat) && Number.isFinite(lng) && !(Math.abs(lat) < 0.0001 && Math.abs(lng) < 0.0001)) {
          return [lat, lng];
        }
      }
    }
  }
  return null;
}

function normaliseRecord(record: any) {
  const out: any = {};
  for (const [k, v] of Object.entries(record)) {
    out[k] = v;
    if (k.includes("/") && !k.startsWith("_")) {
      const short = k.split("/").pop()!;
      if (!(short in out)) out[short] = v;
    }
  }

  const raw = out.raw_data && typeof out.raw_data === "object" ? out.raw_data : null;
  const geoCandidates = [
    out._geolocation,
    out.gps,
    out.gps_point,
    out.geom_point,
    raw?._geolocation,
    raw?.gps,
    raw?.gps_point,
  ];
  let parsed: [number, number] | null = null;
  for (const c of geoCandidates) {
    parsed = parseLatLng(c);
    if (parsed) break;
  }
  if (!parsed) {
    parsed = midpointFromSegment(
      out.road_segment_geojson || out.segment_geojson || raw?.road_segment_geojson || raw?.segment_geojson
    );
  }
  if (!parsed) {
    parsed = pointFromTrace(out) || (raw ? pointFromTrace(raw) : null);
  }
  // If gps_point is the known mobile batch duplicate, prefer trace when available
  if (parsed && pointFromTrace(out)) {
    const tracePt = pointFromTrace(out) || (raw ? pointFromTrace(raw) : null);
    if (
      tracePt &&
      Math.abs(parsed[0] + 17.7635) < 0.0025 &&
      Math.abs(parsed[1] - 31.0025) < 0.0025 &&
      (Math.abs(tracePt[0] - parsed[0]) > 0.001 || Math.abs(tracePt[1] - parsed[1]) > 0.001)
    ) {
      parsed = tracePt;
    }
  }
  if (parsed) {
    out._geolocation = parsed;
    if (!out.gps) out.gps = `${parsed[0]} ${parsed[1]}`;
  }

  if (!out.road_name && out.road) out.road_name = out.road;
  if (!out.section_name && out.section) out.section_name = out.section;
  if (!out.surveyor_name && out.surveyor) out.surveyor_name = out.surveyor;
  if (!out.survey_date && out.date) out.survey_date = out.date;

  // Infer asset_category for legacy Kobo / incomplete rows
  if (!out.asset_category) {
    out.asset_category = inferAssetCategory(out);
  }

  // Classify province and district if not already set
  if (!out.province || !out.district) {
    const geo = out._geolocation;
    if (geo && geo.length >= 2 && geo[0] !== null && geo[0] !== undefined && geo[1] !== null && geo[1] !== undefined) {
      const { province, district } = classifyProvinceDistrict(geo[0], geo[1]);
      if (!out.province) out.province = province;
      if (!out.district) out.district = district;
    } else {
      if (!out.province) out.province = "Harare";
      if (!out.district) out.district = "Harare";
    }
  }

  // Normalize multi-photo fields from every source (column, raw_data, legacy)
  const allPhotos = normalizePhotos(out);
  if (allPhotos.length > 0) {
    out.photos = allPhotos;
    out.photo = allPhotos[0];
    out._allPhotos = allPhotos;
  } else if (out.photo && (!out.photos || out.photos.length === 0)) {
    out.photos = [out.photo];
  }

  return out;
}

function flattenAndNormaliseRecords(rawSubmissions: any[]): any[] {
  const flatRecords: any[] = [];

  for (const r of rawSubmissions) {
    const section = r.section;
    const hasRepeats = Object.keys(r).some((k) => k.startsWith("repeat_"));

    if (!section || !hasRepeats) {
      flatRecords.push(normaliseRecord(r));
      continue;
    }

    let repeatKey = "";
    if (section === "bridge") repeatKey = "repeat_bridges";
    else if (section === "culvet") repeatKey = "repeat_culvets";
    else if (section === "rsign") repeatKey = "repeat_road_sign";
    else if (section === "bstop") repeatKey = "repeat_bus_stop";
    else if (section === "gv") repeatKey = "repeat_gravel";
    else if (section === "jxn") repeatKey = "repeat_junction";
    else if (section === "sl") repeatKey = "repeat_group_ub9az10";
    else if (section === "sr") repeatKey = "repeat_group_ui4fh40";

    const items = r[repeatKey] || [];
    if (!items.length) {
      continue;
    }

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];
      const flat: any = {};
      const submissionId = r._id;
      flat._id = `${submissionId}_${section}_${idx}`;

      // Metadata
      flat.survey_date = (r._submission_time || "").split("T")[0];
      const submittedBy = r._submitted_by || "zingsa";
      flat.surveyor_name = `Eng. ${submittedBy.charAt(0).toUpperCase() + submittedBy.slice(1)}`;
      flat.section_name = "Main Highway Section";
      flat.vegetation = "none";
      flat.image_SADC_compliant = "yes";

      // GPS
      let gpsVal: string | null = null;
      for (const [ik, iv] of Object.entries(item)) {
        if (["location", "coordinates", "road_sign_001", "Mark_Location"].some((x) => ik.includes(x))) {
          gpsVal = iv as string;
          break;
        }
      }

      if (gpsVal) {
        flat.gps = gpsVal;
        const parts = gpsVal.split(" ");
        if (parts.length >= 2) {
          try {
            const lat = parseFloat(parts[0]);
            const lng = parseFloat(parts[1]);
            flat._geolocation = [lat, lng];
            flat.road_name = classifyHighway(lat, lng);
          } catch (e) {}
        }
      }

      if (!flat.road_name) {
        for (const [ik, iv] of Object.entries(item)) {
          if (["Road_Name", "Road_Name_001", "Road_Name_002"].some((x) => ik.includes(x))) {
            flat.road_name = iv;
            break;
          }
        }
        if (!flat.road_name) {
          flat.road_name = "A4 Highway (Harare - Masvingo - Beitbridge)";
        }
      }

      // Copy short keys
      for (const [ik, iv] of Object.entries(item)) {
        const shortKey = ik.split("/").pop()!;
        if (!["location", "coordinates", "road_sign_001", "Mark_Location"].some((x) => shortKey.includes(x))) {
          flat[shortKey] = iv;
        }
      }

      // Map conditional fields
      if (section === "bridge") {
        flat.bridge = flat.bridge || "Bridge Structure";
        const btype = flat.btype;
        if (btype === "single_lane") flat.bridge_type = "slc";
        else if (btype === "high_level") flat.bridge_type = "hldc";
        else flat.bridge_type = btype || "hldc";

        const parapetVal = flat.parapet;
        if (parapetVal === "no") flat.parapet = "undamaged";
        else if (parapetVal === "yes") flat.parapet = "damaged";
        else flat.parapet = parapetVal || "undamaged";

        const chem = flat.chemical_effect;
        if (chem === "fair") flat.chemical_effect = "mild";
        else if (chem === "poor") flat.chemical_effect = "severe";
        else flat.chemical_effect = chem || "none";

        flat.bridge_joints = flat.bridge_joints || "good";
        flat.bearings_state = flat.bearings_state || "good";
        flat.bridge_crossing = flat.crossing || "river";

        const drain = flat.drainage;
        if (drain === "poor") flat.drainage = "clogged";
        else flat.drainage = drain || "good";

        const conds = [flat.bridge_joints, flat.bearings_state, flat.drainage];
        if (conds.includes("poor") || conds.includes("clogged")) {
          flat.bridge_condition = "poor";
        } else if (conds.includes("fair")) {
          flat.bridge_condition = "fair";
        } else {
          flat.bridge_condition = "good";
        }
      } else if (section === "culvet") {
        const cclass = flat.culvet_class;
        if (cclass === "pipe") flat.culvet_class = "pipe_culvert";
        else if (cclass === "box") flat.culvet_class = "box_culvert";
        else flat.culvet_class = cclass || "pipe_culvert";
        flat.culvet_type = flat.culvet_type || "concrete";
        flat.culvet_serviceability = flat.culvet_serviceability || "good";
      } else if (section === "rsign") {
        flat.image_SADC_compliant = flat.sadc_compliant || "yes";
        flat.sign_condition = flat.Condition || "good";
        flat.sign_name = flat.Signage_Name || "SADC Sign";
      } else if (section === "jxn") {
        flat.junction_type = flat.What_is_the_type_of_junction || "t_junction";
        flat.junction_condition = flat.junction_condition || "good";
        flat.kerbs = flat.Kerbs || "no";
        flat.junction_sign = flat.junction_sign || "no";
      } else if (section === "bstop") {
        flat.bus_stop_present = flat.bus_stop_present || "yes";
        flat.bus_stop_condition = flat.Condition_001 || "good";
        flat.route_number = flat.Route_number_010 || "";
      } else if (section === "gv") {
        flat.gravel_road_name = flat.Road_Name || "Gravel Road Segment";
        flat.gravel_road_class = flat.Road_Class || "urban_collector";
        flat.gravel_thickness = flat.Gravel_Thickness_mm || "";
        flat.gravel_condition = flat.Riding_Quality_degree || "good";
        flat.drainage_condition = flat.Drainage_condition || "good";
        flat.vegetation = flat.servitude_vegetation || "none";
      } else if (section === "sr") {
        flat.paved_road_name = flat.Road_Name_002 || "Paved Road Segment";
        flat.paved_road_class = flat.Road_Class_002 || "secondary";
        flat.paved_road_type = flat.Road_Type || "";
        flat.paved_road_condition = flat.Riding_quality_degree_001 || "good";
        flat.pothole_patches = flat.Pothole_patches_degree || "none";
        flat.vegetation = flat.servitude_vegetation_001 || "none";
      }

      // Ensure province/district classification for repeat group records
      if (!flat.province || !flat.district) {
        const geo = flat._geolocation;
        if (geo && geo.length >= 2 && geo[0] !== null && geo[0] !== undefined && geo[1] !== null && geo[1] !== undefined) {
          const { province, district } = classifyProvinceDistrict(geo[0], geo[1]);
          if (!flat.province) flat.province = province;
          if (!flat.district) flat.district = district;
        } else {
          if (!flat.province && r.province) flat.province = r.province;
          if (!flat.district && r.district) flat.district = r.district;
        }
      }

      // Final fallback if still missing
      if (!flat.province) flat.province = "Harare";
      if (!flat.district) flat.district = "Harare";

      flatRecords.push(normaliseRecord(flat));
    }
  }

  return flatRecords;
}

function getLocalCache() {
  try {
    const cachePath = path.resolve(process.cwd(), "public", "roads-data.json");
    if (fs.existsSync(cachePath)) {
      const fileContent = fs.readFileSync(cachePath, "utf-8");
      const json = JSON.parse(fileContent);
      const records = flattenAndNormaliseRecords(json.records || []);
      return {
        count: records.length,
        records: records,
        fallback: true
      };
    }
  } catch (e) {
    console.error("Error reading local cache dynamically:", e);
  }
  // Fallback to static import if file read fails
  const json = roadsData as any;
  const records = flattenAndNormaliseRecords(json.records || []);
  return {
    count: records.length,
    records: records,
    fallback: true
  };
}

function loadLocalFallback() {
  return getLocalCache();
}

/** Infer category from fields or legacy Kobo-style ids (..._rsign_0, ..._jxn_0, ...). */
function inferAssetCategory(record: any): string {
  if (record?.asset_category) return record.asset_category;
  const id = String(record?._id || record?.id || "");
  const idMatch = id.match(/_(rsign|jxn|bstop|bridge|culvet|culvert|gv|sr|sl|shelvet|fb|rail|toll|layby|drift|grid|tl|causeway)_/i);
  if (idMatch) {
    const map: Record<string, string> = {
      rsign: "sign", jxn: "junction", bstop: "busstop", bridge: "bridge",
      culvet: "culvert", culvert: "culvert", gv: "gravel", sr: "sealed",
      sl: "streetlight", shelvet: "shelvet", fb: "footbridge", rail: "rail_crossing",
      toll: "tollgate", layby: "layby", drift: "drift", grid: "grid",
      tl: "traffic_lights", causeway: "piped_causeway",
    };
    if (map[idMatch[1].toLowerCase()]) return map[idMatch[1].toLowerCase()];
  }
  if (record.bridge || record.bridge_condition) return "bridge";
  if (record.footbridge_name) return "footbridge";
  if (record.rail_crossing_name) return "rail_crossing";
  if (record.tollgate_name) return "tollgate";
  if (record.layby_condition || record.layby_surface) return "layby";
  if (record.busstop_type || record.bus_stop_present) return "busstop";
  if (record.junction_type || record.junction_condition) return "junction";
  if (record.sign_type || record.sign_condition || record.sign_name) return "sign";
  if (record.shelvets_type || record.shelvet_condition) return "shelvet";
  if (record.culvet_class || record.culvet_serviceability) return "culvert";
  if (record.causeway_name) return "piped_causeway";
  if (record.drift_name || record.drift_condition) return "drift";
  if (record.grid_name || record.grid_condition) return "grid";
  if (record.catchpit_condition) return "catchpit";
  if (record.traffic_calming_type || record.traffic_calming_condition) return "traffic_calming";
  if (record.traffic_lights_location || record.traffic_lights_condition) return "traffic_lights";
  if (record.streetlight_type || record.streetlight_condition || record.Status_001) return "streetlight";
  if (record.gravel_road_name || record.gravel_condition) return "gravel";
  if (record.earth_road_name || record.earth_road_condition) return "earth";
  if (record.paved_road_name || record.paved_road_condition || record.road_segment_geojson) return "sealed";
  return "unknown";
}

const SUPABASE_URL = "https://kchmhpwmyubesocdssga.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_XVL14JBx0YdcbqXlUEsN7w_8xhPeA4W";
const FIREBASE_PROJECT = "road-condition-survey";
const FIREBASE_DB = "road-condition-survey";

/** Build photo column + slim raw_data (photos live in `photos`, not duplicated in raw_data). */
const RAW_DATA_OMIT = new Set([
  "photo", "photos",
  "road_segment_points", "road_segment_geojson",
  "road_segment_length_m", "road_segment_start_time", "road_segment_end_time",
  "road_segment_avg_accuracy_m", "road_segment_point_count",
]);

function buildPhotoPayload(draft: any): { photo: string | null; photos: string[]; raw_data: any } {
  const photos = normalizePhotos(draft);
  const raw_data =
    draft && typeof draft === "object"
      ? Object.fromEntries(
          Object.entries(draft).filter(([k]) => !RAW_DATA_OMIT.has(k))
        )
      : draft;
  return {
    photo: photos[0] || null,
    photos,
    raw_data,
  };
}

const SUPABASE_WRITE_HEADERS: Record<string, string> = {
  "Content-Type": "application/json",
  "apikey": SUPABASE_ANON_KEY,
  "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
  "Prefer": "return=minimal,resolution=merge-duplicates",
};

const categoryToTable: Record<string, string> = {
  sealed: "survey_sealed_roads",
  gravel: "survey_gravel_roads",
  earth: "survey_earth_roads",
  bridge: "survey_bridges",
  footbridge: "survey_footbridges",
  rail_crossing: "survey_rail_crossings",
  tollgate: "survey_tollgates",
  layby: "survey_laybys",
  busstop: "survey_busstops",
  junction: "survey_junctions",
  sign: "survey_road_signs",
  shelvet: "survey_shelvets",
  culvert: "survey_culverts",
  piped_causeway: "survey_piped_causeways",
  drift: "survey_drifts",
  grid: "survey_grids",
  catchpit: "survey_catchpits",
  traffic_calming: "survey_traffic_calming",
  traffic_lights: "survey_traffic_lights",
  streetlight: "survey_streetlights"
};

const mapDraftToSupabaseTable = (draft: any, tableName: string) => {
  const photoPayload = buildPhotoPayload(draft);
  const row: any = {
    survey_id:            draft.id || draft._id,
    asset_category:       draft.asset_category || Object.keys(categoryToTable).find(k => categoryToTable[k] === tableName) || null,
    road_name:            draft.road_name || null,
    section_name:         draft.section_name || null,
    surveyor_name:        draft.surveyor_name || null,
    survey_date:          draft.survey_date || null,
    gps_point:            draft.gps || draft.gps_point || null,
    image_sadc_compliant: draft.image_SADC_compliant || draft.image_sadc_compliant || "yes",
    photo:                photoPayload.photo,
    photos:               photoPayload.photos.length > 0 ? photoPayload.photos : null,
    raw_data:             photoPayload.raw_data,
    source:               draft.source || "dashboard"
  };

  const isRoadTable = tableName === "survey_sealed_roads" || tableName === "survey_gravel_roads" || tableName === "survey_earth_roads";

  if (isRoadTable) {
    row.segment_geojson = draft.road_segment_geojson || null;
    row.segment_length_m = draft.road_segment_length_m || null;
    row.segment_point_count = draft.road_segment_point_count || null;
    row.segment_avg_accuracy = draft.road_segment_avg_accuracy_m || null;
    row.segment_start_time = draft.road_segment_start_time || null;
    row.segment_end_time = draft.road_segment_end_time || null;
  }

  if (tableName === "survey_sealed_roads") {
    row.road_condition = draft.paved_road_condition || null;
    row.road_class = draft.paved_road_class || null;

    row.paved_road_name = draft.paved_road_name || null;
    row.paved_road_class = draft.paved_road_class || null;
    row.paved_road_type = draft.paved_road_type || draft.Road_Type || null;
    row.paved_road_condition = draft.paved_road_condition || null;
    row.pothole_patches = draft.pothole_patches || null;
    row.road_name_002 = draft.road_name_002 || draft.Road_Name_002 || null;
    row.route_number_004 = draft.Route_number_004 || null;
    row.road_class_002 = draft.Road_Class_002 || null;
    row.road_type = draft.road_type || draft.Road_Type || null;
    row.climate_region_001 = draft.climate_region_001 || draft.Climate_Region_001 || null;
    row.terrain_type_002 = draft.terrain_type_002 || draft.Terrain_Type_002 || null;
    row.datum_point_reference_description = draft.datum_point_reference_description || draft.Datum_point_reference_description || null;
    row.authority_name_002 = draft.authority_name_002 || draft.Authority_Name_002 || null;
    row.number_of_lanes_per_carriageway = draft.number_of_lanes_per_carriageway !== undefined ? Number(draft.number_of_lanes_per_carriageway) : (draft.Number_of_Lanes_per_carriageway !== undefined ? Number(draft.Number_of_Lanes_per_carriageway) : null);
    row.road_length_km = draft.road_length_km !== undefined ? Number(draft.road_length_km) : (draft.Road_Length_km !== undefined ? Number(draft.Road_Length_km) : null);
    row.chainage_from_km_002 = draft.chainage_from_km_002 !== undefined ? Number(draft.chainage_from_km_002) : (draft.Chainage_from_km_002 !== undefined ? Number(draft.Chainage_from_km_002) : null);
    row.chainage_to_km_002 = draft.chainage_to_km_002 !== undefined ? Number(draft.chainage_to_km_002) : (draft.Chainage_to_km_002 !== undefined ? Number(draft.Chainage_to_km_002) : null);
    row.segment_length_km_002 = draft.segment_length_km_002 !== undefined ? Number(draft.segment_length_km_002) : (draft.Segment_Length_Km_002 !== undefined ? Number(draft.Segment_Length_Km_002) : null);
    row.road_width_m_002 = draft.road_width_m_002 !== undefined ? Number(draft.road_width_m_002) : (draft.Road_width_m_002 !== undefined ? Number(draft.Road_width_m_002) : null);
    row.shoulder_width_m = draft.shoulder_width_m !== undefined ? Number(draft.shoulder_width_m) : (draft.Shoulder_Width_m !== undefined ? Number(draft.Shoulder_Width_m) : null);
    row.drainage_type_002_001 = draft.drainage_type_002_001 || draft.Drainage_Type_002_001 || null;
    row.servitude_vegetation_001 = draft.servitude_vegetation_001 || null;
    row.narrow_cracks_degree = draft.narrow_cracks_degree || draft.Narrow_cracks_degree || null;
    row.wide_cracks_degree = draft.wide_cracks_degree || draft.Wide_cracks_degree || null;
    row.pothole_patches_degree = draft.pothole_patches_degree || draft.Pothole_patches_degree || null;
    row.rutting_degree = draft.rutting_degree || draft.Rutting_degree || null;
    row.edge_breaks_degree = draft.edge_breaks_degree || draft.Edge_breaks_Degree || null;
    row.edge_drop_degree = draft.edge_drop_degree || draft.Edge_Drop_Degree || null;
    row.drainage_001 = draft.drainage_001 || draft.Drainage_001 || null;
    row.ravelling_degree = draft.ravelling_degree || draft.Ravelling_Degree || null;
    row.riding_quality_degree_001 = draft.riding_quality_degree_001 || draft.Riding_quality_degree_001 || null;
    row.road_markings = draft.road_markings || draft.Road_markings || null;
    row.road_studs = draft.road_studs || draft.Road_studs || null;
    row.passability_002 = draft.passability_002 || draft.Passability_002 || null;
    row.grid = draft.grid || draft.Grid || null;
    row.year_constructed_to_sealed_standard = draft.year_constructed_to_sealed_standard !== undefined ? Number(draft.year_constructed_to_sealed_standard) : (draft.Year_constructed_to_sealed_standard !== undefined ? Number(draft.Year_constructed_to_sealed_standard) : null);
    row.last_surface_year = draft.last_surface_year !== undefined ? Number(draft.last_surface_year) : (draft.Last_surface_year !== undefined ? Number(draft.Last_surface_year) : null);
    row.surface_type = draft.surface_type || draft.Surface_type || null;
    row.pothole_density = draft.pothole_density || draft.Pothole_density || null;
    row.cycle_track = draft.cycle_track || draft.Cycle_track || null;
    row.survey_side = draft.survey_side || draft.Survey_side || null;
    row.survey_direction = draft.survey_direction || draft.Survey_direction || null;
    row.drainage_lining = draft.drainage_lining || draft.Drainage_lining || null;
    row.road_markings_visible = draft.road_markings_visible || draft.Road_markings_visible || null;
    row.median_type = draft.median_type || draft.Median_type || null;
    row.carriage1_narrow_cracks = draft.carriage1_narrow_cracks || draft.Carriage1_Narrow_cracks || null;
    row.carriage1_wide_cracks = draft.carriage1_wide_cracks || draft.Carriage1_Wide_cracks || null;
    row.carriage1_pothole_patches = draft.carriage1_pothole_patches || draft.Carriage1_Pothole_patches || null;
    row.carriage1_rutting = draft.carriage1_rutting || draft.Carriage1_Rutting || null;
    row.carriage1_edge_breaks = draft.carriage1_edge_breaks || draft.Carriage1_Edge_breaks || null;
    row.carriage1_edge_drop = draft.carriage1_edge_drop || draft.Carriage1_Edge_drop || null;
    row.carriage1_ravelling = draft.carriage1_ravelling || draft.Carriage1_Ravelling || null;
    row.carriage1_riding_quality = draft.carriage1_riding_quality || draft.Carriage1_Riding_quality || null;
    row.carriage2_narrow_cracks = draft.carriage2_narrow_cracks || draft.Carriage2_Narrow_cracks || null;
    row.carriage2_wide_cracks = draft.carriage2_wide_cracks || draft.Carriage2_Wide_cracks || null;
    row.carriage2_pothole_patches = draft.carriage2_pothole_patches || draft.Carriage2_Pothole_patches || null;
    row.carriage2_rutting = draft.carriage2_rutting || draft.Carriage2_Rutting || null;
    row.carriage2_edge_breaks = draft.carriage2_edge_breaks || draft.Carriage2_Edge_breaks || null;
    row.carriage2_edge_drop = draft.carriage2_edge_drop || draft.Carriage2_Edge_drop || null;
    row.carriage2_ravelling = draft.carriage2_ravelling || draft.Carriage2_Ravelling || null;
    row.carriage2_riding_quality = draft.carriage2_riding_quality || draft.Carriage2_Riding_quality || null;
    if (draft.chainage_from_km !== undefined) row.chainage_from_km_002 = Number(draft.chainage_from_km);
    if (draft.chainage_to_km !== undefined) row.chainage_to_km_002 = Number(draft.chainage_to_km);
  } else if (tableName === "survey_gravel_roads") {
    row.road_condition = draft.gravel_condition || null;
    row.road_class = draft.gravel_road_class || null;

    row.gravel_road_name = draft.gravel_road_name || null;
    row.gravel_road_class = draft.gravel_road_class || null;
    row.gravel_thickness = draft.gravel_thickness || draft.Gravel_Thickness_mm || null;
    row.gravel_condition = draft.gravel_condition || null;
    row.drainage_condition = draft.drainage_condition || draft.Drainage_condition || null;
    row.road_name_gravel = draft.gravel_road_name || draft.Road_Name || null;
    row.route_number = draft.route_number || draft.Route_Number || null;
    row.road_length = draft.road_length !== undefined ? Number(draft.road_length) : (draft.Road_Length !== undefined ? Number(draft.Road_Length) : null);
    row.datum_point_description = draft.datum_point_description || draft.Datum_point_description || null;
    row.road_class_raw = draft.road_class_raw || draft.Road_Class || null;
    row.authority_name = draft.authority_name || draft.Authority_Name || null;
    row.servitude_vegetation = draft.servitude_vegetation || null;
    row.climate_region = draft.climate_region || draft.Climate_Region || null;
    row.terrain_type = draft.terrain_type || draft.Terrain_Type || null;
    row.chainage_from_km = draft.chainage_from_km !== undefined ? Number(draft.chainage_from_km) : (draft.Chainage_From_km !== undefined ? Number(draft.Chainage_From_km) : null);
    row.chainage_to_km = draft.chainage_to_km !== undefined ? Number(draft.chainage_to_km) : (draft.Chainage_To_km !== undefined ? Number(draft.Chainage_To_km) : null);
    row.segment_length_km = draft.segment_length_km !== undefined ? Number(draft.segment_length_km) : (draft.Segment_Length_km !== undefined ? Number(draft.Segment_Length_km) : null);
    row.road_width_m = draft.road_width_m !== undefined ? Number(draft.road_width_m) : (draft.Road_Width_m !== undefined ? Number(draft.Road_Width_m) : null);
    row.drainage_type = draft.drainage_type || draft.Drainage_Type || null;
    row.cross_section = draft.cross_section || draft.Cross_section || null;
    row.gravel_thickness_mm = draft.gravel_thickness_mm || draft.Gravel_Thickness_mm || null;
    row.corrugations = draft.corrugations || draft.Corrugations || null;
    row.riding_quality_degree = draft.riding_quality_degree || draft.Riding_Quality_degree || null;
    row.potholes_degree = draft.potholes_degree || draft.Potholes_Degree || null;
    row.passability = draft.passability || draft.Passability || null;
    row.year_of_construction = draft.year_of_construction !== undefined ? Number(draft.year_of_construction) : (draft.Year_of_Counstruction !== undefined ? Number(draft.Year_of_Counstruction) : null);
    row.age_in_years = draft.age_in_years !== undefined ? Number(draft.age_in_years) : (draft.Age_in_Years !== undefined ? Number(draft.Age_in_Years) : null);
    row.last_year_of_re_gravelling = draft.last_year_of_re_gravelling !== undefined ? Number(draft.last_year_of_re_gravelling) : (draft.Last_year_of_re_gravelling !== undefined ? Number(draft.Last_year_of_re_gravelling) : null);
    row.drainage_condition_raw = draft.drainage_condition_raw || draft.Drainage_condition || null;
    row.gravel_corrugations_severity = draft.gravel_corrugations_severity || null;
    row.gravel_cross_section_severity = draft.gravel_cross_section_severity || null;
    row.gravel_drainage_severity = draft.gravel_drainage_severity || null;
    row.gravel_potholes_severity = draft.gravel_potholes_severity || null;
    row.gravel_riding_severity = draft.gravel_riding_severity || null;
  } else if (tableName === "survey_earth_roads") {
    row.road_condition = draft.earth_road_condition || null;
    row.road_class = draft.earth_road_class || null;

    row.earth_road_name = draft.earth_road_name || null;
    row.earth_road_class = draft.earth_road_class || null;
    row.earth_road_width = draft.earth_road_width !== undefined ? Number(draft.earth_road_width) : null;
    row.earth_road_length = draft.earth_road_length !== undefined ? Number(draft.earth_road_length) : null;
    row.earth_road_condition = draft.earth_road_condition || null;
    row.earth_road_passability = draft.earth_road_passability || null;
    row.earth_drainage_type = draft.earth_drainage_type || null;
    row.earth_drainage_condition = draft.earth_drainage_condition || null;
    row.earth_terrain = draft.earth_terrain || null;
    row.earth_climate = draft.earth_climate || null;
    row.earth_authority = draft.earth_authority || null;
    row.earth_year_constructed = draft.earth_year_constructed !== undefined ? Number(draft.earth_year_constructed) : null;
    if (draft.chainage_from_km !== undefined) row.chainage_from_km = Number(draft.chainage_from_km);
    if (draft.chainage_to_km !== undefined) row.chainage_to_km = Number(draft.chainage_to_km);
  } else if (tableName === "survey_bridges") {
    row.bridge = draft.bridge || null;
    row.bridge_crossing = draft.bridge_crossing || null;
    row.bridge_type = draft.bridge_type || null;
    row.bridge_bearing = draft.bridge_bearing || null;
    row.bridge_joints = draft.bridge_joints || null;
    row.bearings_state = draft.bearings_state || null;
    row.parapet = draft.parapet || null;
    row.chemical_effect = draft.chemical_effect || null;
    row.vegetation_growth = draft.vegetation_growth || null;
    row.drainage = draft.drainage || null;
    row.bridge_condition = draft.bridge_condition || null;
  } else if (tableName === "survey_footbridges") {
    row.footbridge_name = draft.footbridge_name || null;
    row.footbridge_type = draft.footbridge_type || null;
    row.footbridge_condition = draft.footbridge_condition || null;
    row.footbridge_width = draft.footbridge_width !== undefined ? Number(draft.footbridge_width) : null;
    row.footbridge_span = draft.footbridge_span !== undefined ? Number(draft.footbridge_span) : null;
    row.footbridge_material = draft.footbridge_material || null;
    row.footbridge_crossing = draft.footbridge_crossing || null;
  } else if (tableName === "survey_rail_crossings") {
    row.rail_crossing_name = draft.rail_crossing_name || null;
    row.rail_crossing_type = draft.rail_crossing_type || null;
    row.rail_crossing_condition = draft.rail_crossing_condition || null;
    row.rail_crossing_control = draft.rail_crossing_control || null;
    row.rail_crossing_road_class = draft.rail_crossing_road_class || null;
  } else if (tableName === "survey_tollgates") {
    row.tollgate_name = draft.tollgate_name || null;
    row.tollgate_type = draft.tollgate_type || null;
    row.tollgate_condition = draft.tollgate_condition || null;
    row.tollgate_lanes = draft.tollgate_lanes !== undefined ? Number(draft.tollgate_lanes) : null;
    row.tollgate_operational = draft.tollgate_operational || null;
  } else if (tableName === "survey_laybys") {
    row.layby_condition = draft.layby_condition || null;
    row.layby_surface = draft.layby_surface || null;
    row.layby_length = draft.layby_length !== undefined ? Number(draft.layby_length) : null;
    row.layby_drainage = draft.layby_drainage || null;
  } else if (tableName === "survey_busstops") {
    row.busstop_type = draft.busstop_type || null;
    row.busstop_condition = draft.busstop_condition || null;
    row.busstop_shelter = draft.busstop_shelter || null;
    row.busstop_drainage = draft.busstop_drainage || null;
  } else if (tableName === "survey_junctions") {
    row.junction_type = draft.junction_type || null;
    row.junction_condition = draft.junction_condition || null;
    row.junction_control = draft.junction_control || null;
    row.junction_road_markings = draft.junction_road_markings || null;
    row.junction_signage = draft.junction_signage || null;
  } else if (tableName === "survey_road_signs") {
    row.sign_name = draft.sign_name || null;
    row.sign_type = draft.sign_type || null;
    row.sign_condition = draft.sign_condition || null;
    row.sign_sadc_compliant = draft.sign_sadc_compliant || draft.sadc_compliant || null;
    row.sign_visibility = draft.sign_visibility || null;
  } else if (tableName === "survey_shelvets") {
    row.shelvets_type = draft.shelvets_type || null;
    row.shelvet_condition = draft.shelvet_condition || null;
  } else if (tableName === "survey_culverts") {
    row.culvet_class = draft.culvet_class || null;
    row.culvet_type = draft.culvet_type || null;
    row.culvet_serviceability = draft.culvet_serviceability || null;
  } else if (tableName === "survey_piped_causeways") {
    row.causeway_name = draft.causeway_name || null;
    row.causeway_condition = draft.causeway_condition || null;
    row.causeway_pipe_material = draft.causeway_pipe_material || null;
    row.causeway_pipe_diameter = draft.causeway_pipe_diameter || null;
    row.causeway_drainage = draft.causeway_drainage || null;
    row.causeway_serviceability = draft.causeway_serviceability || null;
  } else if (tableName === "survey_drifts") {
    row.drift_name = draft.drift_name || null;
    row.drift_condition = draft.drift_condition || null;
    row.drift_surface = draft.drift_surface || null;
    row.drift_passability = draft.drift_passability || null;
    row.drift_width = draft.drift_width !== undefined ? Number(draft.drift_width) : null;
  } else if (tableName === "survey_grids") {
    row.grid_name = draft.grid_name || null;
    row.grid_condition = draft.grid_condition || null;
    row.grid_material = draft.grid_material || null;
    row.grid_operational = draft.grid_operational || null;
  } else if (tableName === "survey_traffic_lights") {
    row.traffic_lights_location = draft.traffic_lights_location || null;
    row.traffic_lights_condition = draft.traffic_lights_condition || null;
    row.traffic_lights_operational = draft.traffic_lights_operational || null;
    row.traffic_lights_type = draft.traffic_lights_type || null;
    row.traffic_lights_phases = draft.traffic_lights_phases !== undefined ? Number(draft.traffic_lights_phases) : null;
  } else if (tableName === "survey_catchpits") {
    row.catchpit_condition = draft.catchpit_condition || null;
    row.road_condition = draft.catchpit_condition || null;
  } else if (tableName === "survey_traffic_calming") {
    row.traffic_calming_type = draft.traffic_calming_type || null;
    row.traffic_calming_condition = draft.traffic_calming_condition || null;
    row.road_condition = draft.traffic_calming_condition || null;
  } else if (tableName === "survey_streetlights") {
    row.streetlight_type = draft.streetlight_type || null;
    row.streetlight_condition = draft.streetlight_condition || null;
    row.streetlight_power_source = draft.streetlight_power_source || null;
    row.streetlight_operational = draft.streetlight_operational || null;
    row.streetlight_count = draft.streetlight_count !== undefined ? Number(draft.streetlight_count) : null;
  }

  return row;
};

// --- Server-side in-memory cache (survives Next.js hot-reload in dev) ---
let _cachedRecords: any[] | null = null;
let _cacheTimestamp = 0;
const CACHE_TTL_MS = 60_000; // 60 seconds

function invalidateServerCache() {
  _cachedRecords = null;
  _cacheTimestamp = 0;
}

/** Persist merged records to roads-data.json — keep full photos[] for dashboard gallery. */
function writeLocalCache(records: any[]): void {
  try {
    const cachePath = path.resolve(process.cwd(), "public", "roads-data.json");
    const slim = records.map((r: any) => {
      const photos = normalizePhotos(r);
      const rest = { ...r, photos, photo: photos[0] || r.photo || null, _allPhotos: photos };
      // Drop duplicate blobs from raw_data; top-level photos[] is canonical
      if (rest.raw_data && typeof rest.raw_data === "object") {
        const { photo: rp, photos: rps, ...rawRest } = rest.raw_data;
        rest.raw_data = rawRest;
        void rp;
        void rps;
      }
      return rest;
    });
    const payload = { count: slim.length, records: slim, source: "merged" };
    fs.writeFileSync(cachePath, JSON.stringify(payload, null, 0), "utf-8");
    console.log(`Local cache updated: ${slim.length} records written to roads-data.json`);
  } catch (e: any) {
    console.error("Failed to write local cache:", e.message);
  }
}

// Columns available on the road_surveys VIEW
const VIEW_COLUMNS = [
  "survey_id", "asset_category", "road_name", "section_name",
  "surveyor_name", "survey_date", "gps_point", "road_condition", "road_class",
  "raw_data",
  "segment_geojson",
  "segment_length_m", "segment_point_count", "segment_avg_accuracy",
  "segment_start_time", "segment_end_time", "photo", "photos", "created_at", "source"
].join(",");

// Columns present on EVERY category table (roads + points)
const TABLE_COMMON_COLUMNS = [
  "survey_id", "asset_category", "road_name", "section_name",
  "surveyor_name", "survey_date", "gps_point", "image_sadc_compliant",
  "photo", "photos", "source", "created_at", "raw_data"
].join(",");

/** Fallback when `photos` JSONB column is not migrated yet. */
const TABLE_COMMON_FALLBACK_COLUMNS = [
  "survey_id", "asset_category", "road_name", "section_name",
  "surveyor_name", "survey_date", "gps_point", "image_sadc_compliant",
  "photo", "source", "created_at", "raw_data"
].join(",");

// Extra columns only on linear road tables
const ROAD_EXTRA_COLUMNS = [
  "road_condition", "road_class", "segment_length_m", "segment_point_count", "segment_avg_accuracy", "segment_start_time", "segment_end_time"
].join(",");

/** Per-category name/condition columns (no photo/raw_data). */
const CATEGORY_EXTRA: Record<string, string> = {
  sealed: "paved_road_name,paved_road_condition,paved_road_class,paved_road_type,authority_name_002,passability_002,riding_quality_degree_001",
  gravel: "gravel_road_name,gravel_condition,gravel_road_class,authority_name,passability,riding_quality_degree",
  earth: "earth_road_name,earth_road_condition,earth_road_class,earth_authority,earth_road_passability",
  bridge: "bridge,bridge_condition,bridge_type,bridge_crossing",
  footbridge: "footbridge_name,footbridge_condition,footbridge_type",
  rail_crossing: "rail_crossing_name,rail_crossing_condition,rail_crossing_type",
  tollgate: "tollgate_name,tollgate_condition,tollgate_type",
  layby: "layby_condition,layby_surface",
  busstop: "busstop_type,busstop_condition",
  junction: "junction_type,junction_condition",
  sign: "sign_type,sign_name,sign_condition",
  shelvet: "shelvets_type,shelvet_condition",
  culvert: "culvet_class,culvet_type,culvet_serviceability",
  piped_causeway: "causeway_name,causeway_condition,causeway_serviceability",
  drift: "drift_name,drift_condition",
  grid: "grid_name,grid_condition",
  catchpit: "catchpit_condition",
  traffic_calming: "traffic_calming_type,traffic_calming_condition",
  traffic_lights: "traffic_lights_location,traffic_lights_condition",
  streetlight: "streetlight_type,streetlight_condition,streetlight_power_source",
};

const ROAD_TABLES = new Set([
  "survey_sealed_roads", "survey_gravel_roads", "survey_earth_roads"
]);

/** Fetch one Supabase table with a timeout, return [] on failure */
async function fetchTable(tableName: string, columns: string, signal: AbortSignal): Promise<any[]> {
  const roadExtras = ROAD_TABLES.has(tableName) ? `,${ROAD_EXTRA_COLUMNS}` : "";
  const stableCols = `${TABLE_COMMON_COLUMNS}${roadExtras}`.replace(/\s+/g, "");
  const attempts = Array.from(new Set([
    columns.replace(/\s+/g, ""),
    stableCols,
    TABLE_COMMON_FALLBACK_COLUMNS.replace(/\s+/g, ""),
  ]));

  const headers: Record<string, string> = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Prefer": "count=none",
    "Range": "0-9999",
  };

  for (const cleanCols of attempts) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${tableName}?select=${cleanCols}&order=created_at.desc`,
        { headers, cache: "no-store", signal }
      );
      if (!res.ok) {
        const errText = await res.text().catch(() => "");
        console.warn(`fetchTable ${tableName} (${cleanCols.slice(0, 60)}…) failed: ${res.status} ${errText.slice(0, 120)}`);
        continue;
      }
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    } catch (e: any) {
      console.warn(`fetchTable ${tableName} error:`, e?.message || e);
    }
  }
  return [];
}


/** Fetch segment GeoJSON for road tables separately (large data - separate request to avoid size limits). */
async function fetchRoadSegments(signal: AbortSignal): Promise<Record<string, string>> {
  const roadTables = ["survey_sealed_roads", "survey_gravel_roads", "survey_earth_roads"];
  const headers: Record<string, string> = {
    "apikey": SUPABASE_ANON_KEY,
    "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
    "Prefer": "count=none",
    "Range": "0-9999",
  };
  const segMap: Record<string, string> = {};
  for (const table of roadTables) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?select=survey_id,segment_geojson&order=created_at.desc`,
        { headers, cache: "no-store", signal }
      );
      if (!res.ok) {
        console.warn(`fetchRoadSegments ${table} failed: ${res.status}`);
        continue;
      }
      const rows: any[] = await res.json();
      let count = 0;
      for (const row of rows) {
        if (row.survey_id && row.segment_geojson) {
          const sid = String(row.survey_id).trim(); segMap[sid] = row.segment_geojson;
          count++;
        }
      }
      console.log(`  ${table} segments: ${count} loaded`);
    } catch (e: any) {
      console.warn(`fetchRoadSegments ${table} error:`, e?.message || e);
    }
  }
  return segMap;
}
/** Fetch all category tables in parallel - reliable source for point + linear assets. */
async function fetchAllCategoryTables(signal: AbortSignal): Promise<any[]> {
  const entries = Object.entries(categoryToTable);
  const results = await Promise.all(
    entries.map(async ([cat, table]) => {
      const roadExtras = ROAD_TABLES.has(table) ? `,${ROAD_EXTRA_COLUMNS}` : "";
      // Stable column set — category-specific fields live in raw_data + typed columns on row merge
      const cols = `${TABLE_COMMON_COLUMNS}${roadExtras}`;
      const rows = await fetchTable(table, cols, signal);
      console.log(`  ${table}: ${rows.length} rows`);
      return rows.map((row) => rowToRecord(row, row.asset_category || cat));
    })
  );
  const allRecords = results.flat();

  // Merge segment GeoJSON for road tables separately (avoids statement timeouts from huge payloads)
  try {
    const segMap = await fetchRoadSegments(signal);
    const segCount = Object.keys(segMap).length;
    if (segCount > 0) {
      let mergedSegs = 0;
      for (const r of allRecords) {
        const id = String(r.id || r._id || r.survey_id || "").trim();
        if (id && segMap[id]) {
          r.road_segment_geojson = segMap[id];
          mergedSegs++;
        }
      }
      console.log(`Merged ${mergedSegs} linear road segments into records`);
    }
  } catch (e: any) {
    console.warn("fetchRoadSegments failed:", e?.message || e);
  }

  return allRecords;
}

/** Normalise a row from any individual category table into a dashboard record */
function rowToRecord(row: any, cat: string): any {
  const raw = row.raw_data && typeof row.raw_data === "object" ? row.raw_data : null;

  const record: any = {
    id:             row.survey_id,
    _id:            row.survey_id,
    asset_category: cat,
    road_name:      row.road_name,
    section_name:   row.section_name,
    surveyor_name:  row.surveyor_name,
    survey_date:    row.survey_date,
    gps:            row.gps_point,
    image_sadc_compliant: row.image_sadc_compliant || raw?.image_SADC_compliant || raw?.image_sadc_compliant || undefined,
    image_SADC_compliant: row.image_sadc_compliant || raw?.image_SADC_compliant || raw?.image_sadc_compliant || undefined,
    raw_data:       raw || undefined,
    road_segment_geojson:        row.segment_geojson,
    road_segment_length_m:       row.segment_length_m,
    road_segment_point_count:    row.segment_point_count,
    road_segment_avg_accuracy_m: row.segment_avg_accuracy,
    road_segment_start_time:     row.segment_start_time,
    road_segment_end_time:       row.segment_end_time,
    source: row.source || raw?.source,
  };

  // Merge typed table columns (condition, names, etc.) before raw_data
  const ROW_SKIP = new Set([
    "survey_id", "raw_data", "geom_point", "geom_segment", "created_at",
    "segment_geojson", "gps_point",
  ]);
  for (const [key, val] of Object.entries(row)) {
    if (ROW_SKIP.has(key)) continue;
    if (val === null || val === undefined || val === "") continue;
    if (typeof val === "string" && val.startsWith("data:image")) continue;
    if (record[key] === undefined || record[key] === null || record[key] === "") {
      record[key] = val;
    }
  }

  const allPhotos = normalizePhotos({ ...record, photo: row.photo, photos: row.photos, raw_data: raw || row.raw_data });
  record.photo = allPhotos[0] || null;
  record.photos = allPhotos;
  record._allPhotos = allPhotos;

  // Merge useful detail fields from raw_data so names/inspector see mobile values
  if (raw) {
    const skip = new Set([
      "photo", "photos", "raw_data", "id", "_id", "gps",
      "road_segment_points", "road_segment_geojson",
    ]);
    for (const [key, val] of Object.entries(raw)) {
      if (skip.has(key)) continue;
      if (val === undefined || val === null) continue;
      if (record[key] !== undefined && record[key] !== null && record[key] !== "") continue;
      if (typeof val === "string" && val.startsWith("data:image")) continue;
      record[key] = val;
    }
  }

  const cond =
    row.road_condition ||
    row.bridge_condition ||
    row.gravel_condition ||
    row.earth_road_condition ||
    row.footbridge_condition ||
    row.rail_crossing_condition ||
    row.tollgate_condition ||
    row.layby_condition ||
    row.busstop_condition ||
    row.junction_condition ||
    row.sign_condition ||
    row.shelvet_condition ||
    row.culvet_serviceability ||
    row.causeway_condition ||
    row.drift_condition ||
    row.grid_condition ||
    row.catchpit_condition ||
    row.traffic_calming_condition ||
    row.traffic_lights_condition ||
    row.streetlight_condition ||
    "good";

  if (cat === "sealed")             { record.paved_road_condition = record.paved_road_condition || cond; record.paved_road_class  = record.paved_road_class || row.road_class; }
  else if (cat === "gravel")        { record.gravel_condition     = record.gravel_condition || cond; record.gravel_road_class = record.gravel_road_class || row.road_class; }
  else if (cat === "earth")         { record.earth_road_condition = record.earth_road_condition || cond; }
  else if (cat === "bridge")        { record.bridge_condition     = record.bridge_condition || cond; }
  else if (cat === "footbridge")    { record.footbridge_condition = record.footbridge_condition || cond; }
  else if (cat === "rail_crossing") { record.rail_crossing_condition = record.rail_crossing_condition || cond; }
  else if (cat === "tollgate")      { record.tollgate_condition   = record.tollgate_condition || cond; }
  else if (cat === "layby")         { record.layby_condition      = record.layby_condition || cond; }
  else if (cat === "busstop")       { record.busstop_condition = record.busstop_condition || cond; record.bus_stop_condition = record.bus_stop_condition || cond; record.bus_stop_present = true; }
  else if (cat === "junction")      { record.junction_condition   = record.junction_condition || cond; }
  else if (cat === "sign")          { record.sign_condition       = record.sign_condition || cond; }
  else if (cat === "shelvet")       { record.shelvet_condition    = record.shelvet_condition || cond; }
  else if (cat === "culvert")       { record.culvet_serviceability = record.culvet_serviceability || cond; }
  else if (cat === "piped_causeway"){ record.causeway_condition   = record.causeway_condition || cond; }
  else if (cat === "drift")         { record.drift_condition      = record.drift_condition || cond; }
  else if (cat === "grid")          { record.grid_condition       = record.grid_condition || cond; }
  else if (cat === "catchpit")      { record.catchpit_condition   = record.catchpit_condition || cond; }
  else if (cat === "traffic_calming") { record.traffic_calming_condition = record.traffic_calming_condition || cond; }
  else if (cat === "traffic_lights"){ record.traffic_lights_condition = record.traffic_lights_condition || cond; }
  else if (cat === "streetlight")   { record.streetlight_condition   = record.streetlight_condition || cond; }
  return normaliseRecord(record);
}

/** Fetch all photos for a survey from category tables (authoritative source). */
async function fetchPhotosForSurveyId(surveyId: string): Promise<{ photo: string | null; photos: string[] }> {
  const headers: Record<string, string> = {
    apikey: SUPABASE_ANON_KEY,
    Authorization: `Bearer ${SUPABASE_ANON_KEY}`,
  };
  const tables = Array.from(new Set(Object.values(categoryToTable)));
  for (const table of tables) {
    try {
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/${table}?survey_id=eq.${encodeURIComponent(surveyId)}&select=photo,photos,raw_data&limit=1`,
        { headers, cache: "no-store" }
      );
      if (!res.ok) continue;
      const rows = await res.json();
      if (!Array.isArray(rows) || rows.length === 0) continue;
      const photos = normalizePhotos(rows[0]);
      if (photos.length > 0) {
        return { photo: photos[0], photos };
      }
    } catch {
      /* try next table */
    }
  }
  // Fallback: unified view
  try {
    const res = await fetch(
      `${SUPABASE_URL}/rest/v1/road_surveys?survey_id=eq.${encodeURIComponent(surveyId)}&select=photo,photos,raw_data&limit=1`,
      { headers, cache: "no-store" }
    );
    if (res.ok) {
      const rows = await res.json();
      if (rows.length > 0) {
        const photos = normalizePhotos(rows[0]);
        if (photos.length > 0) {
          return { photo: photos[0], photos };
        }
      }
    }
  } catch {
    /* ignore */
  }
  return { photo: null, photos: [] };
}

/** Backfill photos for records where list fetch omitted JSONB photo arrays. */
async function hydrateMissingPhotos(records: any[]): Promise<void> {
  const need = records.filter((r) => normalizePhotos(r).length === 0);
  if (need.length === 0) return;

  const cap = Math.min(need.length, 150);
  console.log(`Hydrating photos for ${cap}/${need.length} records without images…`);

  await Promise.all(
    need.slice(0, cap).map(async (r) => {
      const id = String(r.id || r._id || r.survey_id || "").trim();
      if (!id) return;
      const { photos } = await fetchPhotosForSurveyId(id);
      if (photos.length > 0) {
        r.photos = photos;
        r.photo = photos[0];
        r._allPhotos = photos;
      }
    })
  );
}

export async function GET(req: Request) {
  if (OFFLINE_MODE) {
    return NextResponse.json(loadLocalFallback());
  }

  const url = new URL(req.url);
  const photoFor = url.searchParams.get("photoFor");
  if (photoFor) {
    const result = await fetchPhotosForSurveyId(photoFor);
    return NextResponse.json(result);
  }

  const forceRefresh = url.searchParams.get("refresh") === "1";
  const fallbackOnly = url.searchParams.get("fallback") === "1";

  // ?fallback=1 ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â return local JSON cache immediately, no Supabase round-trip
  if (fallbackOnly) {
    return NextResponse.json(loadLocalFallback());
  }

  // Serve from server cache if still fresh
  if (!forceRefresh && _cachedRecords && (Date.now() - _cacheTimestamp) < CACHE_TTL_MS) {
    console.log(`Serving ${_cachedRecords.length} records from server cache (${Math.round((Date.now() - _cacheTimestamp) / 1000)}s old)`);
    return NextResponse.json({ count: _cachedRecords.length, records: _cachedRecords, source: "server", cached: true });
  }

  try {
    console.log("Fetching surveys from all Supabase category tables...");
    const t0 = Date.now();

    // 60s ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â raw_data payloads can be large
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 60_000);

    // Primary: fetch every category table (bridges, culverts, signs, roads, ...)
    let serverRecords = await fetchAllCategoryTables(controller.signal);
    await hydrateMissingPhotos(serverRecords);

    // Segments fetched via ROAD_EXTRA_COLUMNS

    // Fallback: union view if table fetches returned nothing
    if (serverRecords.length === 0) {
      console.warn("Category tables empty/failed ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â trying road_surveys viewÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Â ÃƒÂ¢Ã¢â€šÂ¬Ã¢â€žÂ¢ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã†â€™Ãƒâ€šÃ‚Â¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã¢â‚¬Â¦Ãƒâ€šÃ‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¬ÃƒÆ’Ã†â€™Ãƒâ€ Ã¢â‚¬â„¢ÃƒÆ’Ã‚Â¢ÃƒÂ¢Ã¢â‚¬Å¡Ã‚Â¬Ãƒâ€¦Ã‚Â¡ÃƒÆ’Ã†â€™ÃƒÂ¢Ã¢â€šÂ¬Ã…Â¡ÃƒÆ’Ã¢â‚¬Å¡Ãƒâ€šÃ‚Â¦");
      const res = await fetch(
        `${SUPABASE_URL}/rest/v1/road_surveys?select=${VIEW_COLUMNS}&order=created_at.desc`,
        {
          headers: {
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
          },
          cache: "no-store",
          signal: controller.signal
        }
      );
      if (res.ok) {
        const db_records: any[] = await res.json();
        serverRecords = db_records.map((row: any) =>
          rowToRecord(row, row.asset_category || inferAssetCategory(row) || "unknown")
        );
      } else {
        const errText = await res.text();
        console.error("road_surveys view fetch error:", res.status, errText.slice(0, 300));
      }
    }

    clearTimeout(timeoutId);

    if (serverRecords.length > 0) {
      const liveCount = serverRecords.length;

      // Merge: server records win, then add any local-only records not yet on server
      const seenIds = new Set<string>();
      const merged: any[] = [];

      for (const r of serverRecords) {
        const id = String(r.id || r._id || "");
        if (id && !seenIds.has(id)) {
          seenIds.add(id);
          merged.push(r);
        } else if (!id) {
          merged.push(r);
        }
      }

      const localFallback = loadLocalFallback();
      for (const r of (localFallback.records || [])) {
        const id = String(r.id || r._id || "");
        if (!id || !seenIds.has(id)) {
          if (id) seenIds.add(id);
          // Ensure category on legacy local rows
          if (!r.asset_category) r.asset_category = inferAssetCategory(r);
          merged.push(normaliseRecord(r));
        }
      }

      merged.sort((a, b) => {
        const da = a.survey_date || a.created_at || "";
        const db_ = b.survey_date || b.created_at || "";
        return db_.localeCompare(da);
      });

      const byCat: Record<string, number> = {};
      for (const r of merged) {
        const c = r.asset_category || "unknown";
        byCat[c] = (byCat[c] || 0) + 1;
      }
      console.log(
        `Merged ${merged.length} records (${liveCount} live) in ${Date.now() - t0}ms`,
        byCat
      );

      _cachedRecords = merged;
      _cacheTimestamp = Date.now();
      writeLocalCache(merged);

      return NextResponse.json({ count: merged.length, records: merged, source: "server", categories: byCat });
    }

    console.error("No records returned from Supabase tables or view");

  } catch (err: any) {
    if (err.name === "AbortError") {
      console.error("Server data fetch timed out");
    } else {
      console.error("Server data fetch failed:", err.message);
    }
  }

  // Stale server cache is better than nothing
  if (_cachedRecords) {
    console.warn("Serving stale server cache due to server unavailability");
    return NextResponse.json({ count: _cachedRecords.length, records: _cachedRecords, source: "server", cached: true, stale: true });
  }

  return NextResponse.json(loadLocalFallback());
}



export async function POST(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch (e) {}

  if (!body || !body.record) {
    return NextResponse.json({ error: "Missing record data" }, { status: 400 });
  }

  const record = normaliseRecord(body.record);

  if (OFFLINE_MODE === false) {
    const category = record.asset_category || "sealed";
    const tableName = categoryToTable[category] || "survey_sealed_roads";
    
    const toFirestoreDocument = (obj: any) => {
      const fields: any = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val === null || val === undefined) continue;
        if (typeof val === "string") {
          fields[key] = { stringValue: val };
        } else if (typeof val === "number") {
          if (Number.isInteger(val)) {
            fields[key] = { integerValue: val.toString() };
          } else {
            fields[key] = { doubleValue: val };
          }
        } else if (typeof val === "boolean") {
          fields[key] = { booleanValue: val };
        } else if (Array.isArray(val)) {
          fields[key] = {
            arrayValue: {
              values: val.map(item => {
                if (typeof item === "object") {
                  return { stringValue: JSON.stringify(item) };
                }
                return { stringValue: String(item) };
              })
            }
          };
        } else if (typeof val === "object") {
          fields[key] = { stringValue: JSON.stringify(val) };
        }
      }
      return { fields };
    };

    try {
      const supabaseRow = mapDraftToSupabaseTable(record, tableName);

      // 1. Supabase write
      const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
        method: "POST",
        headers: SUPABASE_WRITE_HEADERS,
        body: JSON.stringify(supabaseRow)
      });

      if (!supabaseRes.ok) {
        const errText = await supabaseRes.text();
        return NextResponse.json({ error: `Server write failed: ${errText}` }, { status: supabaseRes.status });
      }

      invalidateServerCache();

      // 2. Firebase write
      try {
        const firestoreDoc = toFirestoreDocument(supabaseRow);
        const docId = record.id || record._id;
        await fetch(
          `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIREBASE_DB}/documents/${tableName}?documentId=${docId}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(firestoreDoc)
          }
        );
      } catch (fbErr) {
        console.error("Firebase parallel write failed:", fbErr);
      }

      return NextResponse.json({ success: true, record, source: "server" });
    } catch (err: any) {
      return NextResponse.json({ error: `Cannot reach server: ${err.message}` }, { status: 502 });
    }
  } else {
    // Standalone cache write
    try {
      const cachePath = path.resolve(process.cwd(), "public", "roads-data.json");
      if (fs.existsSync(cachePath)) {
        const fileContent = fs.readFileSync(cachePath, "utf-8");
        const json = JSON.parse(fileContent);
        const maxId = json.records.reduce((max: number, r: any) => Math.max(max, r._id || 0), 1000);
        const newRecord = {
          ...record,
          _id: maxId + 1,
          _geolocation: record._geolocation || (record.gps ? [
            parseFloat(record.gps.split(" ")[0]),
            parseFloat(record.gps.split(" ")[1])
          ] : undefined)
        };
        json.records.unshift(newRecord);
        json.count = json.records.length;
        fs.writeFileSync(cachePath, JSON.stringify(json, null, 2), "utf-8");
        return NextResponse.json({ success: true, record: newRecord, source: "local_cache" });
      }
    } catch (fsErr: any) {
      return NextResponse.json({ error: `Failed to write to local cache: ${fsErr.message}` }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true, record });
}

export async function DELETE(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");

  if (!id) {
    return NextResponse.json({ error: "Missing record ID" }, { status: 400 });
  }

  if (OFFLINE_MODE === false) {
    try {
      // 1. Fetch category from view first to identify table
      const getRes = await fetch(`${SUPABASE_URL}/rest/v1/road_surveys?survey_id=eq.${id}&select=asset_category`, {
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      let category = "sealed";
      if (getRes.ok) {
        const rows = await getRes.json();
        if (rows && rows.length > 0) {
          category = rows[0].asset_category || "sealed";
        }
      }
      const tableName = categoryToTable[category] || "survey_sealed_roads";

      // 2. Delete from Supabase specific table
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?survey_id=eq.${id}`, {
        method: "DELETE",
        headers: {
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
        }
      });
      if (res.ok) {
        // Parallel delete from Firebase
        try {
          await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIREBASE_DB}/documents/${tableName}/${id}`,
            { method: "DELETE" }
          );
        } catch (e) {
          console.error("Firebase parallel delete failed:", e);
        }
        return NextResponse.json({ success: true, message: `Deleted survey ${id}`, source: "server" });
      } else {
        const errText = await res.text();
        return NextResponse.json({ error: `Server delete failed: ${errText}` }, { status: res.status });
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Cannot reach server: ${err.message}` }, { status: 502 });
    }
  } else {
    try {
      const cachePath = path.resolve(process.cwd(), "public", "roads-data.json");
      if (fs.existsSync(cachePath)) {
        const fileContent = fs.readFileSync(cachePath, "utf-8");
        const json = JSON.parse(fileContent);
        const initialCount = json.records.length;
        json.records = json.records.filter((r: any) => String(r._id) !== String(id));
        json.count = json.records.length;
        if (json.records.length === initialCount) {
          return NextResponse.json({ error: `Record with ID ${id} not found` }, { status: 404 });
        }
        fs.writeFileSync(cachePath, JSON.stringify(json, null, 2), "utf-8");
        return NextResponse.json({ success: true, message: `Successfully deleted record ${id}`, source: "local_cache" });
      }
    } catch (fsErr: any) {
      return NextResponse.json({ error: fsErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true, message: "Delete simulation succeeded." });
}

export async function PUT(req: Request) {
  let body: any = null;
  try {
    body = await req.json();
  } catch (e) {}

  if (!body || !body.record) {
    return NextResponse.json({ error: "Missing record data" }, { status: 400 });
  }

  const record = normaliseRecord(body.record);
  const id = record._id || record.id;
  if (!id) {
    return NextResponse.json({ error: "Missing record ID" }, { status: 400 });
  }

  if (OFFLINE_MODE === false) {
    const toFirestoreDocument = (obj: any) => {
      const fields: any = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val === null || val === undefined) continue;
        if (typeof val === "string") {
          fields[key] = { stringValue: val };
        } else if (typeof val === "number") {
          if (Number.isInteger(val)) {
            fields[key] = { integerValue: val.toString() };
          } else {
            fields[key] = { doubleValue: val };
          }
        } else if (typeof val === "boolean") {
          fields[key] = { booleanValue: val };
        } else if (Array.isArray(val)) {
          fields[key] = {
            arrayValue: {
              values: val.map(item => {
                if (typeof item === "object") {
                  return { stringValue: JSON.stringify(item) };
                }
                return { stringValue: String(item) };
              })
            }
          };
        } else if (typeof val === "object") {
          fields[key] = { stringValue: JSON.stringify(val) };
        }
      }
      return { fields };
    };

    try {
      const category = record.asset_category || "sealed";
      const tableName = categoryToTable[category] || "survey_sealed_roads";
      const supabaseRow = mapDraftToSupabaseTable(record, tableName);

      // Update directly in Supabase using PATCH
      const res = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}?survey_id=eq.${id}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "apikey": SUPABASE_ANON_KEY,
          "Authorization": `Bearer ${SUPABASE_ANON_KEY}`,
          "Prefer": "return=representation"
        },
        body: JSON.stringify(supabaseRow)
      });

      if (res.ok) {
        // Parallel update in Firebase
        try {
          const firestoreDoc = toFirestoreDocument(supabaseRow);
          await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIREBASE_DB}/documents/${tableName}/${id}`,
            {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(firestoreDoc)
            }
          );
        } catch (e) {
          console.error("Firebase parallel update failed:", e);
        }

        const updatedData = await res.json();
        invalidateServerCache();
        return NextResponse.json({ success: true, record: updatedData[0] || record, source: "server" });
      } else {
        const errText = await res.text();
        return NextResponse.json({ error: `Server update failed: ${errText}` }, { status: res.status });
      }
    } catch (err: any) {
      return NextResponse.json({ error: `Cannot reach server: ${err.message}` }, { status: 502 });
    }
  } else {
    try {
      const cachePath = path.resolve(process.cwd(), "public", "roads-data.json");
      if (fs.existsSync(cachePath)) {
        const fileContent = fs.readFileSync(cachePath, "utf-8");
        const json = JSON.parse(fileContent);
        const index = json.records.findIndex((r: any) => String(r._id) === String(id));
        if (index !== -1) {
          let updatedRecord = { ...json.records[index], ...record };
          if (record.gps) {
            const parts = String(record.gps).split(" ");
            if (parts.length >= 2) {
              try {
                const lat = parseFloat(parts[0]);
                const lng = parseFloat(parts[1]);
                updatedRecord._geolocation = [lat, lng];
                updatedRecord.road_name = classifyHighway(lat, lng);
              } catch (e) {}
            }
          }
          updatedRecord = normaliseRecord(updatedRecord);
          json.records[index] = updatedRecord;
          json.count = json.records.length;
          fs.writeFileSync(cachePath, JSON.stringify(json, null, 2), "utf-8");
          return NextResponse.json({ success: true, record: updatedRecord, source: "local_cache" });
        } else {
          return NextResponse.json({ error: `Record with ID ${id} not found` }, { status: 404 });
        }
      }
    } catch (fsErr: any) {
      return NextResponse.json({ error: fsErr.message }, { status: 500 });
    }
  }
  return NextResponse.json({ success: true, record });
}


