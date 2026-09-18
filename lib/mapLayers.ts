export type BasemapId = "hybrid" | "roadmap" | "satellite" | "terrain" | "osm";

export type OverlayLayerKey =
  | "sealed"
  | "gravel"
  | "earth"
  | "bridge"
  | "footbridge"
  | "rail_crossing"
  | "tollgate"
  | "layby"
  | "busstop"
  | "junction"
  | "sign"
  | "shelvet"
  | "culvert"
  | "piped_causeway"
  | "drift"
  | "grid"
  | "catchpit"
  | "traffic_calming"
  | "traffic_lights"
  | "streetlight"
  | "unknown";

export interface BasemapDef {
  id: BasemapId;
  label: string;
  emoji: string;
  url: string;
  attribution: string;
}

export interface OverlayLayerDef {
  key: OverlayLayerKey;
  label: string;
  emoji: string;
  /** GeoServer layer name once the store is published. */
  geoserverLayer: string;
}

export interface OverlayGroupDef {
  id: string;
  label: string;
  items: OverlayLayerDef[];
}

export const GEOSERVER_WORKSPACE = "road_condition";

export const BASEMAPS: Record<BasemapId, BasemapDef> = {
  hybrid: {
    id: "hybrid",
    label: "Hybrid",
    emoji: "🌍",
    url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  roadmap: {
    id: "roadmap",
    label: "Road Map",
    emoji: "🗺️",
    url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  satellite: {
    id: "satellite",
    label: "Satellite",
    emoji: "🛰️",
    url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  terrain: {
    id: "terrain",
    label: "Terrain",
    emoji: "⛰️",
    url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",
    attribution: "&copy; Google Maps",
  },
  osm: {
    id: "osm",
    label: "OpenStreetMap",
    emoji: "🗾",
    url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",
    attribution: "&copy; OpenStreetMap contributors",
  },
};

export const OVERLAY_GROUPS: OverlayGroupDef[] = [
  {
    id: "roads",
    label: "Roads",
    items: [
      { key: "sealed", label: "Sealed Roads", emoji: "🛣️", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_sealed_roads` },
      { key: "gravel", label: "Gravel Roads", emoji: "🪨", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_gravel_roads` },
      { key: "earth", label: "Earth Roads", emoji: "🚜", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_earth_roads` },
    ],
  },
  {
    id: "structures",
    label: "Structures",
    items: [
      { key: "bridge", label: "Bridges", emoji: "🌉", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_bridges` },
      { key: "footbridge", label: "Foot Bridges", emoji: "🚶", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_footbridges` },
      { key: "rail_crossing", label: "Rail Crossings", emoji: "🛤️", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_rail_crossings` },
      { key: "tollgate", label: "Tollgates", emoji: "🪙", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_tollgates` },
      { key: "drift", label: "Drifts", emoji: "🌊", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_drifts` },
    ],
  },
  {
    id: "drainage",
    label: "Drainage",
    items: [
      { key: "culvert", label: "Culverts", emoji: "🕳️", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_culverts` },
      { key: "piped_causeway", label: "Piped Causeways", emoji: "🌁", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_piped_causeways` },
      { key: "shelvet", label: "Shelverts", emoji: "🧱", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_shelverts` },
      { key: "grid", label: "Cattle Grids", emoji: "🐄", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_grids` },
      { key: "catchpit", label: "Catchpits", emoji: "🕳️", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_catchpits` },
    ],
  },
  {
    id: "amenities",
    label: "Amenities",
    items: [
      { key: "layby", label: "Lay-bys", emoji: "🅿️", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_laybys` },
      { key: "busstop", label: "Bus Stops", emoji: "🚌", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_busstops` },
      { key: "junction", label: "Junctions", emoji: "🔀", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_junctions` },
    ],
  },
  {
    id: "traffic",
    label: "Traffic & Lighting",
    items: [
      { key: "sign", label: "Road Signs", emoji: "⚠️", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_road_signs` },
      { key: "traffic_calming", label: "Traffic Calming", emoji: "🛑", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_traffic_calming` },
      { key: "traffic_lights", label: "Traffic Lights", emoji: "🚦", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_traffic_lights` },
      { key: "streetlight", label: "Streetlights", emoji: "💡", geoserverLayer: `${GEOSERVER_WORKSPACE}:survey_streetlights` },
    ],
  },
];

export const ALL_OVERLAY_KEYS: OverlayLayerKey[] = [
  ...OVERLAY_GROUPS.flatMap((group) => group.items.map((item) => item.key)),
  "unknown",
];

export const INITIAL_VISIBLE_LAYERS: Record<string, boolean> = Object.fromEntries(
  ALL_OVERLAY_KEYS.map((key) => [key, true])
);

export function countByLayer(records: any[], getCategoryKey: (r: any) => string): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const record of records) {
    const key = getCategoryKey(record) || "unknown";
    counts[key] = (counts[key] || 0) + 1;
  }
  return counts;
}
