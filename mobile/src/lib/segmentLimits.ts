/** Segment length bounds per review (urban vs rural road class). */
export const SEGMENT_MIN_M = 0;
export const SEGMENT_MAX_URBAN_M = 500;
/** Gravel urban GPS line surveys use the same 5 km cap as rural (field review). */
export const SEGMENT_MAX_GRAVEL_URBAN_M = 5000;
export const SEGMENT_MAX_RURAL_M = 5000;
/** Allow small GPS overshoot when auto-stopping at the limit. */
export const SEGMENT_LENGTH_TOLERANCE_M = 75;

export function isUrbanSegmentClass(roadClass: string): boolean {
  return roadClass.startsWith("urban_") || roadClass === "industrial";
}

export function segmentMaxLengthM(roadClass: string, assetCategory?: string): number {
  if (!isUrbanSegmentClass(roadClass)) return SEGMENT_MAX_RURAL_M;
  if (assetCategory === "gravel") return SEGMENT_MAX_GRAVEL_URBAN_M;
  return SEGMENT_MAX_URBAN_M;
}

export function validateSegmentLengthM(
  lengthM: number,
  roadClass: string,
  assetCategory?: string
): { ok: true } | { ok: false; message: string } {
  const max = segmentMaxLengthM(roadClass, assetCategory);
  if (lengthM < SEGMENT_MIN_M) {
    return { ok: false, message: `Segment must be at least ${SEGMENT_MIN_M} m.` };
  }
  if (lengthM > max + SEGMENT_LENGTH_TOLERANCE_M) {
    const kind = isUrbanSegmentClass(roadClass) ? "urban" : "rural";
    return {
      ok: false,
      message: `Segment ${lengthM.toFixed(0)} m exceeds ${kind} limit (${max} m). End segment and start a new one.`,
    };
  }
  return { ok: true };
}

export function fmtSegmentLimitHint(roadClass: string, assetCategory?: string): string {
  const max = segmentMaxLengthM(roadClass, assetCategory);
  const kind = isUrbanSegmentClass(roadClass) ? "Urban" : "Rural";
  return `${kind} segment limit: ${SEGMENT_MIN_M}–${max} m`;
}
