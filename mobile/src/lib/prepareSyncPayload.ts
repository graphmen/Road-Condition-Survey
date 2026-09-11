import type { RoadSegmentSurvey } from "./roadSegmentSurvey";
import { slimRawData } from "./slimRawData";

const SYNC_RAW_OMIT = new Set([
  "photo",
  "photos",
  "road_segment_points",
  "road_segment_geojson",
  "road_segment_length_m",
  "road_segment_start_time",
  "road_segment_end_time",
  "road_segment_avg_accuracy_m",
  "road_segment_point_count",
  "road_segment_points_2",
  "road_segment_geojson_2",
  "road_segment_length_m_2",
  "road_segment_start_time_2",
  "road_segment_end_time_2",
  "road_segment_avg_accuracy_m_2",
  "road_segment_point_count_2",
  "road_segment_parts",
  "road_segment_parts_2",
]);

/** Drop heavy GPS point arrays from segment surveys — keep attrs + line GeoJSON for map. */
function slimSegmentSurveysForSync(surveys: unknown): unknown {
  if (!Array.isArray(surveys)) return surveys;
  return (surveys as RoadSegmentSurvey[]).map((seg) => ({
    vegetation: seg.vegetation,
    chainage_from_km: seg.chainage_from_km,
    chainage_to_km: seg.chainage_to_km,
    survey_notes: seg.survey_notes,
    attrs: seg.attrs,
    photo_count: Array.isArray(seg.photos) ? seg.photos.length : 0,
    geometry: seg.geometry
      ? {
          length_m: seg.geometry.length_m,
          point_count: seg.geometry.point_count,
          geojson: seg.geometry.geojson,
          start_time: seg.geometry.start_time,
          end_time: seg.geometry.end_time,
          avg_accuracy_m: seg.geometry.avg_accuracy_m,
        }
      : undefined,
  }));
}

/** Strip blobs and duplicate geometry before upload — keeps map + attributes intact. */
export function prepareSyncPayload(draft: Record<string, unknown>): Record<string, unknown> {
  const base = slimRawData(draft);
  const raw: Record<string, unknown> = {};

  for (const [key, val] of Object.entries(base)) {
    if (SYNC_RAW_OMIT.has(key)) continue;
    if (key === "road_segment_surveys" || key === "road_segment_surveys_2") {
      raw[key] = slimSegmentSurveysForSync(val);
      continue;
    }
    raw[key] = val;
  }

  const photos: string[] = [];
  const addPhoto = (item: unknown) => {
    if (typeof item === "string" && item.trim()) photos.push(item.trim());
  };
  if (Array.isArray(draft.photos)) draft.photos.forEach(addPhoto);
  addPhoto(draft.photo);

  const uniquePhotos = Array.from(new Set(photos)).slice(0, 4);

  return {
    ...draft,
    photo: uniquePhotos[0] || undefined,
    photos: uniquePhotos.length > 0 ? uniquePhotos : undefined,
    raw_data: raw,
    source: "mobile_app",
  };
}

export async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs = 120_000
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...init, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}
