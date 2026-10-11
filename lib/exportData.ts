import {
  getAssetName,
  getAssetType,
  getCategoryKey,
  getRecordStatus,
  resolveAssetLocation,
} from "@/components/helpers";

export const EXPORT_PARAMETERS = [
  { key: "sealed", label: "Sealed Roads", emoji: "🛣️", table: "survey_sealed_roads" },
  { key: "gravel", label: "Gravel Roads", emoji: "🪨", table: "survey_gravel_roads" },
  { key: "earth", label: "Earth Roads", emoji: "🚜", table: "survey_earth_roads" },
  { key: "bridge", label: "Bridges", emoji: "🌉", table: "survey_bridges" },
  { key: "footbridge", label: "Foot Bridges", emoji: "🚶", table: "survey_footbridges" },
  { key: "rail_crossing", label: "Rail Crossings", emoji: "🛤️", table: "survey_rail_crossings" },
  { key: "tollgate", label: "Tollgates", emoji: "🪙", table: "survey_tollgates" },
  { key: "drift", label: "Drifts", emoji: "🌊", table: "survey_drifts" },
  { key: "culvert", label: "Culverts", emoji: "🕳️", table: "survey_culverts" },
  { key: "piped_causeway", label: "Piped Causeways", emoji: "🌁", table: "survey_piped_causeways" },
  { key: "shelvet", label: "Shelverts", emoji: "🧱", table: "survey_shelvets" },
  { key: "grid", label: "Cattle Grids", emoji: "🐄", table: "survey_grids" },
  { key: "catchpit", label: "Catchpits", emoji: "🕳️", table: "survey_catchpits" },
  { key: "layby", label: "Lay-bys", emoji: "🅿️", table: "survey_laybys" },
  { key: "busstop", label: "Bus Stops", emoji: "🚌", table: "survey_busstops" },
  { key: "junction", label: "Junctions", emoji: "🔀", table: "survey_junctions" },
  { key: "road_rupture", label: "Road Ruptures", emoji: "⚠️", table: "survey_road_ruptures" },
  { key: "sign", label: "Road Signs", emoji: "⚠️", table: "survey_road_signs" },
  { key: "traffic_lights", label: "Traffic Lights", emoji: "🚦", table: "survey_traffic_lights" },
  { key: "traffic_calming", label: "Traffic Calming", emoji: "🛑", table: "survey_traffic_calming" },
  { key: "streetlight", label: "Streetlights", emoji: "💡", table: "survey_streetlights" },
  { key: "unknown", label: "Uncategorised", emoji: "❓", table: "survey_uncategorised" },
] as const;

export type ExportParamKey = (typeof EXPORT_PARAMETERS)[number]["key"];
export const ALL_PARAM_KEYS: string[] = EXPORT_PARAMETERS.map((p) => p.key);

const EXCLUDED_KEYS = new Set([
  "_id",
  "_geolocation",
  "gps",
  "raw_data",
  "geom_point",
  "geom_segment",
  "road_segment_geojson",
  "segment_geojson",
  "road_segment_points",
  "created_at",
  "geom",
  "geometry",
  "type",
  "coordinates",
  "features",
  "properties",
  "geom_point_wkt",
  "geom_segment_wkt",
  "id",
  "uuid",
  "photo",
  "photos",
]);

const CORE_KEYS = [
  "asset_name",
  "asset_type",
  "asset_category",
  "condition",
  "highway_id",
  "road_name",
  "section_name",
  "province",
  "district",
  "surveyor_name",
  "survey_date",
  "latitude",
  "longitude",
] as const;

export type ExportFormat = "csv" | "json" | "geojson" | "kml";

export function formatExportKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatExportValue(val: unknown): string {
  if (val === null || val === undefined) return "";
  if (typeof val === "boolean") return val ? "YES" : "NO";
  if (typeof val === "object") {
    try { return JSON.stringify(val); } catch { return String(val); }
  }
  return String(val);
}

