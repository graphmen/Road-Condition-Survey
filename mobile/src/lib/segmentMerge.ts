import type { SegmentGeometry } from "../components/SegmentTracker";

export function totalSegmentsLengthM(segments: SegmentGeometry[]): number {
  return segments.reduce((sum, seg) => sum + (seg.length_m || 0), 0);
}

export function mergeSegmentGeometries(segments: SegmentGeometry[]): SegmentGeometry | null {
  if (!segments.length) return null;
  if (segments.length === 1) return segments[0];

  const allPoints = segments.flatMap((seg) => seg.points);
  if (allPoints.length === 0) return null;

  const length_m = totalSegmentsLengthM(segments);
  const point_count = allPoints.length;
  const avg_accuracy_m =
    point_count > 0
      ? Math.round((allPoints.reduce((s, p) => s + p.acc, 0) / point_count) * 10) / 10
      : 0;

  const coordinates =
    segments.length === 1
      ? segments[0].points.map((p) => [p.lng, p.lat, p.alt ?? 0])
      : segments.map((seg) => seg.points.map((p) => [p.lng, p.lat, p.alt ?? 0]));

  const geojson = JSON.stringify({
    type: "Feature",
    geometry:
      segments.length === 1
        ? { type: "LineString", coordinates: coordinates[0] }
        : { type: "MultiLineString", coordinates },
    properties: {
      segment_count: segments.length,
      point_count,
      length_m,
    },
  });

  return {
    points: allPoints,
    geojson,
    length_m,
    start_time: segments[0].start_time,
    end_time: segments[segments.length - 1].end_time,
    avg_accuracy_m,
    point_count,
  };
}

export function segmentGeometryFromDraftParts(
  parts: SegmentGeometry[] | undefined,
  fallback?: Partial<{
    points: SegmentGeometry["points"];
    geojson: string;
    length_m: number;
    start_time: string;
    end_time: string;
    avg_accuracy_m: number;
    point_count: number;
  }>
): SegmentGeometry | null {
  if (parts?.length) return mergeSegmentGeometries(parts);
  if (!fallback?.points?.length) return null;
  return {
    points: fallback.points,
    geojson: fallback.geojson || "",
    length_m: fallback.length_m || 0,
    start_time: fallback.start_time || "",
    end_time: fallback.end_time || "",
    avg_accuracy_m: fallback.avg_accuracy_m || 0,
    point_count: fallback.point_count || fallback.points.length,
  };
}

export function gpsFromGeometry(geo: SegmentGeometry | null | undefined): string {
  if (!geo?.points?.length) return "";
  const firstPt = geo.points[0];
  return `${firstPt.lat.toFixed(6)} ${firstPt.lng.toFixed(6)} ${firstPt.alt ?? 1200} ${Math.round(firstPt.acc)}`;
}

export function formatTotalSegmentsLengthKm(segments: SegmentGeometry[]): string {
  const km = totalSegmentsLengthM(segments) / 1000;
  return km > 0 ? km.toFixed(3) : "";
}
