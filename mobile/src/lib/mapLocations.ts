/** Map location helpers for mobile progress view (mirrors dashboard resolveAssetLocation). */

export type AssetMapLocation =
  | { kind: "point"; lat: number; lng: number }
  | { kind: "line"; coords: [number, number][]; lat: number; lng: number };

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

function parseSegmentCoords(record: Record<string, unknown>): [number, number][] | null {
  const points = record.road_segment_points;
  if (Array.isArray(points) && points.length >= 2) {
    const pairs = points
      .map((p: { lat?: number; lng?: number }) => [Number(p.lat), Number(p.lng)] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    if (pairs.length >= 2) return pairs;
  }

  const geojsonStr =
    record.road_segment_geojson ||
    record.segment_geojson ||
    (record.raw_data as Record<string, unknown> | undefined)?.road_segment_geojson ||
    (record.raw_data as Record<string, unknown> | undefined)?.segment_geojson;

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
      .map((c: number[]) => [Number(c[1]), Number(c[0])] as [number, number])
      .filter(([lat, lng]) => Number.isFinite(lat) && Number.isFinite(lng));
    return pairs.length >= 2 ? pairs : null;
  } catch {
    return null;
  }
}

export function resolveRecordLocation(record: Record<string, unknown> | null | undefined): AssetMapLocation | null {
  if (!record) return null;

  const gpsPoint =
    parseLatLngValue(record._geolocation) ||
    parseLatLngValue(record.gps) ||
    parseLatLngValue(record.gps_point);

  const segLine = parseSegmentCoords(record);

  if (segLine && segLine.length >= 2) {
    const mid = segLine[Math.floor(segLine.length / 2)];
    return { kind: "line", coords: segLine, lat: mid[0], lng: mid[1] };
  }

  if (gpsPoint) {
    return { kind: "point", lat: gpsPoint[0], lng: gpsPoint[1] };
  }

  return null;
}

export function getRecordId(record: Record<string, unknown>): string {
  return String(record.id ?? record._id ?? record.survey_id ?? "");
}