export function getExportGeometry(record: any): { type: string; coordinates: any } | null {
  if (!record) return null;
  const geojsonStr = record.road_segment_geojson || record.segment_geojson || record.raw_data?.road_segment_geojson || record.raw_data?.segment_geojson;
  if (geojsonStr) {
    try {
      const geojson = typeof geojsonStr === "string" ? JSON.parse(geojsonStr) : geojsonStr;
      if (geojson?.type === "Feature" && geojson.geometry) return geojson.geometry;
      if (geojson?.type === "LineString" && Array.isArray(geojson.coordinates)) return geojson;
      if (geojson?.type === "Point" && Array.isArray(geojson.coordinates)) return geojson;
    } catch {
      /* fall through */
    }
  }

  const loc = resolveAssetLocation(record);
  if (loc?.kind === "line" && loc.coords.length > 1) {
    return { type: "LineString", coordinates: loc.coords.map(([lat, lng]) => [lng, lat]) };
  }
  if (loc) {
    return { type: "Point", coordinates: [loc.lng, loc.lat] };
  }
  return null;
}

function latLng(record: any): { latitude: string; longitude: string } {
  const loc = resolveAssetLocation(record);
  if (!loc) return { latitude: "", longitude: "" };
  return { latitude: String(loc.lat), longitude: String(loc.lng) };
}

export function recordToExportObject(record: any, extra: { highway_id?: string | null } = {}): Record<string, unknown> {
  const ll = latLng(record);
  const obj: Record<string, unknown> = {
    asset_name: getAssetName(record),
    asset_type: getAssetType(record),
    asset_category: getCategoryKey(record),
    condition: getRecordStatus(record),
    highway_id: extra.highway_id || "",
    road_name: record.road_name ?? "",
    section_name: record.section_name ?? "",
    province: record.province ?? "",
    district: record.district ?? "",
    surveyor_name: record.surveyor_name ?? "",
    survey_date: record.survey_date ?? "",
    latitude: ll.latitude,
    longitude: ll.longitude,
  };

  for (const k of Object.keys(record || {})) {
    if (EXCLUDED_KEYS.has(k) || CORE_KEYS.includes(k as any) || obj[k] !== undefined) continue;
    const v = record[k];
    if (v === null || v === undefined || v === "") continue;
    obj[k] = v;
  }
  return obj;
}

export function collectExportColumns(records: any[], extras: Map<any, { highway_id?: string | null }>): string[] {
  const extra = new Set<string>();
  for (const r of records) {
    const obj = recordToExportObject(r, extras.get(r) || {});
    for (const k of Object.keys(obj)) {
      if (!CORE_KEYS.includes(k as any)) extra.add(k);
    }
  }
  return [...CORE_KEYS, ...Array.from(extra).sort()];
}

export function toCsv(records: any[], columns: string[], extras: Map<any, { highway_id?: string | null }>): string {
  const header = columns.map((c) => `"${formatExportKey(c).replace(/"/g, '""')}"`).join(",");
  const rows = records.map((r) => {
    const obj = recordToExportObject(r, extras.get(r) || {});
    return columns.map((col) => {
      const cell = formatExportValue(obj[col] ?? "");
      return `"${cell.replace(/"/g, '""')}"`;
    }).join(",");
  });
  return `\uFEFF${[header, ...rows].join("\n")}`;
}

export function toJson(records: any[], extras: Map<any, { highway_id?: string | null }>): string {
  return JSON.stringify(records.map((r) => recordToExportObject(r, extras.get(r) || {})), null, 2);
}

export function toGeoJson(records: any[], extras: Map<any, { highway_id?: string | null }>): { text: string; skipped: number } {
  const features: any[] = [];
  let skipped = 0;
  for (const r of records) {
    const geom = getExportGeometry(r);
    if (!geom) {
      skipped += 1;
      continue;
    }
    features.push({
      type: "Feature",
      geometry: geom,
      properties: recordToExportObject(r, extras.get(r) || {}),
    });
  }
  return {
    text: JSON.stringify({ type: "FeatureCollection", features }, null, 2),
    skipped,
  };
}

