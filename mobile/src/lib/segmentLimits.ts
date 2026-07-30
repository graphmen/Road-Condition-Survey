/** Segment length bounds per review (urban vs rural road class). */
export const SEGMENT_MIN_M = 0;
export const SEGMENT_MAX_URBAN_M = 500;
export const SEGMENT_MAX_RURAL_M = 5000;
/** Allow small GPS overshoot when auto-stopping at the limit. */
export const SEGMENT_LENGTH_TOLERANCE_M = 75;

export function segmentMaxLengthM(roadClass: string): number {
  const urban =
    roadClass.startsWith("urban_") ||
    roadClass === "industrial";
  return urban ? SEGMENT_MAX_URBAN_M : SEGMENT_MAX_RURAL_M;
}

export function validateSegmentLengthM(
  lengthM: number,
  roadClass: string
): { ok: true } | { ok: false; message: string } {
  const max = segmentMaxLengthM(roadClass);
  if (lengthM < SEGMENT_MIN_M) {
    return { ok: false, message: `Segment must be at least ${SEGMENT_MIN_M} m.` };
  }
  if (lengthM > max + SEGMENT_LENGTH_TOLERANCE_M) {
    const kind = max === SEGMENT_MAX_URBAN_M ? "urban" : "rural";
    return {
      ok: false,
      message: `Segment ${lengthM.toFixed(0)} m exceeds ${kind} limit (${max} m). End segment and start a new one.`,
    };
  }
  return { ok: true };
}

export function fmtSegmentLimitHint(roadClass: string): string {
  const max = segmentMaxLengthM(roadClass);
  const kind = max === SEGMENT_MAX_URBAN_M ? "Urban" : "Rural";
  return `${kind} segment limit: ${SEGMENT_MIN_M}–${max} m`;
}
