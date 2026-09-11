/** Shared upload slimming for mobile + dashboard API writes. */

const RAW_DATA_OMIT = new Set([
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
  "road_segment_surveys",
  "road_segment_surveys_2",
]);

function slimSegmentSurveysForSync(surveys: unknown): unknown {
  if (!Array.isArray(surveys)) return surveys;
  return surveys.map((seg) => {
    if (!seg || typeof seg !== "object") return seg;
    const s = seg as Record<string, unknown>;
    const geometry = s.geometry as Record<string, unknown> | undefined;
    return {
      vegetation: s.vegetation,
      chainage_from_km: s.chainage_from_km,
      chainage_to_km: s.chainage_to_km,
      survey_notes: s.survey_notes,
      attrs: s.attrs,
      photo_count: Array.isArray(s.photos) ? s.photos.length : 0,
      geometry: geometry
        ? {
            length_m: geometry.length_m,
            point_count: geometry.point_count,
            geojson: geometry.geojson,
            start_time: geometry.start_time,
            end_time: geometry.end_time,
            avg_accuracy_m: geometry.avg_accuracy_m,
          }
        : undefined,
    };
  });
}

export function buildSyncRawData(draft: Record<string, unknown>): Record<string, unknown> {
  const raw: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(draft)) {
    if (RAW_DATA_OMIT.has(key)) continue;
    if (key === "road_segment_surveys" || key === "road_segment_surveys_2") {
      raw[key] = slimSegmentSurveysForSync(val);
      continue;
    }
    raw[key] = val;
  }
  return raw;
}

export function limitSyncPhotos(draft: Record<string, unknown>, max = 4): string[] {
  const photos: string[] = [];
  const add = (item: unknown) => {
    if (typeof item === "string" && item.trim()) photos.push(item.trim());
  };
  if (Array.isArray(draft.photos)) draft.photos.forEach(add);
  add(draft.photo);
  return Array.from(new Set(photos)).slice(0, max);
}
