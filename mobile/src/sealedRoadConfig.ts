import type { Option } from "./components/SelectWithOther";

export const SEALED_ROAD_CLASS_OPTIONS: Option[] = [
  { value: "primary", label: "Primary" },
  { value: "secondary", label: "Secondary" },
  { value: "regional", label: "Regional" },
  { value: "tertiary_feeder", label: "Tertiary Feeder" },
  { value: "tertiary_access", label: "Tertiary Access" },
  { value: "urban_arterial", label: "Urban Arterial" },
  { value: "urban_collector", label: "Urban Collector" },
  { value: "urban_local", label: "Urban Local" },
  { value: "industrial", label: "Industrial" },
];

export const SEALED_ROAD_TYPE_OPTIONS: Option[] = [
  { value: "wide_mat_ss", label: "Wide Mat SS" },
  { value: "wide_mat_gs", label: "Wide Mat GS" },
  { value: "narrow_mat", label: "Narrow Mat" },
  { value: "strip", label: "Strip" },
  { value: "dual_carriageway", label: "Dual carriageway" },
];

export const SURFACE_TYPE_OPTIONS: Option[] = [
  { value: "asphalt", label: "Asphalt" },
  { value: "concrete", label: "Concrete" },
  { value: "block_paving", label: "Block paving" },
  { value: "surface_dressing", label: "Surface dressing" },
  { value: "other", label: "Other" },
];

export const POTHOLE_DENSITY_OPTIONS: Option[] = [
  { value: "low", label: "Low" },
  { value: "medium", label: "Medium" },
  { value: "high", label: "High" },
];

/** Pothole / patch condition — "good" legacy maps to no_potholes on load. */
export const POTHOLE_PATCHES_OPTIONS: Option[] = [
  { value: "no_potholes", label: "No potholes" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "mixed", label: "Mixed" },
];

export const DRAINAGE_TYPE_OPTIONS: Option[] = [
  { value: "none", label: "None" },
  { value: "no_drain", label: "No drain" },
  { value: "v_drain", label: "V-drain" },
  { value: "trapezoidal", label: "Trapezoidal" },
  { value: "piped", label: "Piped" },
  { value: "kerb", label: "Kerb" },
];

export const DRAINAGE_LINING_OPTIONS: Option[] = [
  { value: "lined", label: "Lined" },
  { value: "not_lined", label: "Not lined" },
  { value: "mixed", label: "Mixed" },
];

export const MEDIAN_TYPE_OPTIONS: Option[] = [
  { value: "none", label: "None" },
  { value: "raised", label: "Raised" },
  { value: "depressed", label: "Depressed" },
  { value: "barrier", label: "Barrier" },
  { value: "other", label: "Other" },
];

export const SURVEY_SIDE_OPTIONS: Option[] = [
  { value: "left", label: "Left" },
  { value: "right", label: "Right" },
];

export const YES_NO_OPTIONS: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "no", label: "No" },
];

/** Defect severity / extent for gravel roads. */
export const DEFECT_SEVERITY_OPTIONS: Option[] = [
  { value: "none", label: "None" },
  { value: "minor", label: "Minor" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
  { value: "mixed", label: "Mixed" },
];

export const TRAFFIC_CALMING_TYPES: Option[] = [
  { value: "speed_hump", label: "Speed hump" },
  { value: "rumble_strip", label: "Rumble strip" },
  { value: "dip", label: "Dip" },
  { value: "other", label: "Other" },
];

export function isDualCarriageway(roadType: string): boolean {
  return roadType === "dual_carriageway";
}

export function isUrbanRoadClass(roadClass: string): boolean {
  return roadClass.startsWith("urban_");
}
