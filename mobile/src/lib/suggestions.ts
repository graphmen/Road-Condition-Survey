import type { SurveyDraft } from "./db";

/** Collect unique non-empty values for a field from saved drafts. */
export function suggestFromDrafts(
  drafts: SurveyDraft[],
  getters: Array<(d: SurveyDraft) => string | undefined | null>,
): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const d of drafts) {
    for (const get of getters) {
      const raw = get(d);
      if (!raw) continue;
      const v = String(raw).trim();
      if (!v || seen.has(v.toLowerCase())) continue;
      seen.add(v.toLowerCase());
      out.push(v);
    }
  }
  return out;
}

export function highwaySuggestions(drafts: SurveyDraft[]): string[] {
  return suggestFromDrafts(drafts, [
    (d) => d.road_name,
    (d) => d.paved_road_name,
    (d) => d.gravel_road_name,
    (d) => d.earth_road_name,
    (d) => d.Road_Name_002,
    (d) => d.Road_Name,
  ]);
}

export function sectionSuggestions(drafts: SurveyDraft[]): string[] {
  return suggestFromDrafts(drafts, [(d) => d.section_name]);
}

export function surveyorSuggestions(drafts: SurveyDraft[]): string[] {
  return suggestFromDrafts(drafts, [(d) => d.surveyor_name]);
}

export function assetNameSuggestions(drafts: SurveyDraft[], category: string): string[] {
  return suggestFromDrafts(drafts, [
    (d) => (d.asset_category === category || !d.asset_category ? d.paved_road_name : undefined),
    (d) => d.gravel_road_name,
    (d) => d.earth_road_name,
    (d) => d.bridge,
    (d) => (d as any).footbridge_name,
    (d) => (d as any).tollgate_name,
  ]);
}