function xmlEscape(s: unknown): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function kmlCoords(geom: { type: string; coordinates: any }): string {
  if (geom.type === "Point") {
    const [lng, lat] = geom.coordinates;
    return `${lng},${lat},0`;
  }
  if (geom.type === "LineString") {
    return geom.coordinates.map((c: number[]) => `${c[0]},${c[1]},0`).join(" ");
  }
  return "";
}

export function toKml(
  groups: { name: string; records: any[] }[],
  extras: Map<any, { highway_id?: string | null }>,
  title: string
): { text: string; skipped: number } {
  let skipped = 0;
  let body = "";

  for (const group of groups) {
    body += `    <Folder>\n      <name>${xmlEscape(group.name)}</name>\n`;
    for (const r of group.records) {
      const geom = getExportGeometry(r);
      if (!geom) {
        skipped += 1;
        continue;
      }
      const cond = getRecordStatus(r);
      const styleId = cond === "good" ? "goodStyle" : cond === "fair" ? "fairStyle" : cond === "poor" ? "poorStyle" : "defaultStyle";
      const obj = recordToExportObject(r, extras.get(r) || {});
      const descRows = Object.entries(obj)
        .filter(([, v]) => v !== null && v !== undefined && v !== "")
        .map(([k, v]) => `<tr><td><b>${xmlEscape(formatExportKey(k))}</b></td><td>${xmlEscape(formatExportValue(v))}</td></tr>`)
        .join("");
      const coords = kmlCoords(geom);
      const shape = geom.type === "LineString"
        ? `      <LineString><tessellate>1</tessellate><coordinates>${coords}</coordinates></LineString>\n`
        : `      <Point><coordinates>${coords}</coordinates></Point>\n`;
      body += `      <Placemark>\n`;
      body += `        <name>${xmlEscape(getAssetName(r))}</name>\n`;
      body += `        <styleUrl>#${styleId}</styleUrl>\n`;
      body += `        <description><![CDATA[<table border="1" style="border-collapse:collapse;font-family:sans-serif;font-size:11px;width:100%"><tr style="background:#006633;color:#fff"><th>Attribute</th><th>Value</th></tr>${descRows}</table>]]></description>\n`;
      body += shape;
      body += `      </Placemark>\n`;
    }
    body += `    </Folder>\n`;
  }

  const text = `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2">
  <Document>
    <name>${xmlEscape(title)}</name>
    <Style id="goodStyle"><LineStyle><color>ff336600</color><width>4</width></LineStyle><IconStyle><color>ff336600</color><scale>1.1</scale></IconStyle></Style>
    <Style id="fairStyle"><LineStyle><color>ff0b9ef5</color><width>4</width></LineStyle><IconStyle><color>ff0b9ef5</color><scale>1.1</scale></IconStyle></Style>
    <Style id="poorStyle"><LineStyle><color>ff2626dc</color><width>4</width></LineStyle><IconStyle><color>ff2626dc</color><scale>1.1</scale></IconStyle></Style>
    <Style id="defaultStyle"><LineStyle><color>ff888888</color><width>4</width></LineStyle><IconStyle><color>ff888888</color><scale>1.1</scale></IconStyle></Style>
${body}  </Document>
</kml>
`;
  return { text, skipped };
}

export function paramLabel(key: string): string {
  return EXPORT_PARAMETERS.find((p) => p.key === key)?.label || key;
}

export function tableFileName(key: string, ext: string): string {
  const p = EXPORT_PARAMETERS.find((x) => x.key === key);
  const stub = p?.table || fileStub(p?.label || key);
  return `${stub}.${ext}`;
}

export function fileStub(label: string): string {
  return label.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
}
