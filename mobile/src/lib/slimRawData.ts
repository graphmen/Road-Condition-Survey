/** Fields stored in dedicated DB columns — omit from raw_data JSONB to keep payloads small. */
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
]);

export function slimRawData(draft: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(draft).filter(([k]) => !RAW_DATA_OMIT.has(k)));
}
