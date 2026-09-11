import type { SegmentGeometry } from "../components/SegmentTracker";

/** One GPS segment with its own attribute form data. */
export interface RoadSegmentSurvey {
  geometry: SegmentGeometry;
  vegetation: string;
  photos: string[];
  chainage_from_km?: number;
  chainage_to_km?: number;
  survey_notes?: string;
  /** Category-specific fields (sealed / gravel / earth). */
  attrs: Record<string, unknown>;
}

export function segmentSurveysToGeometries(surveys: RoadSegmentSurvey[]): SegmentGeometry[] {
  return surveys.map((s) => s.geometry);
}

export function totalSurveyLengthKm(surveys: RoadSegmentSurvey[]): string {
  const m = surveys.reduce((sum, s) => sum + (s.geometry.length_m || 0), 0);
  return m > 0 ? (m / 1000).toFixed(3) : "";
}

export function draftAttrsFromSegmentSurvey(seg: RoadSegmentSurvey): Record<string, unknown> {
  return {
    vegetation: seg.vegetation,
    photos: seg.photos,
    photo: seg.photos[0],
    chainage_from_km: seg.chainage_from_km,
    chainage_to_km: seg.chainage_to_km,
    survey_notes: seg.survey_notes,
    ...seg.attrs,
  };
}
