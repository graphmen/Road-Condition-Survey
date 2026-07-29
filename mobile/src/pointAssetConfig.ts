import type { Option } from "./components/SelectWithOther";

/** Full road class list for rail crossings and similar point assets. */
export const ROAD_CLASS_OPTIONS: Option[] = [
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

export const VEGETATION_OPTIONS = [
  { value: "none", label: "None" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "dense", label: "Dense" },
] as const;

export const CONDITION_GFP: Option[] = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
];

export const YES_NO_PARTIAL: Option[] = [
  { value: "yes", label: "Yes" },
  { value: "partial", label: "Partial" },
  { value: "no", label: "No" },
];
