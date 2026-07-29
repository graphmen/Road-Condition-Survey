import React, { useState, useEffect } from "react";
import { db } from "./lib/db";
import type { SurveyDraft } from "./lib/db";
import { assetUrl } from "./lib/assets";
import { SegmentTracker, PAUSED_ROAD_CONTEXT_KEY, SEGMENT_SESSION_KEY } from "./components/SegmentTracker";
import type { SegmentGeometry } from "./components/SegmentTracker";
import { SurveyProgressPanel } from "./components/SurveyProgressPanel";
import { AutocompleteInput } from "./components/AutocompleteInput";
import { PhotoCapture, capturePhotoNativeOrNull } from "./components/PhotoCapture";
import {
  SEALED_ROAD_CLASS_OPTIONS,
  SEALED_ROAD_TYPE_OPTIONS,
  SURFACE_TYPE_OPTIONS,
  POTHOLE_DENSITY_OPTIONS,
  POTHOLE_PATCHES_OPTIONS,
  DRAINAGE_TYPE_OPTIONS,
  DRAINAGE_LINING_OPTIONS,
  MEDIAN_TYPE_OPTIONS,
  SURVEY_SIDE_OPTIONS,
  YES_NO_OPTIONS,
  DEFECT_SEVERITY_OPTIONS,
  TRAFFIC_CALMING_TYPES,
  isDualCarriageway,
} from "./sealedRoadConfig";
import { segmentMaxLengthM, fmtSegmentLimitHint, validateSegmentLengthM } from "./lib/segmentLimits";
import {
  SelectWithOther,
  AUTHORITY_OPTIONS,
  CONDITION_GFPM_CONSTRUCTION,
} from "./components/SelectWithOther";
import { ROAD_CLASS_OPTIONS, CONDITION_GFP } from "./pointAssetConfig";
import {
  highwaySuggestions,
  sectionSuggestions,
  surveyorSuggestions,
} from "./lib/suggestions";
import { Geolocation } from "@capacitor/geolocation";
import { Capacitor } from "@capacitor/core";
import { BackgroundGeolocation } from "@capgo/background-geolocation";
import {
  Database,
  PlusCircle,
  Trash2,
  Compass,
  AlertCircle,
  CheckCircle,
  Camera,
  Info,
  Activity,
  Settings as SettingsIcon,
  User,
  Edit,
  Server,
  Milestone,
  Trees,
  Mountain,
  Layers,
  Footprints,
  Train,
  CreditCard,
  MapPin,
  Bus,
  GitMerge,
  FolderOpen,
  CircleDot,
  Droplets,
  Droplet,
  Shield,
  Waves,
  Grid,
  Flame,
  Sun,
  Gauge,
  Play,
  Pause,
} from "lucide-react";

type RoadCategory = "sealed" | "gravel" | "earth";
type PausedRoadContext = {
  roadCategory: RoadCategory;
  roadName: string;
  sectionName: string;
  surveyorName: string;
  surveyDate: string;
  pointCount: number;
  length_m: number;
};

const PAUSED_ROAD_PHOTOS_KEY = "roads_paused_road_photos";
const MAX_ROAD_PHOTOS = 6;
const MAX_POINT_PHOTOS = 2;

function captureSurveyDate(): string {
  return new Date().toISOString().split("T")[0];
}

function normalizePhotos(s: { photos?: string[]; photo?: string | null } | null | undefined): string[] {
  if (!s) return [];
  if (Array.isArray(s.photos) && s.photos.length > 0) return s.photos.filter(Boolean);
  if (s.photo) return [s.photo];
  return [];
}

function clampPhotos(photos: string[], isRoad: boolean): string[] {
  const max = isRoad ? MAX_ROAD_PHOTOS : MAX_POINT_PHOTOS;
  return photos.slice(0, max);
}

function savePausedRoadPhotos(photos: string[]) {
  try {
    if (photos.length > 0) localStorage.setItem(PAUSED_ROAD_PHOTOS_KEY, JSON.stringify(photos));
    else localStorage.removeItem(PAUSED_ROAD_PHOTOS_KEY);
  } catch (e) {
    console.warn("Could not stash road photos while pausing:", e);
  }
}

function loadPausedRoadPhotos(): string[] {
  try {
    const raw = localStorage.getItem(PAUSED_ROAD_PHOTOS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((p) => typeof p === "string") : [];
  } catch {
    return [];
  }
}

function clearPausedRoadPhotos() {
  try {
    localStorage.removeItem(PAUSED_ROAD_PHOTOS_KEY);
  } catch { /* ignore */ }
}

function loadPausedRoadContext(): PausedRoadContext | null {
  try {
    const raw = localStorage.getItem(PAUSED_ROAD_CONTEXT_KEY);
    return raw ? (JSON.parse(raw) as PausedRoadContext) : null;
  } catch {
    return null;
  }
}

function mapLegacyPotholePatches(val: string | undefined): string {
  if (!val || val === "good") return "no_potholes";
  return val;
}

const ASSET_CLASSES = [
  {
    id: "sealed",
    label: "Sealed Roads",
    type: "Road",
    category: "roads",
    icon: <Milestone size={20} />,
    desc: "Paved highways & asphalt roads. Track segment lines & inspect cracks, potholes, rutting.",
    color: "#10b981",
    grad: "linear-gradient(135deg, #10b981, #047857)"
  },
  {
    id: "gravel",
    label: "Gravel Roads",
    type: "Road",
    category: "roads",
    icon: <Trees size={20} />,
    desc: "Unsealed gravel networks. Monitor corrugations, thickness, potholes, & grading.",
    color: "#059669",
    grad: "linear-gradient(135deg, #059669, #064e3b)"
  },
  {
    id: "earth",
    label: "Earth Roads",
    type: "Road",
    category: "roads",
    icon: <Mountain size={20} />,
    desc: "Natural dirt tracks. Verify seasonal passability, terrain, & water ponding points.",
    color: "#34d399",
    grad: "linear-gradient(135deg, #34d399, #047857)"
  },
  {
    id: "bridge",
    label: "Bridges",
    type: "Structure",
    category: "structures",
    icon: <Layers size={20} />,
    desc: "Major highway bridges. Assess joints, bearing conditions, parapets, & structural state.",
    color: "#d97706",
    grad: "linear-gradient(135deg, #f59e0b, #b45309)"
  },
  {
    id: "footbridge",
    label: "Foot Bridge",
    type: "Structure",
    category: "structures",
    icon: <Footprints size={20} />,
    desc: "Pedestrian crossings. Survey materials, deck spans, and walkway safety railings.",
    color: "#b45309",
    grad: "linear-gradient(135deg, #b45309, #78350f)"
  },
  {
    id: "rail_crossing",
    label: "Rail Crossing",
    type: "Structure",
    category: "structures",
    icon: <Train size={20} />,
    desc: "At-grade or separated railway intersections. Inspect signal guards & warning signage.",
    color: "#d97706",
    grad: "linear-gradient(135deg, #f59e0b, #d97706)"
  },
  {
    id: "tollgate",
    label: "Tollgate",
    type: "Structure",
    category: "structures",
    icon: <CreditCard size={20} />,
    desc: "Plaza collection gates. Check number of lanes, status, and control mechanism integrity.",
    color: "#f59e0b",
    grad: "linear-gradient(135deg, #fbbf24, #d97706)"
  },
  {
    id: "layby",
    label: "Lay By",
    type: "Amenity",
    category: "amenities",
    icon: <MapPin size={20} />,
    desc: "Roadside highway rest zones. Check surface type, length, and cleanliness state.",
    color: "#7c3aed",
    grad: "linear-gradient(135deg, #8b5cf6, #5b21b6)"
  },
  {
    id: "busstop",
    label: "Bus Stop",
    type: "Amenity",
    category: "amenities",
    icon: <Bus size={20} />,
    desc: "Passenger bays & shelters. Record shelter structural status and bay surface conditions.",
    color: "#6d28d9",
    grad: "linear-gradient(135deg, #7c3aed, #4c1d95)"
  },
  {
    id: "junction",
    label: "Junction",
    type: "Highway",
    category: "amenities",
    icon: <GitMerge size={20} />,
    desc: "Main route junctions. Monitor markings quality, warning signs, & directional beacons.",
    color: "#8b5cf6",
    grad: "linear-gradient(135deg, #a78bfa, #6d28d9)"
  },
  {
    id: "sign",
    label: "Road Sign",
    type: "Furniture",
    category: "traffic",
    icon: <Info size={20} />,
    desc: "Speed limits & safety signs. Inspect SADC compliance status, poles, and reflectivity.",
    color: "#4c1d95",
    grad: "linear-gradient(135deg, #8b5cf6, #3b0764)"
  },
  {
    id: "traffic_calming",
    label: "Traffic Calming",
    type: "Control",
    category: "traffic",
    icon: <Shield size={20} />,
    desc: "Speed humps, rumble strips, and dips. Record type and structural condition.",
    color: "#c2410c",
    grad: "linear-gradient(135deg, #ea580c, #9a3412)"
  },
  {
    id: "shelvet",
    label: "Shelverts",
    type: "Drainage",
    category: "drainage",
    icon: <FolderOpen size={20} />,
    desc: "Masonry or concrete side drainage structures. Monitor siltation and crack damage.",
    color: "#2563eb",
    grad: "linear-gradient(135deg, #3b82f6, #1d4ed8)"
  },
  {
    id: "culvert",
    label: "Culverts",
    type: "Drainage",
    category: "drainage",
    icon: <CircleDot size={20} />,
    desc: "Concrete pipe/box channel underpasses. Check blocking debris & structural walls.",
    color: "#1d4ed8",
    grad: "linear-gradient(135deg, #1d4ed8, #1e3a8a)"
  },
  {
    id: "piped_causeway",
    label: "Piped Causeways",
    type: "Drainage",
    category: "drainage",
    icon: <Droplets size={20} />,
    desc: "Low-level river crossings with pipe channels. Survey serviceability state.",
    color: "#3b82f6",
    grad: "linear-gradient(135deg, #60a5fa, #2563eb)"
  },
  {
    id: "drift",
    label: "Drift",
    type: "Drainage",
    category: "drainage",
    icon: <Waves size={20} />,
    desc: "Concrete slab splashways. Inspect water flow overflow depths and slab erosion.",
    color: "#06b6d4",
    grad: "linear-gradient(135deg, #06b6d4, #0891b2)"
  },
  {
    id: "catchpit",
    label: "Catchpit",
    type: "Drainage",
    category: "drainage",
    icon: <Droplet size={20} />,
    desc: "Roadside catchpit drainage structures. Record condition and blockage status.",
    color: "#2563eb",
    grad: "linear-gradient(135deg, #3b82f6, #1d4ed8)"
  },
  {
    id: "grid",
    label: "Grid",
    type: "Drainage",
    category: "amenities",
    icon: <Grid size={20} />,
    desc: "Vehicle cattle grids. Check grid frame stability, welded bar spacing, & cleanout pit.",
    color: "#0891b2",
    grad: "linear-gradient(135deg, #22d3ee, #0891b2)"
  },
  {
    id: "traffic_lights",
    label: "Traffic Lights",
    type: "Control",
    category: "traffic",
    icon: <Flame size={20} />,
    desc: "Intersection robot signaling. Check solar/grid power, phases, and housing damage.",
    color: "#ea580c",
    grad: "linear-gradient(135deg, #f97316, #c2410c)"
  },
  {
    id: "streetlight",
    label: "Streetlights",
    type: "Lighting",
    category: "traffic",
    icon: <Sun size={20} />,
    desc: "Pole lighting networks. Count active LED fixtures, check cables & battery cabinets.",
    color: "#eab308",
    grad: "linear-gradient(135deg, #facc15, #ca8a04)"
  }
];


export default function App() {
  const [activeTab, setActiveTab] = useState<"welcome" | "form" | "queue" | "settings">("welcome");
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [drafts, setDrafts] = useState<SurveyDraft[]>([]);
  const [editingDraftId, setEditingDraftId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncProgress, setSyncProgress] = useState<{ current: number; total: number; currentName: string }>({ current: 0, total: 0, currentName: "" });
  const [isOnline, setIsOnline] = useState(true);
  
  // Custom draft & GPS States
  const [queueSubTab, setQueueSubTab] = useState<"drafts" | "queued">("drafts");
  const [gpsAccuracyLimit, setGpsAccuracyLimit] = useState<number>(3.0);
  const warmUpWatchIdRef = React.useRef<string | null>(null);
  const autoSaveDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // Auto-save UI state
  const [autoSaveStatus, setAutoSaveStatus] = React.useState<"idle" | "saving" | "saved">("idle");
  const [hasTempDraft, setHasTempDraft] = React.useState(false);
  const [showRecoveryBanner, setShowRecoveryBanner] = React.useState(false);

  // Settings State
  const [serverUrl, setServerUrl] = useState("http://localhost:3002");
  const [defaultSurveyor, setDefaultSurveyor] = useState("");
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<"unchecked" | "online" | "offline">("unchecked");
  const [showDevSettings, setShowDevSettings] = useState(false);
  const devClickCountRef = React.useRef(0);

  // Form Fields State
  const [assetCategory, setAssetCategory] = useState<"sealed" | "gravel" | "earth" | "bridge" | "footbridge" | "rail_crossing" | "tollgate" | "layby" | "busstop" | "junction" | "sign" | "shelvet" | "culvert" | "piped_causeway" | "drift" | "catchpit" | "grid" | "traffic_calming" | "traffic_lights" | "streetlight">("sealed");
  const [segmentGeometry, setSegmentGeometry] = useState<SegmentGeometry | null>(null);
  const isRoadType = assetCategory === "sealed" || assetCategory === "gravel" || assetCategory === "earth";
  const [pausedRoadContext, setPausedRoadContext] = useState<PausedRoadContext | null>(() => loadPausedRoadContext());
  const [autoResumeSegment, setAutoResumeSegment] = useState(false);

  const persistPausedRoadContext = (ctx: PausedRoadContext | null) => {
    setPausedRoadContext(ctx);
    try {
      if (ctx) localStorage.setItem(PAUSED_ROAD_CONTEXT_KEY, JSON.stringify(ctx));
      else localStorage.removeItem(PAUSED_ROAD_CONTEXT_KEY);
    } catch (e) {
      console.warn("Failed to persist paused road context:", e);
    }
  };

  const discardPausedRoadSession = () => {
    persistPausedRoadContext(null);
    clearPausedRoadPhotos();
    setAutoResumeSegment(false);
    try {
      localStorage.removeItem(SEGMENT_SESSION_KEY);
    } catch (_) { /* ignore */ }
    setSegmentGeometry(null);
  };

  const resumePausedRoadSurvey = async () => {
    const ctx = pausedRoadContext ?? loadPausedRoadContext();
    if (!ctx) return;
    // Release point GPS so SegmentTracker can claim BackgroundGeolocation cleanly
    try {
      if (pointGpsEngineRef.current === "bg" || warmUpWatchIdRef.current === "bg-active") {
        await BackgroundGeolocation.stop();
      }
    } catch { /* ignore */ }
    pointGpsEngineRef.current = null;
    warmUpWatchIdRef.current = null;

    setAutoResumeSegment(true);
    setAssetCategory(ctx.roadCategory);
    setSelectedCategory(ctx.roadCategory);
    setRoadName(ctx.roadName);
    setSectionName(ctx.sectionName);
    setSurveyorName(ctx.surveyorName || defaultSurveyor);
    setSurveyDate(ctx.surveyDate || new Date().toISOString().split("T")[0]);
    setSegmentGeometry(null);
    setGps("");
    setPhotos(loadPausedRoadPhotos());
    setEditingDraftId(null);
    showToast("Resuming line from last GPS point…", "info");
  };

  // Clear one-shot autoResume after SegmentTracker has had time to resume
  useEffect(() => {
    if (!autoResumeSegment) return;
    const t = setTimeout(() => setAutoResumeSegment(false), 2500);
    return () => clearTimeout(t);
  }, [autoResumeSegment]);

  const [roadName, setRoadName] = useState("");
  const [sectionName, setSectionName] = useState("");
  const [chainageFrom, setChainageFrom] = useState("");
  const [chainageTo, setChainageTo] = useState("");
  const [surveyorName, setSurveyorName] = useState("");
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split("T")[0]);
  const [vegetation, setVegetation] = useState("medium");
  const [gps, setGps] = useState("");
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [liveGpsAccuracy, setLiveGpsAccuracy] = useState<number | null>(null);
  const [bestGpsAccuracy, setBestGpsAccuracy] = useState<number | null>(null);
  const liveGpsPosRef = React.useRef<{ lat: number; lng: number; alt: number; acc: number } | null>(null);
  const bestGpsPosRef = React.useRef<{ lat: number; lng: number; alt: number; acc: number } | null>(null);
  const pointGpsEngineRef = React.useRef<"bg" | "cap" | "web" | null>(null);
  const [imageSadcCompliant, setImageSadcCompliant] = useState<"yes" | "no" | "mixed">("yes");
  const [photos, setPhotos] = useState<string[]>([]);

  // Conditional Bridge Fields
  const [bridgeName, setBridgeName] = useState("");
  const [bridgeCrossing, setBridgeCrossing] = useState("river");
  const [bridgeType, setBridgeType] = useState("hldc");
  const [bridgeBearing, setBridgeBearing] = useState("elastometric");
  const [bridgeJoints, setBridgeJoints] = useState("good");
  const [bearingsState, setBearingsState] = useState("good");
  const [parapet, setParapet] = useState("undamaged");
  const [chemicalEffect, setChemicalEffect] = useState("none");
  const [vegetationGrowth, setVegetationGrowth] = useState("no");
  const [drainage, setDrainage] = useState("good");
  const [bridgeCondition, setBridgeCondition] = useState("good");
  const [bridgeStructureType, setBridgeStructureType] = useState("beam");
  const [bridgeLength, setBridgeLength] = useState("");
  const [bridgeWidth, setBridgeWidth] = useState("");
  const [bridgeSpans, setBridgeSpans] = useState("");
  const [bridgeApproachCondition, setBridgeApproachCondition] = useState("good");
  const [bridgeSignage, setBridgeSignage] = useState("yes");

  // Conditional Culvert Fields
  const [culvertClass, setCulvertClass] = useState("pipe_culvert");
  const [culvertType, setCulvertType] = useState("concrete");
  const [culvertServiceability, setCulvertServiceability] = useState("good");
  const [culvertSizeM2, setCulvertSizeM2] = useState("");
  const [culvertOpenings, setCulvertOpenings] = useState("");

  // Conditional Shelvet Fields
  const [shelvetType, setShelvetType] = useState("armco");
  const [shelvetCondition, setShelvetCondition] = useState("good");
  const [shelvetServiceability, setShelvetServiceability] = useState("good");
  const [shelvetSizeM2, setShelvetSizeM2] = useState("");
  const [shelvetOpenings, setShelvetOpenings] = useState("");

  // Conditional Sealed Roads Fields
  const [sealedName, setSealedName] = useState("");
  const [sealedRoute, setSealedRoute] = useState("");
  const [sealedClass, setSealedClass] = useState("secondary");
  const [sealedType, setSealedType] = useState("wide_mat_ss");
  const [sealedClimate, setSealedClimate] = useState("moderate");
  const [sealedTerrain, setSealedTerrain] = useState("flat");
  const [sealedAuthority, setSealedAuthority] = useState("rdc");
  const [sealedLength, setSealedLength] = useState("");
  const [sealedWidth, setSealedWidth] = useState("");
  const [sealedDrainageType, setSealedDrainageType] = useState("v_drain");
  const [sealedVegetation, setSealedVegetation] = useState("medium");
  const [sealedNarrowCracks, setSealedNarrowCracks] = useState("no_cracks");
  const [sealedWideCracks, setSealedWideCracks] = useState("no_cracks");
  const [sealedPotholesPatches, setSealedPotholesPatches] = useState("no_potholes");
  const [sealedRutting, setSealedRutting] = useState("no_rutting__5mm");
  const [sealedEdgeBreaks, setSealedEdgeBreaks] = useState("no_edge_break");
  const [sealedEdgeDrop, setSealedEdgeDrop] = useState("no_edge_break");
  const [sealedDrainage, setSealedDrainage] = useState("good");
  const [sealedRavelling, setSealedRavelling] = useState("none");
  const [sealedRidingQuality, setSealedRidingQuality] = useState("good");
  const [sealedRoadMarkings, setSealedRoadMarkings] = useState("yes");
  const [sealedRoadStuds, setSealedRoadStuds] = useState("yes");
  const [sealedPassability, setSealedPassability] = useState("all_year_round");
  const [sealedYearConstructed, setSealedYearConstructed] = useState("");
  const [sealedSurfaceType, setSealedSurfaceType] = useState("asphalt");
  const [sealedPotholeDensity, setSealedPotholeDensity] = useState("low");
  const [sealedCycleTrack, setSealedCycleTrack] = useState("no");
  const [sealedSurveySide, setSealedSurveySide] = useState("left");
  const [sealedSurveyDirection, setSealedSurveyDirection] = useState("");
  const [sealedLanesPerCarriage, setSealedLanesPerCarriage] = useState("");
  const [sealedShoulderWidth, setSealedShoulderWidth] = useState("");
  const [sealedMedianType, setSealedMedianType] = useState("none");
  const [sealedDrainageLining, setSealedDrainageLining] = useState("not_lined");
  const [sealedRoadMarkingsVisible, setSealedRoadMarkingsVisible] = useState("yes");
  const [sealedC1NarrowCracks, setSealedC1NarrowCracks] = useState("no_cracks");
  const [sealedC1WideCracks, setSealedC1WideCracks] = useState("no_cracks");
  const [sealedC1Potholes, setSealedC1Potholes] = useState("no_potholes");
  const [sealedC1Rutting, setSealedC1Rutting] = useState("no_rutting__5mm");
  const [sealedC1EdgeBreaks, setSealedC1EdgeBreaks] = useState("no_edge_break");
  const [sealedC1EdgeDrop, setSealedC1EdgeDrop] = useState("no_edge_break");
  const [sealedC1Ravelling, setSealedC1Ravelling] = useState("none");
  const [sealedC1RidingQuality, setSealedC1RidingQuality] = useState("good");
  const [sealedC2NarrowCracks, setSealedC2NarrowCracks] = useState("no_cracks");
  const [sealedC2WideCracks, setSealedC2WideCracks] = useState("no_cracks");
  const [sealedC2Potholes, setSealedC2Potholes] = useState("no_potholes");
  const [sealedC2Rutting, setSealedC2Rutting] = useState("no_rutting__5mm");
  const [sealedC2EdgeBreaks, setSealedC2EdgeBreaks] = useState("no_edge_break");
  const [sealedC2EdgeDrop, setSealedC2EdgeDrop] = useState("no_edge_break");
  const [sealedC2Ravelling, setSealedC2Ravelling] = useState("none");
  const [sealedC2RidingQuality, setSealedC2RidingQuality] = useState("good");

  // Conditional Gravel Roads Fields
  const [gravelName, setGravelName] = useState("");
  const [gravelRoute, setGravelRoute] = useState("");
  const [gravelLength, setGravelLength] = useState("");
  const [gravelClass, setGravelClass] = useState("urban_collector");
  const [gravelAuthority, setGravelAuthority] = useState("rdc");
  const [gravelVegetation, setGravelVegetation] = useState("medium");
  const [gravelClimate, setGravelClimate] = useState("moderate");
  const [gravelTerrain, setGravelTerrain] = useState("rolling");
  const [gravelWidth, setGravelWidth] = useState("");
  const [gravelDrainageType, setGravelDrainageType] = useState("v_drain");
  const [gravelCrossSection, setGravelCrossSection] = useState("flat");
  const [gravelThickness, setGravelThickness] = useState("_100");
  const [gravelCorrugations, setGravelCorrugations] = useState("none");
  const [gravelRidingQuality, setGravelRidingQuality] = useState("good");
  const [gravelDrainageCond, setGravelDrainageCond] = useState("good");
  const [gravelPotholes, setGravelPotholes] = useState("none");
  const [gravelPassability, setGravelPassability] = useState("all_year_round");
  const [gravelYearConstructed, setGravelYearConstructed] = useState("");
  const [gravelCorrugationsSeverity, setGravelCorrugationsSeverity] = useState("none");
  const [gravelCrossSectionSeverity, setGravelCrossSectionSeverity] = useState("none");
  const [gravelDrainageSeverity, setGravelDrainageSeverity] = useState("none");
  const [gravelPotholesSeverity, setGravelPotholesSeverity] = useState("none");
  const [gravelRidingSeverity, setGravelRidingSeverity] = useState("none");

  // Catchpit Fields
  const [catchpitCondition, setCatchpitCondition] = useState("good");

  // Traffic Calming Fields
  const [trafficCalmingType, setTrafficCalmingType] = useState("speed_hump");
  const [trafficCalmingCondition, setTrafficCalmingCondition] = useState("good");

  // Earth Roads Fields
  const [earthName, setEarthName] = useState("");
  const [earthClass, setEarthClass] = useState("tertiary_feeder");
  const [earthWidth, setEarthWidth] = useState("");
  const [earthLength, setEarthLength] = useState("");
  const [earthCondition, setEarthCondition] = useState("fair");
  const [earthPassability, setEarthPassability] = useState("dry_season_only");
  const [earthDrainageType, setEarthDrainageType] = useState("v_drain");
  const [earthDrainageCond, setEarthDrainageCond] = useState("fair");
  const [earthTerrain, setEarthTerrain] = useState("flat");
  const [earthClimate, setEarthClimate] = useState("moderate");
  const [earthAuthority, setEarthAuthority] = useState("rdc");
  const [earthYearConstructed, setEarthYearConstructed] = useState("");

  // Footbridge Fields
  const [footbridgeName, setFootbridgeName] = useState("");
  const [footbridgeType, setFootbridgeType] = useState("suspension");
  const [footbridgeCondition, setFootbridgeCondition] = useState("good");
  const [footbridgeWidth, setFootbridgeWidth] = useState("");
  const [footbridgeSpan, setFootbridgeSpan] = useState("");
  const [footbridgeMaterial, setFootbridgeMaterial] = useState("steel");
  const [footbridgeCrossing, setFootbridgeCrossing] = useState("river");

  // Rail Level Crossing Fields
  const [railCrossingName, setRailCrossingName] = useState("");
  const [railCrossingType, setRailCrossingType] = useState("at_grade");
  const [railCrossingCondition, setRailCrossingCondition] = useState("good");
  const [railCrossingControl, setRailCrossingControl] = useState("gates");
  const [railCrossingRoadClass, setRailCrossingRoadClass] = useState("secondary");

  // Tollgate Fields
  const [tollgateName, setTollgateName] = useState("");
  const [tollgateType, setTollgateType] = useState("manual");
  const [tollgateCondition, setTollgateCondition] = useState("good");
  const [tollgateLanes, setTollgateLanes] = useState("2");
  const [tollgateOperational, setTollgateOperational] = useState("yes");
  const [tollgateDualisation, setTollgateDualisation] = useState("no");
  const [tollgateVegetation, setTollgateVegetation] = useState("none");

  // Lay-by Fields
  const [laybyCondition, setLaybyCondition] = useState("good");
  const [laybySurface, setLaybySurface] = useState("gravel");
  const [laybyLength, setLaybyLength] = useState("");
  const [laybyDrainage, setLaybyDrainage] = useState("good");
  const [laybyWidth, setLaybyWidth] = useState("");
  const [laybyFurniture, setLaybyFurniture] = useState("good");
  const [laybyRefuseBin, setLaybyRefuseBin] = useState("no");

  // Bus Stop Fields
  const [busstopType, setBusstopType] = useState("bay_type");
  const [busstopCondition, setBusstopCondition] = useState("good");
  const [busstopShelter, setBusstopShelter] = useState("yes");
  const [busstopDrainage, setBusstopDrainage] = useState("good");
  const [busstopFurnitureCondition, setBusstopFurnitureCondition] = useState("good");
  const [busstopRefuseBin, setBusstopRefuseBin] = useState("no");

  // Junction Fields
  const [junctionType, setJunctionType] = useState("t_junction");
  const [junctionCondition, setJunctionCondition] = useState("good");
  const [junctionControl, setJunctionControl] = useState("signs");
  const [junctionMarkings, setJunctionMarkings] = useState("yes");
  const [junctionSignage, setJunctionSignage] = useState("good");

  // Road Sign Fields
  const [signType, setSignType] = useState("warning");
  const [signCondition, setSignCondition] = useState("good");
  const [signSadcCompliant, setSignSadcCompliant] = useState("yes");
  const [signVisibility, setSignVisibility] = useState("good");
  const [signName, setSignName] = useState("");

  // Piped Causeway Fields
  const [causewayName, setCausewayName] = useState("");
  const [causewayPipeMaterial, setCausewayPipeMaterial] = useState("concrete");
  const [causewayPipeDiameter, setCausewayPipeDiameter] = useState("600_900");
  const [causewayDrainage, setCausewayDrainage] = useState("good");
  const [causewayServiceability, setCausewayServiceability] = useState("good");
  const [causewayCondition, setCausewayCondition] = useState("good");
  const [causewayType, setCausewayType] = useState("piped");
  const [causewayLength, setCausewayLength] = useState("");
  const [causewayOpenings, setCausewayOpenings] = useState("");
  const [causewayBoxSize, setCausewayBoxSize] = useState("");

  // Drift Fields
  const [driftName, setDriftName] = useState("");
  const [driftCondition, setDriftCondition] = useState("good");
  const [driftSurface, setDriftSurface] = useState("concrete");
  const [driftPassability, setDriftPassability] = useState("dry_season_only");
  const [driftWidth, setDriftWidth] = useState("");
  const [driftLength, setDriftLength] = useState("");
  const [driftType, setDriftType] = useState("concrete");

  // Grid Fields
  const [gridName, setGridName] = useState("");
  const [gridCondition, setGridCondition] = useState("good");
  const [gridMaterial, setGridMaterial] = useState("steel");
  const [gridOperational, setGridOperational] = useState("yes");
  const [gridServiceability, setGridServiceability] = useState("good");
  const [gridPassability, setGridPassability] = useState("all_year_round");

  // Traffic Lights Fields
  const [trafficLightsLocation, setTrafficLightsLocation] = useState("");
  const [trafficLightsCondition, setTrafficLightsCondition] = useState("good");
  const [trafficLightsOperational, setTrafficLightsOperational] = useState("yes");
  const [trafficLightsType, setTrafficLightsType] = useState("standard");
  const [trafficLightsPhases, setTrafficLightsPhases] = useState("3");
  const [trafficLightsPowerSource, setTrafficLightsPowerSource] = useState("grid");

  // Streetlight Fields
  const [streetlightType, setStreetlightType] = useState("led");
  const [streetlightCondition, setStreetlightCondition] = useState("good");
  const [streetlightPowerSource, setStreetlightPowerSource] = useState("grid");
  const [streetlightOperational, setStreetlightOperational] = useState("yes");
  const [streetlightCount, setStreetlightCount] = useState("");

  // Load drafts, settings and check connection
  useEffect(() => {
    setDrafts(db.getDrafts());
    setIsOnline(navigator.onLine);

    const savedUrl = localStorage.getItem("roads_server_url");
    if (savedUrl) {
      setServerUrl(savedUrl);
    } else {
      const defaultUrl = window.location.origin.includes("5173")
        ? "http://localhost:3002"
        : window.location.origin;
      setServerUrl(defaultUrl);
      localStorage.setItem("roads_server_url", defaultUrl);
    }

    const savedSurveyor = localStorage.getItem("default_surveyor_name");
    if (savedSurveyor) {
      setDefaultSurveyor(savedSurveyor);
      setSurveyorName(savedSurveyor);
    }

    const savedLimit = localStorage.getItem("roads_gps_accuracy_limit");
    if (savedLimit) {
      setGpsAccuracyLimit(parseFloat(savedLimit));
    }

    // Request location permission early — do NOT start BackgroundGeolocation here.
    // SegmentTracker owns BG during road surveys; App owns it only on point forms.
    (async () => {
      if (!Capacitor.isNativePlatform()) return;
      try {
        await BackgroundGeolocation.requestPermissions({
          permissions: ["location", "backgroundLocation", "notification"],
        });
      } catch {
        try { await Geolocation.requestPermissions(); } catch { /* ignore */ }
      }
    })();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, []);

  const applyPointGpsFix = React.useCallback((latitude: number, longitude: number, altitude: number | null, accuracy: number) => {
    if (!Number.isFinite(accuracy) || accuracy <= 0) return;
    const alt = altitude && Number.isFinite(altitude) ? Math.round(altitude) : 1200;
    const accRound = Math.round(accuracy * 10) / 10;
    const fix = { lat: latitude, lng: longitude, alt, acc: Math.round(accuracy) };
    setLiveGpsAccuracy(accRound);
    liveGpsPosRef.current = fix;
    setBestGpsAccuracy((prev) => {
      if (prev == null || accuracy < prev) {
        bestGpsPosRef.current = fix;
        return accRound;
      }
      return prev;
    });
    if (!bestGpsPosRef.current || accuracy < bestGpsPosRef.current.acc) {
      bestGpsPosRef.current = fix;
    }
  }, []);

  const stopPointGpsEngine = React.useCallback(async () => {
    try {
      if (pointGpsEngineRef.current === "bg" || warmUpWatchIdRef.current === "bg-active") {
        await BackgroundGeolocation.stop();
      } else if (warmUpWatchIdRef.current?.startsWith("web:")) {
        navigator.geolocation.clearWatch(Number(warmUpWatchIdRef.current.slice(4)));
      } else if (warmUpWatchIdRef.current && pointGpsEngineRef.current === "cap") {
        await Geolocation.clearWatch({ id: warmUpWatchIdRef.current });
      }
    } catch { /* ignore */ }
    warmUpWatchIdRef.current = null;
    pointGpsEngineRef.current = null;
  }, []);

  // Point-asset forms ONLY — exclusive owner of BackgroundGeolocation when !isRoadType
  useEffect(() => {
    if (activeTab !== "form" || selectedCategory == null || isRoadType) {
      return;
    }

    let alive = true;
    const startPointGps = async () => {
      // Reset best-fix each time we open a point form so we don't reuse a stale line fix
      setLiveGpsAccuracy(null);
      setBestGpsAccuracy(null);
      liveGpsPosRef.current = null;
      bestGpsPosRef.current = null;

      const applyFix = (lat: number, lng: number, alt: number | null, acc: number) => {
        if (!alive) return;
        applyPointGpsFix(lat, lng, alt, acc);
      };

      if (!Capacitor.isNativePlatform() && "geolocation" in navigator) {
        const webId = navigator.geolocation.watchPosition(
          (position) => {
            const { latitude, longitude, altitude, accuracy } = position.coords;
            applyFix(latitude, longitude, altitude, accuracy ?? 99);
          },
          (webErr) => console.warn("Browser GPS watch failed:", webErr),
          { enableHighAccuracy: true, maximumAge: 0, timeout: 60000 }
        );
        warmUpWatchIdRef.current = `web:${webId}`;
        pointGpsEngineRef.current = "web";
        return;
      }

      try {
        try { await BackgroundGeolocation.stop(); } catch { /* clear any leftover */ }
        await BackgroundGeolocation.start(
          {
            backgroundTitle: "MOTID GPS lock",
            backgroundMessage: "Acquiring high-precision GPS for point survey…",
            requestPermissions: true,
            stale: false,
            distanceFilter: 0,
          },
          (location, err) => {
            if (!alive || err || !location) return;
            applyFix(location.latitude, location.longitude, location.altitude ?? null, location.accuracy);
          }
        );
        if (!alive) {
          await BackgroundGeolocation.stop().catch(() => {});
          return;
        }
        warmUpWatchIdRef.current = "bg-active";
        pointGpsEngineRef.current = "bg";
      } catch (e) {
        console.warn("Point BG GPS failed, Capacitor fallback:", e);
        try {
          const id = await Geolocation.watchPosition(
            { enableHighAccuracy: true, timeout: 60000, maximumAge: 0 },
            (position, err) => {
              if (!alive || err || !position?.coords) return;
              const { latitude, longitude, altitude, accuracy } = position.coords;
              applyFix(latitude, longitude, altitude, accuracy);
            }
          );
          warmUpWatchIdRef.current = id;
          pointGpsEngineRef.current = "cap";
        } catch (e2) {
          console.warn("Point GPS watch failed:", e2);
        }
      }
    };

    startPointGps();

    return () => {
      alive = false;
      stopPointGpsEngine();
    };
  }, [activeTab, selectedCategory, isRoadType, applyPointGpsFix, stopPointGpsEngine]);

  // ────────────────────────────────────────────────────────────────
  // Auto-Save: debounced write of all form state to localStorage
  // ────────────────────────────────────────────────────────────────
  useEffect(() => {
    // Only auto-save when actively filling in a form (not on welcome/queue/settings)
    if (activeTab !== "form" || selectedCategory === null) return;
    // Don't auto-save when editing an existing draft (it already has a draft ID)
    if (editingDraftId) return;

    if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
    setAutoSaveStatus("saving");

    autoSaveDebounceRef.current = setTimeout(() => {
      try {
        const snapshot = {
          savedAt: Date.now(),
          assetCategory,
          roadName, sectionName, chainageFrom, chainageTo, surveyorName, surveyDate, vegetation, gps,
          imageSadcCompliant, photos,
          // Bridge
          bridgeName, bridgeCrossing, bridgeType, bridgeBearing, bridgeJoints,
          bearingsState, parapet, chemicalEffect, vegetationGrowth, drainage, bridgeCondition,
          bridgeStructureType, bridgeLength, bridgeWidth, bridgeSpans, bridgeApproachCondition, bridgeSignage,
          // Culvert
          culvertClass, culvertType, culvertServiceability, culvertSizeM2, culvertOpenings,
          // Shelvet
          shelvetType, shelvetCondition, shelvetServiceability, shelvetSizeM2, shelvetOpenings,
          // Sealed
          sealedName, sealedRoute, sealedClass, sealedType, sealedClimate, sealedTerrain,
          sealedAuthority, sealedLength, sealedWidth, sealedDrainageType, sealedVegetation,
          sealedNarrowCracks, sealedWideCracks, sealedPotholesPatches, sealedRutting,
          sealedEdgeBreaks, sealedEdgeDrop, sealedDrainage, sealedRavelling,
          sealedRidingQuality, sealedRoadMarkings, sealedRoadStuds, sealedPassability,
          sealedYearConstructed, sealedSurfaceType, sealedPotholeDensity, sealedCycleTrack,
          sealedSurveySide, sealedSurveyDirection, sealedLanesPerCarriage, sealedShoulderWidth,
          sealedMedianType, sealedDrainageLining, sealedRoadMarkingsVisible,
          sealedC1NarrowCracks, sealedC1WideCracks, sealedC1Potholes, sealedC1Rutting,
          sealedC1EdgeBreaks, sealedC1EdgeDrop, sealedC1Ravelling, sealedC1RidingQuality,
          sealedC2NarrowCracks, sealedC2WideCracks, sealedC2Potholes, sealedC2Rutting,
          sealedC2EdgeBreaks, sealedC2EdgeDrop, sealedC2Ravelling, sealedC2RidingQuality,
          // Gravel
          gravelName, gravelRoute, gravelLength, gravelClass, gravelAuthority, gravelVegetation,
          gravelClimate, gravelTerrain, gravelWidth, gravelDrainageType, gravelCrossSection,
          gravelThickness, gravelCorrugations, gravelRidingQuality, gravelDrainageCond,
          gravelPotholes, gravelPassability, gravelYearConstructed,
          gravelCorrugationsSeverity, gravelCrossSectionSeverity, gravelDrainageSeverity,
          gravelPotholesSeverity, gravelRidingSeverity,
          // Earth
          earthName, earthClass, earthWidth, earthLength, earthCondition, earthPassability,
          earthDrainageType, earthDrainageCond, earthTerrain, earthClimate, earthAuthority, earthYearConstructed,
          // Catchpit
          catchpitCondition,
          // Traffic calming
          trafficCalmingType, trafficCalmingCondition,
          // Footbridge
          footbridgeName, footbridgeType, footbridgeCondition, footbridgeWidth, footbridgeSpan,
          footbridgeMaterial, footbridgeCrossing,
          // Rail crossing
          railCrossingName, railCrossingType, railCrossingCondition, railCrossingControl, railCrossingRoadClass,
          // Tollgate
          tollgateName, tollgateType, tollgateCondition, tollgateLanes, tollgateOperational,
          tollgateDualisation, tollgateVegetation,
          // Layby
          laybyCondition, laybySurface, laybyLength, laybyDrainage, laybyWidth, laybyFurniture, laybyRefuseBin,
          // Bus stop
          busstopType, busstopCondition, busstopShelter, busstopDrainage, busstopFurnitureCondition, busstopRefuseBin,
          // Junction
          junctionType, junctionCondition, junctionControl, junctionMarkings, junctionSignage,
          // Sign
          signType, signCondition, signSadcCompliant, signVisibility, signName,
          // Piped Causeway
          causewayName, causewayPipeMaterial, causewayPipeDiameter, causewayDrainage, causewayServiceability,
          causewayCondition, causewayType, causewayLength, causewayOpenings, causewayBoxSize,
          // Drift
          driftName, driftCondition, driftSurface, driftPassability, driftWidth, driftLength, driftType,
          // Grid
          gridName, gridCondition, gridMaterial, gridOperational, gridServiceability, gridPassability,
          // Traffic Lights
          trafficLightsLocation, trafficLightsCondition, trafficLightsOperational, trafficLightsType, trafficLightsPhases,
          trafficLightsPowerSource,
          // Streetlight
          streetlightType, streetlightCondition, streetlightPowerSource, streetlightOperational, streetlightCount,
        };
        localStorage.setItem("roads_temp_draft", JSON.stringify(snapshot));
        setAutoSaveStatus("saved");
        // Reset status to idle after 2 seconds
        setTimeout(() => setAutoSaveStatus("idle"), 2000);
      } catch (e) {
        console.warn("Auto-save failed:", e);
        setAutoSaveStatus("idle");
      }
    }, 400);

    return () => {
      if (autoSaveDebounceRef.current) clearTimeout(autoSaveDebounceRef.current);
    };
  }, [
    activeTab, selectedCategory, editingDraftId,
    assetCategory, roadName, sectionName, chainageFrom, chainageTo, surveyorName, surveyDate, vegetation, gps,
    imageSadcCompliant, photos,
    bridgeName, bridgeCrossing, bridgeType, bridgeBearing, bridgeJoints,
    bearingsState, parapet, chemicalEffect, vegetationGrowth, drainage, bridgeCondition,
    bridgeStructureType, bridgeLength, bridgeWidth, bridgeSpans, bridgeApproachCondition, bridgeSignage,
    culvertClass, culvertType, culvertServiceability, culvertSizeM2, culvertOpenings,
    shelvetType, shelvetCondition, shelvetServiceability, shelvetSizeM2, shelvetOpenings,
    sealedName, sealedRoute, sealedClass, sealedType, sealedClimate, sealedTerrain,
    sealedAuthority, sealedLength, sealedWidth, sealedDrainageType, sealedVegetation,
    sealedNarrowCracks, sealedWideCracks, sealedPotholesPatches, sealedRutting,
    sealedEdgeBreaks, sealedEdgeDrop, sealedDrainage, sealedRavelling,
    sealedRidingQuality, sealedRoadMarkings, sealedRoadStuds, sealedPassability,
    sealedYearConstructed, sealedSurfaceType, sealedPotholeDensity, sealedCycleTrack,
    sealedSurveySide, sealedSurveyDirection, sealedLanesPerCarriage, sealedShoulderWidth,
    sealedMedianType, sealedDrainageLining, sealedRoadMarkingsVisible,
    sealedC1NarrowCracks, sealedC1WideCracks, sealedC1Potholes, sealedC1Rutting,
    sealedC1EdgeBreaks, sealedC1EdgeDrop, sealedC1Ravelling, sealedC1RidingQuality,
    sealedC2NarrowCracks, sealedC2WideCracks, sealedC2Potholes, sealedC2Rutting,
    sealedC2EdgeBreaks, sealedC2EdgeDrop, sealedC2Ravelling, sealedC2RidingQuality,
    gravelName, gravelRoute, gravelLength, gravelClass, gravelAuthority, gravelVegetation,
    gravelClimate, gravelTerrain, gravelWidth, gravelDrainageType, gravelCrossSection,
    gravelThickness, gravelCorrugations, gravelRidingQuality, gravelDrainageCond,
    gravelPotholes, gravelPassability, gravelYearConstructed,
    gravelCorrugationsSeverity, gravelCrossSectionSeverity, gravelDrainageSeverity,
    gravelPotholesSeverity, gravelRidingSeverity,
    earthName, earthClass, earthWidth, earthLength, earthCondition, earthPassability,
    earthDrainageType, earthDrainageCond, earthTerrain, earthClimate, earthAuthority, earthYearConstructed,
    catchpitCondition, trafficCalmingType, trafficCalmingCondition,
    footbridgeName, footbridgeType, footbridgeCondition, footbridgeWidth, footbridgeSpan,
    footbridgeMaterial, footbridgeCrossing,
    railCrossingName, railCrossingType, railCrossingCondition, railCrossingControl, railCrossingRoadClass,
    tollgateName, tollgateType, tollgateCondition, tollgateLanes, tollgateOperational,
    tollgateDualisation, tollgateVegetation,
    laybyCondition, laybySurface, laybyLength, laybyDrainage, laybyWidth, laybyFurniture, laybyRefuseBin,
    busstopType, busstopCondition, busstopShelter, busstopDrainage, busstopFurnitureCondition, busstopRefuseBin,
    junctionType, junctionCondition, junctionControl, junctionMarkings, junctionSignage,
    signType, signCondition, signSadcCompliant, signVisibility, signName,
    causewayName, causewayPipeMaterial, causewayPipeDiameter, causewayDrainage, causewayServiceability,
    causewayCondition, causewayType, causewayLength, causewayOpenings, causewayBoxSize,
    driftName, driftCondition, driftSurface, driftPassability, driftWidth, driftLength, driftType,
    gridName, gridCondition, gridMaterial, gridOperational, gridServiceability, gridPassability,
    trafficLightsLocation, trafficLightsCondition, trafficLightsOperational, trafficLightsType, trafficLightsPhases,
    trafficLightsPowerSource,
    streetlightType, streetlightCondition, streetlightPowerSource, streetlightOperational, streetlightCount,
  ]);

  // Check for existing temp draft on app load (to show recovery banner)
  useEffect(() => {
    const raw = localStorage.getItem("roads_temp_draft");
    if (raw) {
      setHasTempDraft(true);
    }
  }, []);

  // Show recovery banner when user opens the form tab
  useEffect(() => {
    if (activeTab === "form" && selectedCategory !== null && hasTempDraft && !editingDraftId) {
      setShowRecoveryBanner(true);
    } else {
      setShowRecoveryBanner(false);
    }
  }, [activeTab, selectedCategory, hasTempDraft, editingDraftId]);

  // Load temp draft into form state
  const loadTempDraft = () => {
    try {
      const raw = localStorage.getItem("roads_temp_draft");
      if (!raw) return;
      const s = JSON.parse(raw);

      if (s.assetCategory) { setAssetCategory(s.assetCategory); setSelectedCategory(s.assetCategory); }
      if (s.roadName !== undefined) setRoadName(s.roadName);
      if (s.sectionName !== undefined) setSectionName(s.sectionName);
      if (s.chainageFrom !== undefined) setChainageFrom(s.chainageFrom);
      if (s.chainageTo !== undefined) setChainageTo(s.chainageTo);
      if (s.surveyorName !== undefined) setSurveyorName(s.surveyorName);
      if (s.surveyDate !== undefined) setSurveyDate(s.surveyDate);
      if (s.vegetation !== undefined) setVegetation(s.vegetation);
      if (s.gps !== undefined) setGps(s.gps);
      if (s.imageSadcCompliant !== undefined) setImageSadcCompliant(s.imageSadcCompliant);
      if (s.photos !== undefined || s.photo !== undefined) {
        const cat = s.assetCategory || "sealed";
        const isRoad = cat === "sealed" || cat === "gravel" || cat === "earth";
        setPhotos(clampPhotos(normalizePhotos(s), isRoad));
      }

      // Bridge
      if (s.bridgeName !== undefined) setBridgeName(s.bridgeName);
      if (s.bridgeCrossing !== undefined) setBridgeCrossing(s.bridgeCrossing);
      if (s.bridgeType !== undefined) setBridgeType(s.bridgeType);
      if (s.bridgeBearing !== undefined) setBridgeBearing(s.bridgeBearing);
      if (s.bridgeJoints !== undefined) setBridgeJoints(s.bridgeJoints);
      if (s.bearingsState !== undefined) setBearingsState(s.bearingsState);
      if (s.parapet !== undefined) setParapet(s.parapet);
      if (s.chemicalEffect !== undefined) setChemicalEffect(s.chemicalEffect);
      if (s.vegetationGrowth !== undefined) setVegetationGrowth(s.vegetationGrowth);
      if (s.drainage !== undefined) setDrainage(s.drainage);
      if (s.bridgeCondition !== undefined) setBridgeCondition(s.bridgeCondition);
      if (s.bridgeStructureType !== undefined) setBridgeStructureType(s.bridgeStructureType);
      if (s.bridgeLength !== undefined) setBridgeLength(s.bridgeLength);
      if (s.bridgeWidth !== undefined) setBridgeWidth(s.bridgeWidth);
      if (s.bridgeSpans !== undefined) setBridgeSpans(s.bridgeSpans);
      if (s.bridgeApproachCondition !== undefined) setBridgeApproachCondition(s.bridgeApproachCondition);
      if (s.bridgeSignage !== undefined) setBridgeSignage(s.bridgeSignage);
      // Culvert
      if (s.culvertClass !== undefined) setCulvertClass(s.culvertClass);
      if (s.culvertType !== undefined) setCulvertType(s.culvertType);
      if (s.culvertServiceability !== undefined) setCulvertServiceability(s.culvertServiceability);
      if (s.culvertSizeM2 !== undefined) setCulvertSizeM2(s.culvertSizeM2);
      if (s.culvertOpenings !== undefined) setCulvertOpenings(s.culvertOpenings);
      // Shelvet
      if (s.shelvetType !== undefined) setShelvetType(s.shelvetType);
      if (s.shelvetCondition !== undefined) setShelvetCondition(s.shelvetCondition);
      if (s.shelvetServiceability !== undefined) setShelvetServiceability(s.shelvetServiceability);
      if (s.shelvetSizeM2 !== undefined) setShelvetSizeM2(s.shelvetSizeM2);
      if (s.shelvetOpenings !== undefined) setShelvetOpenings(s.shelvetOpenings);
      // Sealed
      if (s.sealedName !== undefined) setSealedName(s.sealedName);
      if (s.sealedRoute !== undefined) setSealedRoute(s.sealedRoute);
      if (s.sealedClass !== undefined) setSealedClass(s.sealedClass);
      if (s.sealedType !== undefined) setSealedType(s.sealedType);
      if (s.sealedClimate !== undefined) setSealedClimate(s.sealedClimate);
      if (s.sealedTerrain !== undefined) setSealedTerrain(s.sealedTerrain);
      if (s.sealedAuthority !== undefined) setSealedAuthority(s.sealedAuthority);
      if (s.sealedLength !== undefined) setSealedLength(s.sealedLength);
      if (s.sealedWidth !== undefined) setSealedWidth(s.sealedWidth);
      if (s.sealedDrainageType !== undefined) setSealedDrainageType(s.sealedDrainageType);
      if (s.sealedVegetation !== undefined) setSealedVegetation(s.sealedVegetation);
      if (s.sealedNarrowCracks !== undefined) setSealedNarrowCracks(s.sealedNarrowCracks);
      if (s.sealedWideCracks !== undefined) setSealedWideCracks(s.sealedWideCracks);
      if (s.sealedPotholesPatches !== undefined) setSealedPotholesPatches(mapLegacyPotholePatches(s.sealedPotholesPatches));
      if (s.sealedRutting !== undefined) setSealedRutting(s.sealedRutting);
      if (s.sealedEdgeBreaks !== undefined) setSealedEdgeBreaks(s.sealedEdgeBreaks);
      if (s.sealedEdgeDrop !== undefined) setSealedEdgeDrop(s.sealedEdgeDrop);
      if (s.sealedDrainage !== undefined) setSealedDrainage(s.sealedDrainage);
      if (s.sealedRavelling !== undefined) setSealedRavelling(s.sealedRavelling);
      if (s.sealedRidingQuality !== undefined) setSealedRidingQuality(s.sealedRidingQuality);
      if (s.sealedRoadMarkings !== undefined) setSealedRoadMarkings(s.sealedRoadMarkings);
      if (s.sealedRoadStuds !== undefined) setSealedRoadStuds(s.sealedRoadStuds);
      if (s.sealedPassability !== undefined) setSealedPassability(s.sealedPassability);
      if (s.sealedYearConstructed !== undefined) setSealedYearConstructed(s.sealedYearConstructed);
      if (s.sealedSurfaceType !== undefined) setSealedSurfaceType(s.sealedSurfaceType);
      if (s.sealedPotholeDensity !== undefined) setSealedPotholeDensity(s.sealedPotholeDensity);
      if (s.sealedCycleTrack !== undefined) setSealedCycleTrack(s.sealedCycleTrack);
      if (s.sealedSurveySide !== undefined) setSealedSurveySide(s.sealedSurveySide);
      if (s.sealedSurveyDirection !== undefined) setSealedSurveyDirection(s.sealedSurveyDirection);
      if (s.sealedLanesPerCarriage !== undefined) setSealedLanesPerCarriage(s.sealedLanesPerCarriage);
      if (s.sealedShoulderWidth !== undefined) setSealedShoulderWidth(s.sealedShoulderWidth);
      if (s.sealedMedianType !== undefined) setSealedMedianType(s.sealedMedianType);
      if (s.sealedDrainageLining !== undefined) setSealedDrainageLining(s.sealedDrainageLining);
      if (s.sealedRoadMarkingsVisible !== undefined) setSealedRoadMarkingsVisible(s.sealedRoadMarkingsVisible);
      if (s.sealedC1NarrowCracks !== undefined) setSealedC1NarrowCracks(s.sealedC1NarrowCracks);
      if (s.sealedC1WideCracks !== undefined) setSealedC1WideCracks(s.sealedC1WideCracks);
      if (s.sealedC1Potholes !== undefined) setSealedC1Potholes(mapLegacyPotholePatches(s.sealedC1Potholes));
      if (s.sealedC1Rutting !== undefined) setSealedC1Rutting(s.sealedC1Rutting);
      if (s.sealedC1EdgeBreaks !== undefined) setSealedC1EdgeBreaks(s.sealedC1EdgeBreaks);
      if (s.sealedC1EdgeDrop !== undefined) setSealedC1EdgeDrop(s.sealedC1EdgeDrop);
      if (s.sealedC1Ravelling !== undefined) setSealedC1Ravelling(s.sealedC1Ravelling);
      if (s.sealedC1RidingQuality !== undefined) setSealedC1RidingQuality(s.sealedC1RidingQuality);
      if (s.sealedC2NarrowCracks !== undefined) setSealedC2NarrowCracks(s.sealedC2NarrowCracks);
      if (s.sealedC2WideCracks !== undefined) setSealedC2WideCracks(s.sealedC2WideCracks);
      if (s.sealedC2Potholes !== undefined) setSealedC2Potholes(mapLegacyPotholePatches(s.sealedC2Potholes));
      if (s.sealedC2Rutting !== undefined) setSealedC2Rutting(s.sealedC2Rutting);
      if (s.sealedC2EdgeBreaks !== undefined) setSealedC2EdgeBreaks(s.sealedC2EdgeBreaks);
      if (s.sealedC2EdgeDrop !== undefined) setSealedC2EdgeDrop(s.sealedC2EdgeDrop);
      if (s.sealedC2Ravelling !== undefined) setSealedC2Ravelling(s.sealedC2Ravelling);
      if (s.sealedC2RidingQuality !== undefined) setSealedC2RidingQuality(s.sealedC2RidingQuality);
      // Gravel
      if (s.gravelName !== undefined) setGravelName(s.gravelName);
      if (s.gravelRoute !== undefined) setGravelRoute(s.gravelRoute);
      if (s.gravelLength !== undefined) setGravelLength(s.gravelLength);
      if (s.gravelClass !== undefined) setGravelClass(s.gravelClass);
      if (s.gravelAuthority !== undefined) setGravelAuthority(s.gravelAuthority);
      if (s.gravelVegetation !== undefined) setGravelVegetation(s.gravelVegetation);
      if (s.gravelClimate !== undefined) setGravelClimate(s.gravelClimate);
      if (s.gravelTerrain !== undefined) setGravelTerrain(s.gravelTerrain);
      if (s.gravelWidth !== undefined) setGravelWidth(s.gravelWidth);
      if (s.gravelDrainageType !== undefined) setGravelDrainageType(s.gravelDrainageType);
      if (s.gravelCrossSection !== undefined) setGravelCrossSection(s.gravelCrossSection);
      if (s.gravelThickness !== undefined) setGravelThickness(s.gravelThickness);
      if (s.gravelCorrugations !== undefined) setGravelCorrugations(s.gravelCorrugations);
      if (s.gravelRidingQuality !== undefined) setGravelRidingQuality(s.gravelRidingQuality);
      if (s.gravelDrainageCond !== undefined) setGravelDrainageCond(s.gravelDrainageCond);
      if (s.gravelPotholes !== undefined) setGravelPotholes(s.gravelPotholes);
      if (s.gravelPassability !== undefined) setGravelPassability(s.gravelPassability);
      if (s.gravelYearConstructed !== undefined) setGravelYearConstructed(s.gravelYearConstructed);
      if (s.gravelCorrugationsSeverity !== undefined) setGravelCorrugationsSeverity(s.gravelCorrugationsSeverity);
      if (s.gravelCrossSectionSeverity !== undefined) setGravelCrossSectionSeverity(s.gravelCrossSectionSeverity);
      if (s.gravelDrainageSeverity !== undefined) setGravelDrainageSeverity(s.gravelDrainageSeverity);
      if (s.gravelPotholesSeverity !== undefined) setGravelPotholesSeverity(s.gravelPotholesSeverity);
      if (s.gravelRidingSeverity !== undefined) setGravelRidingSeverity(s.gravelRidingSeverity);
      // Earth
      if (s.earthName !== undefined) setEarthName(s.earthName);
      if (s.earthClass !== undefined) setEarthClass(s.earthClass);
      if (s.earthWidth !== undefined) setEarthWidth(s.earthWidth);
      if (s.earthLength !== undefined) setEarthLength(s.earthLength);
      if (s.earthCondition !== undefined) setEarthCondition(s.earthCondition);
      if (s.earthPassability !== undefined) setEarthPassability(s.earthPassability);
      if (s.earthDrainageType !== undefined) setEarthDrainageType(s.earthDrainageType);
      if (s.earthDrainageCond !== undefined) setEarthDrainageCond(s.earthDrainageCond);
      if (s.earthTerrain !== undefined) setEarthTerrain(s.earthTerrain);
      if (s.earthClimate !== undefined) setEarthClimate(s.earthClimate);
      if (s.earthAuthority !== undefined) setEarthAuthority(s.earthAuthority);
      if (s.earthYearConstructed !== undefined) setEarthYearConstructed(s.earthYearConstructed);
      // Catchpit
      if (s.catchpitCondition !== undefined) setCatchpitCondition(s.catchpitCondition);
      // Traffic calming
      if (s.trafficCalmingType !== undefined) setTrafficCalmingType(s.trafficCalmingType);
      if (s.trafficCalmingCondition !== undefined) setTrafficCalmingCondition(s.trafficCalmingCondition);
      // Footbridge
      if (s.footbridgeName !== undefined) setFootbridgeName(s.footbridgeName);
      if (s.footbridgeType !== undefined) setFootbridgeType(s.footbridgeType);
      if (s.footbridgeCondition !== undefined) setFootbridgeCondition(s.footbridgeCondition);
      if (s.footbridgeWidth !== undefined) setFootbridgeWidth(s.footbridgeWidth);
      if (s.footbridgeSpan !== undefined) setFootbridgeSpan(s.footbridgeSpan);
      if (s.footbridgeMaterial !== undefined) setFootbridgeMaterial(s.footbridgeMaterial);
      if (s.footbridgeCrossing !== undefined) setFootbridgeCrossing(s.footbridgeCrossing);
      // Rail crossing
      if (s.railCrossingName !== undefined) setRailCrossingName(s.railCrossingName);
      if (s.railCrossingType !== undefined) setRailCrossingType(s.railCrossingType);
      if (s.railCrossingCondition !== undefined) setRailCrossingCondition(s.railCrossingCondition);
      if (s.railCrossingControl !== undefined) setRailCrossingControl(s.railCrossingControl);
      if (s.railCrossingRoadClass !== undefined) setRailCrossingRoadClass(s.railCrossingRoadClass);
      // Tollgate
      if (s.tollgateName !== undefined) setTollgateName(s.tollgateName);
      if (s.tollgateType !== undefined) setTollgateType(s.tollgateType);
      if (s.tollgateCondition !== undefined) setTollgateCondition(s.tollgateCondition);
      if (s.tollgateLanes !== undefined) setTollgateLanes(s.tollgateLanes);
      if (s.tollgateOperational !== undefined) setTollgateOperational(s.tollgateOperational);
      if (s.tollgateDualisation !== undefined) setTollgateDualisation(s.tollgateDualisation);
      if (s.tollgateVegetation !== undefined) setTollgateVegetation(s.tollgateVegetation);
      // Layby
      if (s.laybyCondition !== undefined) setLaybyCondition(s.laybyCondition);
      if (s.laybySurface !== undefined) setLaybySurface(s.laybySurface);
      if (s.laybyLength !== undefined) setLaybyLength(s.laybyLength);
      if (s.laybyDrainage !== undefined) setLaybyDrainage(s.laybyDrainage);
      if (s.laybyWidth !== undefined) setLaybyWidth(s.laybyWidth);
      if (s.laybyFurniture !== undefined) setLaybyFurniture(s.laybyFurniture);
      if (s.laybyRefuseBin !== undefined) setLaybyRefuseBin(s.laybyRefuseBin);
      // Bus stop
      if (s.busstopType !== undefined) setBusstopType(s.busstopType);
      if (s.busstopCondition !== undefined) setBusstopCondition(s.busstopCondition);
      if (s.busstopShelter !== undefined) setBusstopShelter(s.busstopShelter);
      if (s.busstopDrainage !== undefined) setBusstopDrainage(s.busstopDrainage);
      if (s.busstopFurnitureCondition !== undefined) setBusstopFurnitureCondition(s.busstopFurnitureCondition);
      if (s.busstopRefuseBin !== undefined) setBusstopRefuseBin(s.busstopRefuseBin);
      // Junction
      if (s.junctionType !== undefined) setJunctionType(s.junctionType);
      if (s.junctionCondition !== undefined) setJunctionCondition(s.junctionCondition);
      if (s.junctionControl !== undefined) setJunctionControl(s.junctionControl);
      if (s.junctionMarkings !== undefined) setJunctionMarkings(s.junctionMarkings);
      if (s.junctionSignage !== undefined) setJunctionSignage(s.junctionSignage);
      // Sign
      if (s.signType !== undefined) setSignType(s.signType);
      if (s.signCondition !== undefined) setSignCondition(s.signCondition);
      if (s.signSadcCompliant !== undefined) setSignSadcCompliant(s.signSadcCompliant);
      if (s.signVisibility !== undefined) setSignVisibility(s.signVisibility);
      if (s.signName !== undefined) setSignName(s.signName);
      // Causeway
      if (s.causewayName !== undefined) setCausewayName(s.causewayName);
      if (s.causewayPipeMaterial !== undefined) setCausewayPipeMaterial(s.causewayPipeMaterial);
      if (s.causewayPipeDiameter !== undefined) setCausewayPipeDiameter(s.causewayPipeDiameter);
      if (s.causewayDrainage !== undefined) setCausewayDrainage(s.causewayDrainage);
      if (s.causewayServiceability !== undefined) setCausewayServiceability(s.causewayServiceability);
      if (s.causewayCondition !== undefined) setCausewayCondition(s.causewayCondition);
      if (s.causewayType !== undefined) setCausewayType(s.causewayType);
      if (s.causewayLength !== undefined) setCausewayLength(s.causewayLength);
      if (s.causewayOpenings !== undefined) setCausewayOpenings(s.causewayOpenings);
      if (s.causewayBoxSize !== undefined) setCausewayBoxSize(s.causewayBoxSize);
      // Drift
      if (s.driftName !== undefined) setDriftName(s.driftName);
      if (s.driftCondition !== undefined) setDriftCondition(s.driftCondition);
      if (s.driftSurface !== undefined) setDriftSurface(s.driftSurface);
      if (s.driftPassability !== undefined) setDriftPassability(s.driftPassability);
      if (s.driftWidth !== undefined) setDriftWidth(s.driftWidth);
      if (s.driftLength !== undefined) setDriftLength(s.driftLength);
      if (s.driftType !== undefined) setDriftType(s.driftType);
      // Grid
      if (s.gridName !== undefined) setGridName(s.gridName);
      if (s.gridCondition !== undefined) setGridCondition(s.gridCondition);
      if (s.gridMaterial !== undefined) setGridMaterial(s.gridMaterial);
      if (s.gridOperational !== undefined) setGridOperational(s.gridOperational);
      if (s.gridServiceability !== undefined) setGridServiceability(s.gridServiceability);
      if (s.gridPassability !== undefined) setGridPassability(s.gridPassability);
      // Traffic Lights
      if (s.trafficLightsLocation !== undefined) setTrafficLightsLocation(s.trafficLightsLocation);
      if (s.trafficLightsCondition !== undefined) setTrafficLightsCondition(s.trafficLightsCondition);
      if (s.trafficLightsOperational !== undefined) setTrafficLightsOperational(s.trafficLightsOperational);
      if (s.trafficLightsType !== undefined) setTrafficLightsType(s.trafficLightsType);
      if (s.trafficLightsPhases !== undefined) setTrafficLightsPhases(s.trafficLightsPhases);
      if (s.trafficLightsPowerSource !== undefined) setTrafficLightsPowerSource(s.trafficLightsPowerSource);
      // Streetlight
      if (s.streetlightType !== undefined) setStreetlightType(s.streetlightType);
      if (s.streetlightCondition !== undefined) setStreetlightCondition(s.streetlightCondition);
      if (s.streetlightPowerSource !== undefined) setStreetlightPowerSource(s.streetlightPowerSource);
      if (s.streetlightOperational !== undefined) setStreetlightOperational(s.streetlightOperational);
      if (s.streetlightCount !== undefined) setStreetlightCount(s.streetlightCount);

      setHasTempDraft(false);
      setShowRecoveryBanner(false);
      showToast("Survey resumed from auto-saved draft.", "info");
    } catch (e) {
      console.warn("Failed to load temp draft:", e);
      localStorage.removeItem("roads_temp_draft");
    }
  };

  const showToast = (message: string, type: "success" | "error" | "info" = "success") => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const handleDevClick = () => {
    devClickCountRef.current += 1;
    if (devClickCountRef.current >= 5) {
      setShowDevSettings(true);
      showToast("Developer Mode Enabled: Server URL Configuration unlocked.", "success");
      devClickCountRef.current = 0;
    }
  };

  const applyCapturedGps = (lat: number, lng: number, alt: number, acc: number) => {
    if (acc > gpsAccuracyLimit) {
      showToast(`❌ GPS accuracy ±${acc}m is too poor (target: ≤${gpsAccuracyLimit}m). Stand in open-sky area and try again!`, "error");
      setIsCapturingGps(false);
      return false;
    }
    setGps(`${lat.toFixed(6)} ${lng.toFixed(6)} ${alt} ${acc}`);
    setIsCapturingGps(false);
    showToast(`🟢 High-precision GPS captured (accuracy: ±${acc}m)`, "success");
    return true;
  };

  const handleCaptureGps = async () => {
    setIsCapturingGps(true);

    // Prefer the best high-precision fix already locked from the live BG stream
    const best = bestGpsPosRef.current;
    if (best && best.acc <= gpsAccuracyLimit) {
      applyCapturedGps(best.lat, best.lng, best.alt, best.acc);
      return;
    }
    const live = liveGpsPosRef.current;
    if (live && live.acc <= gpsAccuracyLimit) {
      applyCapturedGps(live.lat, live.lng, live.alt, live.acc);
      return;
    }

    // On native with BG engine running: wait briefly for a good fix instead of one-shot
    // getCurrentPosition (which is slower / less accurate on many devices).
    if (Capacitor.isNativePlatform() && pointGpsEngineRef.current === "bg") {
      const deadline = Date.now() + 12000;
      while (Date.now() < deadline) {
        await new Promise((r) => setTimeout(r, 400));
        const b = bestGpsPosRef.current;
        if (b && b.acc <= gpsAccuracyLimit) {
          applyCapturedGps(b.lat, b.lng, b.alt, b.acc);
          return;
        }
      }
      const latest = bestGpsPosRef.current || liveGpsPosRef.current;
      if (latest) {
        showToast(
          `❌ Best GPS so far ±${latest.acc}m (need ≤${gpsAccuracyLimit}m). Stay outdoors under clear sky.`,
          "error"
        );
      } else {
        showToast("❌ Still acquiring GPS. Keep the app open outdoors and try again.", "error");
      }
      setIsCapturingGps(false);
      return;
    }

    try {
      try {
        await Geolocation.requestPermissions();
      } catch (err) {
        console.warn("Permission request failed, continuing...", err);
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 0
      });

      if (position && position.coords) {
        const { latitude, longitude, altitude, accuracy } = position.coords;
        const alt = altitude ? Math.round(altitude) : 1200;
        const acc = Math.round(accuracy);
        applyPointGpsFix(latitude, longitude, altitude, accuracy);
        applyCapturedGps(latitude, longitude, alt, acc);
      } else {
        throw new Error("No coordinate data returned from GPS module.");
      }
    } catch (error) {
      console.warn("Capacitor native Geolocation failed, trying web fallback...", error);
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (position) => {
            const { latitude, longitude, altitude, accuracy } = position.coords;
            const alt = altitude ? Math.round(altitude) : 1200;
            const acc = accuracy ? Math.round(accuracy) : 5;
            applyPointGpsFix(latitude, longitude, altitude, accuracy ?? acc);
            applyCapturedGps(latitude, longitude, alt, acc);
          },
          (webErr) => {
            console.error("Web fallback Geolocation failed:", webErr);
            simulateZimbabweGps();
          },
          { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
        );
      } else {
        simulateZimbabweGps();
      }
    }
  };

  const simulateZimbabweGps = () => {
    // Generate coordinates on routes between Harare (-17.8292, 31.0522) and Beitbridge (-22.2178, 30.0000)
    const lat = (-17.5 - Math.random() * 4.5);
    const lng = (29.0 + Math.random() * 3.5);
    const alt = Math.floor(400 + Math.random() * 1200);
    const acc = Math.floor(1 + Math.random() * 3); // 1, 2, or 3 (must be <= 3m)

    setLiveGpsAccuracy(acc);
    liveGpsPosRef.current = { lat, lng, alt, acc };
    setGps(`${lat.toFixed(6)} ${lng.toFixed(6)} ${alt} ${acc}`);
    showToast("Simulated GPS coordinates captured on Zimbabwean highway.", "info");
    setIsCapturingGps(false);
  };

  const clearForm = () => {
    setSectionName("");
    setChainageFrom("");
    setChainageTo("");
    setGps("");
    setRoadName("");
    setBridgeName("");
    setSealedName("");
    setGravelName("");
    setEarthName("");
    setFootbridgeName("");
    setRailCrossingName("");
    setTollgateName("");
    setCausewayName("");
    setDriftName("");
    setGridName("");
    setTrafficLightsLocation("");
    setSignName("");
    setSegmentGeometry(null);

    setSealedLength("");
    setSealedWidth("");
    setGravelLength("");
    setGravelWidth("");
    setEarthLength("");
    setEarthWidth("");
    setFootbridgeWidth("");
    setFootbridgeSpan("");
    setBridgeLength("");
    setBridgeWidth("");
    setBridgeSpans("");
    setCulvertSizeM2("");
    setCulvertOpenings("");
    setShelvetSizeM2("");
    setShelvetOpenings("");
    setLaybyLength("");
    setLaybyWidth("");
    setCausewayLength("");
    setCausewayOpenings("");
    setCausewayBoxSize("");
    setDriftWidth("");
    setDriftLength("");
    setTollgateLanes("2");
    setTrafficLightsPhases("");
    setStreetlightCount("");
    setSealedSurfaceType("asphalt");
    setSealedPotholeDensity("low");
    setSealedCycleTrack("no");
    setSealedSurveySide("left");
    setSealedSurveyDirection("");
    setSealedLanesPerCarriage("");
    setSealedShoulderWidth("");
    setSealedMedianType("none");
    setSealedDrainageLining("not_lined");
    setSealedRoadMarkingsVisible("yes");
    setSealedPotholesPatches("no_potholes");
    setSealedC1NarrowCracks("no_cracks");
    setSealedC1WideCracks("no_cracks");
    setSealedC1Potholes("no_potholes");
    setSealedC1Rutting("no_rutting__5mm");
    setSealedC1EdgeBreaks("no_edge_break");
    setSealedC1EdgeDrop("no_edge_break");
    setSealedC1Ravelling("none");
    setSealedC1RidingQuality("good");
    setSealedC2NarrowCracks("no_cracks");
    setSealedC2WideCracks("no_cracks");
    setSealedC2Potholes("no_potholes");
    setSealedC2Rutting("no_rutting__5mm");
    setSealedC2EdgeBreaks("no_edge_break");
    setSealedC2EdgeDrop("no_edge_break");
    setSealedC2Ravelling("none");
    setSealedC2RidingQuality("good");
    setGravelCorrugationsSeverity("none");
    setGravelCrossSectionSeverity("none");
    setGravelDrainageSeverity("none");
    setGravelPotholesSeverity("none");
    setGravelRidingSeverity("none");
    setCatchpitCondition("good");
    setTrafficCalmingType("speed_hump");
    setTrafficCalmingCondition("good");
    setEditingDraftId(null);
    setSelectedCategory(null);
    setPhotos([]);
    // Clear auto-saved temp draft when form is deliberately abandoned
    localStorage.removeItem("roads_temp_draft");
    setAutoSaveStatus("idle");
    setShowRecoveryBanner(false);
  };

  const getDraftCategory = (draft: SurveyDraft) => {
    if (draft.bridge) return "bridge";
    if (draft.footbridge_name) return "footbridge";
    if (draft.culvet_class) return "culvert";
    if (draft.shelvets_type) return "shelvet";
    if (draft.gravel_road_name) return "gravel";
    if (draft.earth_road_name) return "earth";
    if (draft.causeway_name) return "piped_causeway";
    if (draft.drift_name) return "drift";
    if (draft.grid_name) return "grid";
    if (draft.tollgate_name) return "tollgate";
    if (draft.traffic_lights_location) return "traffic_lights";
    if (draft.streetlight_type) return "streetlight";
    if (draft.rail_crossing_name) return "rail_crossing";
    if (draft.junction_type) return "junction";
    if (draft.busstop_type) return "busstop";
    if (draft.layby_surface) return "layby";
    if (draft.sign_type) return "sign";
    if (draft.catchpit_condition) return "catchpit";
    if (draft.traffic_calming_type) return "traffic_calming";
    if (draft.paved_road_name) return "sealed";
    return "sealed";
  };

  const handleEditDraft = (draft: SurveyDraft) => {
    setEditingDraftId(draft.id);
    const category = getDraftCategory(draft);
    
    setRoadName(draft.road_name);
    setSectionName(draft.section_name);
    setChainageFrom(
      draft.Chainage_from_km_002 != null ? String(draft.Chainage_from_km_002)
      : draft.Chainage_From_km != null ? String(draft.Chainage_From_km)
      : draft.chainage_from_km != null ? String(draft.chainage_from_km) : ""
    );
    setChainageTo(
      draft.Chainage_to_km_002 != null ? String(draft.Chainage_to_km_002)
      : draft.Chainage_To_km != null ? String(draft.Chainage_To_km)
      : draft.chainage_to_km != null ? String(draft.chainage_to_km) : ""
    );
    setSurveyorName(draft.surveyor_name);
    setSurveyDate(draft.survey_date);
    setVegetation(draft.vegetation);
    setGps(draft.gps);
    setImageSadcCompliant(draft.image_SADC_compliant || "yes");
    setPhotos(clampPhotos(normalizePhotos(draft), category === "sealed" || category === "gravel" || category === "earth"));

    setAssetCategory(category);
    setSelectedCategory(category);

    if (draft.road_segment_points) {
      setSegmentGeometry({
        points: draft.road_segment_points,
        geojson: draft.road_segment_geojson || "",
        length_m: draft.road_segment_length_m || 0,
        start_time: draft.road_segment_start_time || "",
        end_time: draft.road_segment_end_time || "",
        avg_accuracy_m: draft.road_segment_avg_accuracy_m || 0,
        point_count: draft.road_segment_point_count || 0,
      });
    } else {
      setSegmentGeometry(null);
    }

    if (category === "bridge") {
      setBridgeName(draft.bridge || "");
      setBridgeCrossing(draft.bridge_crossing || "river");
      setBridgeType(draft.bridge_type || "hldc");
      setBridgeBearing(draft.bridge_bearing || "elastometric");
      setBridgeJoints(draft.bridge_joints || "good");
      setBearingsState(draft.bearings_state || "good");
      setParapet(draft.parapet || "undamaged");
      setChemicalEffect(draft.chemical_effect || "none");
      setVegetationGrowth(draft.vegetation_growth || "no");
      setDrainage(draft.drainage || "good");
      setBridgeCondition(draft.bridge_condition || "good");
      setBridgeStructureType(draft.bridge_structure_type || "beam");
      setBridgeLength(draft.bridge_length_m !== undefined ? String(draft.bridge_length_m) : "");
      setBridgeWidth(draft.bridge_width_m !== undefined ? String(draft.bridge_width_m) : "");
      setBridgeSpans(draft.bridge_spans !== undefined ? String(draft.bridge_spans) : "");
      setBridgeApproachCondition(draft.bridge_approach_condition || "good");
      setBridgeSignage(draft.bridge_signage || "yes");
    } else if (category === "culvert") {
      setCulvertClass(draft.culvet_class || "pipe_culvert");
      setCulvertType(draft.culvet_type || "concrete");
      setCulvertServiceability(draft.culvet_serviceability || "good");
      setCulvertSizeM2(draft.culvert_size_m2 !== undefined ? String(draft.culvert_size_m2) : "");
      setCulvertOpenings(draft.culvert_openings !== undefined ? String(draft.culvert_openings) : "");
    } else if (category === "shelvet") {
      setShelvetType(draft.shelvets_type || "armco");
      setShelvetCondition(draft.shelvet_condition || "good");
      setShelvetServiceability(draft.shelvet_serviceability || draft.shelvet_condition || "good");
      setShelvetSizeM2(draft.shelvet_size_m2 !== undefined ? String(draft.shelvet_size_m2) : "");
      setShelvetOpenings(draft.shelvet_openings !== undefined ? String(draft.shelvet_openings) : "");
    } else if (category === "sealed") {
      setSealedName(draft.paved_road_name || "");
      setSealedRoute(draft.Route_number_004 || "");
      setSealedClass(draft.paved_road_class || "secondary");
      setSealedType(draft.paved_road_type || "wide_mat_ss");
      setSealedClimate(draft.Climate_Region_001 || "moderate");
      setSealedTerrain(draft.Terrain_Type_002 || "flat");
      setSealedAuthority(draft.Authority_Name_002 === "ddf" ? "rida" : (draft.Authority_Name_002 || "rdc"));
      setSealedLength(draft.Road_Length_km !== undefined ? String(draft.Road_Length_km) : "");
      setSealedWidth(draft.Road_width_m_002 !== undefined ? String(draft.Road_width_m_002) : "");
      setSealedDrainageType(draft.Drainage_Type_002_001 || "v_drain");
      setSealedVegetation(draft.servitude_vegetation_001 || "medium");
      setSealedNarrowCracks(draft.Narrow_cracks_degree || "no_cracks");
      setSealedWideCracks(draft.Wide_cracks_degree || "no_cracks");
      setSealedPotholesPatches(mapLegacyPotholePatches(draft.Pothole_patches_degree));
      setSealedRutting(draft.Rutting_degree || "no_rutting__5mm");
      setSealedEdgeBreaks(draft.Edge_breaks_Degree || "no_edge_break");
      setSealedEdgeDrop(draft.Edge_Drop_Degree || "no_edge_break");
      setSealedDrainage(draft.Drainage_001 || "good");
      setSealedRavelling(draft.Ravelling_Degree || "none");
      setSealedRidingQuality(draft.Riding_quality_degree_001 || "good");
      setSealedRoadMarkings(draft.Road_markings || "yes");
      setSealedRoadStuds(draft.Road_studs || "yes");
      setSealedPassability(draft.Passability_002 || "all_year_round");
      setSealedYearConstructed(draft.Year_constructed_to_sealed_standard !== undefined ? String(draft.Year_constructed_to_sealed_standard) : "");
      setSealedSurfaceType(draft.Surface_type || "asphalt");
      setSealedPotholeDensity(draft.Pothole_density || "low");
      setSealedCycleTrack(draft.Cycle_track || "no");
      setSealedSurveySide(draft.Survey_side || "left");
      setSealedSurveyDirection(draft.Survey_direction || "");
      setSealedLanesPerCarriage(draft.Number_of_Lanes_per_carriageway !== undefined ? String(draft.Number_of_Lanes_per_carriageway) : "");
      setSealedShoulderWidth(draft.Shoulder_Width_m !== undefined ? String(draft.Shoulder_Width_m) : "");
      setSealedMedianType(draft.Median_type || "none");
      setSealedDrainageLining(draft.Drainage_lining || "not_lined");
      setSealedRoadMarkingsVisible(draft.Road_markings_visible || "yes");
      setSealedC1NarrowCracks(draft.Carriage1_Narrow_cracks || "no_cracks");
      setSealedC1WideCracks(draft.Carriage1_Wide_cracks || "no_cracks");
      setSealedC1Potholes(mapLegacyPotholePatches(draft.Carriage1_Pothole_patches));
      setSealedC1Rutting(draft.Carriage1_Rutting || "no_rutting__5mm");
      setSealedC1EdgeBreaks(draft.Carriage1_Edge_breaks || "no_edge_break");
      setSealedC1EdgeDrop(draft.Carriage1_Edge_drop || "no_edge_break");
      setSealedC1Ravelling(draft.Carriage1_Ravelling || "none");
      setSealedC1RidingQuality(draft.Carriage1_Riding_quality || "good");
      setSealedC2NarrowCracks(draft.Carriage2_Narrow_cracks || "no_cracks");
      setSealedC2WideCracks(draft.Carriage2_Wide_cracks || "no_cracks");
      setSealedC2Potholes(mapLegacyPotholePatches(draft.Carriage2_Pothole_patches));
      setSealedC2Rutting(draft.Carriage2_Rutting || "no_rutting__5mm");
      setSealedC2EdgeBreaks(draft.Carriage2_Edge_breaks || "no_edge_break");
      setSealedC2EdgeDrop(draft.Carriage2_Edge_drop || "no_edge_break");
      setSealedC2Ravelling(draft.Carriage2_Ravelling || "none");
      setSealedC2RidingQuality(draft.Carriage2_Riding_quality || "good");
    } else if (category === "gravel") {
      setGravelName(draft.gravel_road_name || "");
      setGravelRoute(draft.Route_Number || "");
      setGravelLength(draft.Road_Length !== undefined ? String(draft.Road_Length) : "");
      setGravelClass(draft.gravel_road_class || "urban_collector");
      setGravelAuthority(draft.Authority_Name === "ddf" ? "rida" : (draft.Authority_Name || "rdc"));
      setGravelVegetation(draft.servitude_vegetation || "medium");
      setGravelClimate(draft.Climate_Region || "moderate");
      setGravelTerrain(draft.Terrain_Type || "flat");
      setGravelWidth(draft.Road_Width_m !== undefined ? String(draft.Road_Width_m) : "");
      setGravelDrainageType(draft.Drainage_Type || "v_drain");
      setGravelCrossSection(draft.Cross_section || "standard");
      setGravelThickness(draft.Gravel_Thickness_mm || "none");
      setGravelCorrugations(draft.Corrugations || "none");
      setGravelRidingQuality(draft.Riding_Quality_degree || "good");
      setGravelPotholes(draft.Potholes_Degree || "none");
      setGravelPassability(draft.Passability || "all_year");
      setGravelYearConstructed(draft.Year_of_Counstruction !== undefined ? String(draft.Year_of_Counstruction) : "");
      setGravelDrainageCond(draft.Drainage_condition || "good");
      setGravelCorrugationsSeverity(draft.gravel_corrugations_severity || "none");
      setGravelCrossSectionSeverity(draft.gravel_cross_section_severity || "none");
      setGravelDrainageSeverity(draft.gravel_drainage_severity || "none");
      setGravelPotholesSeverity(draft.gravel_potholes_severity || "none");
      setGravelRidingSeverity(draft.gravel_riding_severity || "none");
    } else if (category === "earth") {
      setEarthName(draft.earth_road_name || "");
      setEarthClass(draft.earth_road_class || "secondary");
      setEarthWidth(draft.earth_road_width !== undefined ? String(draft.earth_road_width) : "");
      setEarthLength(draft.earth_road_length !== undefined ? String(draft.earth_road_length) : "");
      setEarthCondition(draft.earth_road_condition || "good");
      setEarthPassability(draft.earth_road_passability || "all_year");
      setEarthDrainageType(draft.earth_drainage_type || "v_drain");
      setEarthDrainageCond(draft.earth_drainage_condition || "good");
      setEarthTerrain(draft.earth_terrain || "flat");
      setEarthClimate(draft.earth_climate || "moderate");
      setEarthAuthority(draft.earth_authority === "ddf" ? "rida" : (draft.earth_authority || "rdc"));
      setEarthYearConstructed(draft.earth_year_constructed !== undefined ? String(draft.earth_year_constructed) : "");
    } else if (category === "footbridge") {
      setFootbridgeName(draft.footbridge_name || "");
      setFootbridgeType(draft.footbridge_type || "concrete");
      setFootbridgeCondition(draft.footbridge_condition || "good");
      setFootbridgeWidth(draft.footbridge_width !== undefined ? String(draft.footbridge_width) : "");
      setFootbridgeSpan(draft.footbridge_span !== undefined ? String(draft.footbridge_span) : "");
      setFootbridgeMaterial(draft.footbridge_material || "concrete");
      setFootbridgeCrossing(draft.footbridge_crossing || "river");
    } else if (category === "rail_crossing") {
      setRailCrossingName(draft.rail_crossing_name || "");
      setRailCrossingType(draft.rail_crossing_type || "at_grade");
      setRailCrossingCondition(draft.rail_crossing_condition || "good");
      setRailCrossingControl(draft.rail_crossing_control || "gates");
      setRailCrossingRoadClass(draft.rail_crossing_road_class || "secondary");
    } else if (category === "tollgate") {
      setTollgateName(draft.tollgate_name || "");
      setTollgateType(draft.tollgate_type || "manual");
      setTollgateCondition(draft.tollgate_condition || "good");
      setTollgateLanes(draft.tollgate_lanes !== undefined ? String(draft.tollgate_lanes) : "");
      setTollgateOperational(draft.tollgate_operational || "yes");
      setTollgateDualisation(draft.tollgate_dualisation || "no");
      setTollgateVegetation(draft.tollgate_vegetation || "none");
    } else if (category === "layby") {
      setLaybyCondition(draft.layby_condition || "good");
      setLaybySurface(draft.layby_surface || "gravel");
      setLaybyLength(draft.layby_length !== undefined ? String(draft.layby_length) : "");
      setLaybyDrainage(draft.layby_drainage || "good");
      setLaybyWidth(draft.layby_width !== undefined ? String(draft.layby_width) : "");
      setLaybyFurniture(draft.layby_furniture || "good");
      setLaybyRefuseBin(draft.layby_refuse_bin || "no");
    } else if (category === "busstop") {
      setBusstopType(draft.busstop_type || "bay_type");
      setBusstopCondition(draft.busstop_condition || "good");
      setBusstopShelter(draft.busstop_shelter || "yes");
      setBusstopDrainage(draft.busstop_drainage || "good");
      setBusstopFurnitureCondition(draft.busstop_furniture_condition || "good");
      setBusstopRefuseBin(draft.busstop_refuse_bin || "no");
    } else if (category === "junction") {
      setJunctionType(draft.junction_type || "t_junction");
      setJunctionCondition(draft.junction_condition || "good");
      setJunctionControl(draft.junction_control || "signs");
      setJunctionMarkings(draft.junction_road_markings || "yes");
      setJunctionSignage(draft.junction_signage || "good");
    } else if (category === "sign") {
      setSignType(draft.sign_type || "warning");
      setSignCondition(draft.sign_condition || "good");
      setSignSadcCompliant(draft.sign_sadc_compliant || "yes");
      setSignVisibility(draft.sign_visibility || "good");
      setSignName(draft.sign_name || "");
    } else if (category === "piped_causeway") {
      setCausewayName(draft.causeway_name || "");
      setCausewayPipeMaterial(draft.causeway_pipe_material || "concrete");
      setCausewayPipeDiameter(draft.causeway_pipe_diameter || "600_900");
      setCausewayDrainage(draft.causeway_drainage || "good");
      setCausewayServiceability(draft.causeway_serviceability || "good");
      setCausewayCondition(draft.causeway_condition || "good");
      setCausewayType(draft.causeway_type || "piped");
      setCausewayLength(draft.causeway_length_m !== undefined ? String(draft.causeway_length_m) : "");
      setCausewayOpenings(draft.causeway_openings !== undefined ? String(draft.causeway_openings) : "");
      setCausewayBoxSize(draft.causeway_box_size || "");
    } else if (category === "drift") {
      setDriftName(draft.drift_name || "");
      setDriftCondition(draft.drift_condition || "good");
      setDriftSurface(draft.drift_surface || "concrete");
      setDriftPassability(draft.drift_passability || "dry_season_only");
      setDriftWidth(draft.drift_width !== undefined ? String(draft.drift_width) : "");
      setDriftLength(draft.drift_length_m !== undefined ? String(draft.drift_length_m) : "");
      setDriftType(draft.drift_type || "concrete");
    } else if (category === "grid") {
      setGridName(draft.grid_name || "");
      setGridCondition(draft.grid_condition || "good");
      setGridMaterial(draft.grid_material || "steel");
      setGridOperational(draft.grid_operational || "yes");
      setGridServiceability(draft.grid_serviceability || "good");
      setGridPassability(draft.grid_passability || "all_year_round");
    } else if (category === "traffic_lights") {
      setTrafficLightsLocation(draft.traffic_lights_location || "");
      setTrafficLightsCondition(draft.traffic_lights_condition || "good");
      setTrafficLightsOperational(draft.traffic_lights_operational || "yes");
      setTrafficLightsType(draft.traffic_lights_type || "standard");
      setTrafficLightsPhases(draft.traffic_lights_phases !== undefined ? String(draft.traffic_lights_phases) : "");
      setTrafficLightsPowerSource(draft.traffic_lights_power_source || "grid");
    } else if (category === "streetlight") {
      setStreetlightType(draft.streetlight_type || "led");
      setStreetlightCondition(draft.streetlight_condition || "good");
      setStreetlightPowerSource(draft.streetlight_power_source || "grid");
      setStreetlightOperational(draft.streetlight_operational || "yes");
      setStreetlightCount(draft.streetlight_count !== undefined ? String(draft.streetlight_count) : "");
    } else if (category === "catchpit") {
      setCatchpitCondition(draft.catchpit_condition || "good");
    } else if (category === "traffic_calming") {
      setTrafficCalmingType(draft.traffic_calming_type || "speed_hump");
      setTrafficCalmingCondition(draft.traffic_calming_condition || "good");
    }

    setActiveTab("form");
    showToast(`Loaded draft for editing.`, "info");
  };

  const handleSaveForm = (e: React.FormEvent, saveAsDraft: boolean) => {
    e.preventDefault();

    if (!saveAsDraft) {
      if (!roadName.trim()) {
        showToast("Highway Route is required", "error");
        return;
      }
      if (!sectionName.trim()) {
        showToast("Section Name is required", "error");
        return;
      }
      if (!surveyorName.trim()) {
        showToast("Surveyor Name is required", "error");
        return;
      }

      if (isRoadType) {
        // Road surveys: GPS is derived from segment geometry — no separate point capture needed
        if (!segmentGeometry || segmentGeometry.points.length === 0) {
          showToast("🛰 Please complete the GPS segment recording before queueing.", "error");
          return;
        }
        if (!vegetation) {
          showToast("Vegetation Status is required — complete the segment first.", "error");
          return;
        }
        if (assetCategory === "sealed" && !roadName.trim()) {
          showToast("Sealed road name is required (use Highway Route)", "error");
          return;
        }
        if (assetCategory === "gravel" && !roadName.trim()) {
          showToast("Gravel road name is required (use Highway Route)", "error");
          return;
        }
        if (assetCategory === "earth" && !roadName.trim()) {
          showToast("Earth road name is required (use Highway Route)", "error");
          return;
        }
        const roadClassForLimit =
          assetCategory === "sealed" ? sealedClass
          : assetCategory === "gravel" ? gravelClass : earthClass;
        const segCheck = validateSegmentLengthM(segmentGeometry.length_m, roadClassForLimit);
        if (!segCheck.ok) {
          showToast(segCheck.message, "error");
          return;
        }
        // Auto-populate GPS from the first segment point
        const firstPt = segmentGeometry.points[0];
        const derivedGps = `${firstPt.lat.toFixed(6)} ${firstPt.lng.toFixed(6)} ${firstPt.alt ?? 1200} ${Math.round(firstPt.acc)}`;
        setGps(derivedGps);
      } else {
        if (!vegetation) {
          showToast("Vegetation Status is required", "error");
          return;
        }
        // Non-road / point surveys: require a fresh Capture GPS before queue/save
        if (!gps || !gps.trim()) {
          showToast("Capture GPS at this asset before queueing. Each point survey needs its own location.", "error");
          return;
        }
        const gpsParts = gps.trim().split(/\s+/);
        const lat = parseFloat(gpsParts[0]);
        const lng = parseFloat(gpsParts[1]);
        if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
          showToast("GPS coordinates are invalid. Capture GPS again at this asset.", "error");
          return;
        }
        const gpsAcc = gpsParts.length >= 4 ? parseFloat(gpsParts[3]) : NaN;
        if (!isNaN(gpsAcc) && gpsAcc > gpsAccuracyLimit) {
          showToast(`❌ GPS accuracy ±${Math.round(gpsAcc)}m is too poor (≤${gpsAccuracyLimit}m required). Re-capture GPS in open-sky area.`, "error");
          return;
        }
      }
    }

    const capturedSurveyDate = captureSurveyDate();

    const baseData = {
      asset_category: assetCategory,
      road_name: roadName,
      section_name: sectionName || "(Incomplete Draft)",
      surveyor_name: surveyorName || "(Draft Surveyor)",
      survey_date: capturedSurveyDate,
      vegetation,
      gps: gps || "",
      image_SADC_compliant: imageSadcCompliant,
      photo: photos[0] || undefined,
      photos: photos.length > 0 ? photos : undefined,
      status: saveAsDraft ? ("draft" as const) : ("queued" as const),
      gps_accuracy_threshold: gpsAccuracyLimit
    };

    let draftData: Omit<SurveyDraft, "id">;

    if (assetCategory === "bridge") {
      if (!saveAsDraft && !bridgeName) {
        showToast("Bridge name is required.", "error");
        return;
      }
      draftData = {
        ...baseData,
        bridge: bridgeName,
        bridge_crossing: bridgeCrossing,
        bridge_type: bridgeType,
        bridge_bearing: bridgeBearing,
        bridge_joints: bridgeJoints,
        bearings_state: bearingsState,
        parapet,
        chemical_effect: chemicalEffect,
        vegetation_growth: vegetationGrowth,
        drainage,
        bridge_condition: bridgeCondition,
        bridge_structure_type: bridgeStructureType,
        bridge_length_m: bridgeLength ? parseFloat(bridgeLength) : undefined,
        bridge_width_m: bridgeWidth ? parseFloat(bridgeWidth) : undefined,
        bridge_spans: bridgeSpans ? parseInt(bridgeSpans) : undefined,
        bridge_approach_condition: bridgeApproachCondition,
        bridge_signage: bridgeSignage,
      };
    } else if (assetCategory === "culvert") {
      draftData = {
        ...baseData,
        culvet_class: culvertClass,
        culvet_type: culvertType,
        culvet_serviceability: culvertServiceability,
        culvert_size_m2: culvertSizeM2 ? parseFloat(culvertSizeM2) : undefined,
        culvert_openings: culvertOpenings ? parseInt(culvertOpenings) : undefined,
      };
    } else if (assetCategory === "shelvet") {
      draftData = {
        ...baseData,
        shelvets_type: shelvetType,
        shelvet_condition: shelvetCondition,
        shelvet_serviceability: shelvetServiceability,
        shelvet_size_m2: shelvetSizeM2 ? parseFloat(shelvetSizeM2) : undefined,
        shelvet_openings: shelvetOpenings ? parseInt(shelvetOpenings) : undefined,
      };
    } else if (assetCategory === "sealed") {
      const finalSealedName = roadName.split(" (")[0] || roadName;
      const chainFrom = chainageFrom.trim() ? parseFloat(chainageFrom) : undefined;
      const chainTo = chainageTo.trim() ? parseFloat(chainageTo) : undefined;
      draftData = {
        ...baseData,
        paved_road_name: finalSealedName,
        paved_road_class: sealedClass,
        paved_road_type: sealedType,
        paved_road_condition: sealedRidingQuality,
        pothole_patches: sealedPotholesPatches,
        vegetation: sealedVegetation,
        chainage_from_km: chainFrom,
        chainage_to_km: chainTo,
        Road_Name_002: finalSealedName,
        Route_number_004: undefined,
        Road_Class_002: sealedClass,
        Road_Type: sealedType,
        Climate_Region_001: sealedClimate,
        Terrain_Type_002: sealedTerrain,
        Authority_Name_002: sealedAuthority,
        Road_Length_km: sealedLength ? parseFloat(sealedLength) : undefined,
        Road_width_m_002: sealedWidth ? parseFloat(sealedWidth) : undefined,
        Drainage_Type_002_001: sealedDrainageType,
        servitude_vegetation_001: sealedVegetation,
        Narrow_cracks_degree: sealedNarrowCracks,
        Wide_cracks_degree: sealedWideCracks,
        Pothole_patches_degree: sealedPotholesPatches,
        Rutting_degree: sealedRutting,
        Edge_breaks_Degree: sealedEdgeBreaks,
        Edge_Drop_Degree: sealedEdgeDrop,
        Drainage_001: sealedDrainage,
        Ravelling_Degree: sealedRavelling,
        Riding_quality_degree_001: sealedRidingQuality,
        Road_markings: sealedRoadMarkings,
        Road_studs: sealedRoadStuds,
        Passability_002: sealedPassability,
        Year_constructed_to_sealed_standard: sealedYearConstructed ? parseInt(sealedYearConstructed) : undefined,
        Surface_type: sealedSurfaceType,
        Pothole_density: sealedPotholeDensity,
        Cycle_track: sealedCycleTrack,
        Survey_side: sealedSurveySide,
        Survey_direction: sealedSurveyDirection || undefined,
        Number_of_Lanes_per_carriageway: sealedLanesPerCarriage ? parseInt(sealedLanesPerCarriage) : undefined,
        Shoulder_Width_m: sealedShoulderWidth ? parseFloat(sealedShoulderWidth) : undefined,
        Median_type: sealedMedianType,
        Drainage_lining: sealedDrainageLining,
        Road_markings_visible: sealedRoadMarkingsVisible,
        Chainage_from_km_002: chainFrom,
        Chainage_to_km_002: chainTo,
        Carriage1_Narrow_cracks: sealedC1NarrowCracks,
        Carriage1_Wide_cracks: sealedC1WideCracks,
        Carriage1_Pothole_patches: sealedC1Potholes,
        Carriage1_Rutting: sealedC1Rutting,
        Carriage1_Edge_breaks: sealedC1EdgeBreaks,
        Carriage1_Edge_drop: sealedC1EdgeDrop,
        Carriage1_Ravelling: sealedC1Ravelling,
        Carriage1_Riding_quality: sealedC1RidingQuality,
        Carriage2_Narrow_cracks: sealedC2NarrowCracks,
        Carriage2_Wide_cracks: sealedC2WideCracks,
        Carriage2_Pothole_patches: sealedC2Potholes,
        Carriage2_Rutting: sealedC2Rutting,
        Carriage2_Edge_breaks: sealedC2EdgeBreaks,
        Carriage2_Edge_drop: sealedC2EdgeDrop,
        Carriage2_Ravelling: sealedC2Ravelling,
        Carriage2_Riding_quality: sealedC2RidingQuality,
      };
    } else if (assetCategory === "gravel") {
      const finalGravelName = roadName.split(" (")[0] || roadName;
      const chainFrom = chainageFrom.trim() ? parseFloat(chainageFrom) : undefined;
      const chainTo = chainageTo.trim() ? parseFloat(chainageTo) : undefined;
      draftData = {
        ...baseData,
        gravel_road_name: finalGravelName,
        gravel_road_class: gravelClass,
        gravel_thickness: gravelThickness,
        gravel_condition: gravelRidingQuality,
        drainage_condition: gravelDrainageCond,
        vegetation: gravelVegetation,
        chainage_from_km: chainFrom,
        chainage_to_km: chainTo,
        Road_Name: finalGravelName,
        Route_Number: undefined,
        Road_Length: gravelLength ? parseFloat(gravelLength) : undefined,
        Road_Class: gravelClass,
        Authority_Name: gravelAuthority,
        servitude_vegetation: gravelVegetation,
        Climate_Region: gravelClimate,
        Terrain_Type: gravelTerrain,
        Road_Width_m: gravelWidth ? parseFloat(gravelWidth) : undefined,
        Drainage_Type: gravelDrainageType,
        Cross_section: gravelCrossSection,
        Gravel_Thickness_mm: gravelThickness,
        Corrugations: gravelCorrugations,
        Riding_Quality_degree: gravelRidingQuality,
        Drainage_condition: gravelDrainageCond,
        Potholes_Degree: gravelPotholes,
        Passability: gravelPassability,
        Year_of_Counstruction: gravelYearConstructed ? parseInt(gravelYearConstructed) : undefined,
        Chainage_From_km: chainFrom,
        Chainage_To_km: chainTo,
        gravel_corrugations_severity: gravelCorrugationsSeverity,
        gravel_cross_section_severity: gravelCrossSectionSeverity,
        gravel_drainage_severity: gravelDrainageSeverity,
        gravel_potholes_severity: gravelPotholesSeverity,
        gravel_riding_severity: gravelRidingSeverity,
      };
    } else if (assetCategory === "earth") {
      const chainFrom = chainageFrom.trim() ? parseFloat(chainageFrom) : undefined;
      const chainTo = chainageTo.trim() ? parseFloat(chainageTo) : undefined;
      draftData = {
        ...baseData,
        earth_road_name: roadName.split(" (")[0] || roadName,
        earth_road_class: earthClass,
        earth_road_width: earthWidth ? parseFloat(earthWidth) : undefined,
        earth_road_length: earthLength ? parseFloat(earthLength) : undefined,
        earth_road_condition: earthCondition,
        earth_road_passability: earthPassability,
        earth_drainage_type: earthDrainageType,
        earth_drainage_condition: earthDrainageCond,
        earth_terrain: earthTerrain,
        earth_climate: earthClimate,
        earth_authority: earthAuthority,
        earth_year_constructed: earthYearConstructed ? parseInt(earthYearConstructed) : undefined,
        chainage_from_km: chainFrom,
        chainage_to_km: chainTo,
      };
    } else if (assetCategory === "footbridge") {
      if (!saveAsDraft && !footbridgeName) { showToast("Footbridge name is required.", "error"); return; }
      draftData = {
        ...baseData,
        footbridge_name: footbridgeName,
        footbridge_type: footbridgeType,
        footbridge_condition: footbridgeCondition,
        footbridge_width: footbridgeWidth ? parseFloat(footbridgeWidth) : undefined,
        footbridge_span: footbridgeSpan ? parseFloat(footbridgeSpan) : undefined,
        footbridge_material: footbridgeMaterial,
        footbridge_crossing: footbridgeCrossing,
      };
    } else if (assetCategory === "rail_crossing") {
      draftData = {
        ...baseData,
        rail_crossing_name: railCrossingName,
        rail_crossing_type: railCrossingType,
        rail_crossing_condition: railCrossingCondition,
        rail_crossing_control: railCrossingControl,
        rail_crossing_road_class: railCrossingRoadClass,
      };
    } else if (assetCategory === "tollgate") {
      if (!saveAsDraft && !tollgateName) { showToast("Tollgate name is required.", "error"); return; }
      draftData = {
        ...baseData,
        tollgate_name: tollgateName,
        tollgate_type: tollgateType,
        tollgate_condition: tollgateCondition,
        tollgate_lanes: tollgateLanes ? parseInt(tollgateLanes) : undefined,
        tollgate_operational: tollgateOperational,
        tollgate_dualisation: tollgateDualisation,
        tollgate_vegetation: tollgateVegetation,
      };
    } else if (assetCategory === "layby") {
      draftData = {
        ...baseData,
        layby_condition: laybyCondition,
        layby_surface: laybySurface,
        layby_length: laybyLength ? parseFloat(laybyLength) : undefined,
        layby_drainage: laybyDrainage,
        layby_width: laybyWidth ? parseFloat(laybyWidth) : undefined,
        layby_furniture: laybyFurniture,
        layby_refuse_bin: laybyRefuseBin,
      };
    } else if (assetCategory === "busstop") {
      draftData = {
        ...baseData,
        busstop_type: busstopType,
        busstop_condition: busstopCondition,
        busstop_shelter: busstopShelter,
        busstop_drainage: busstopDrainage,
        busstop_furniture_condition: busstopFurnitureCondition,
        busstop_refuse_bin: busstopRefuseBin,
      };
    } else if (assetCategory === "junction") {
      draftData = {
        ...baseData,
        junction_type: junctionType,
        junction_condition: junctionCondition,
        junction_control: junctionControl,
        junction_road_markings: junctionMarkings,
        junction_signage: junctionSignage,
      };
    } else if (assetCategory === "sign") {
      draftData = {
        ...baseData,
        sign_type: signType,
        sign_condition: signCondition,
        sign_sadc_compliant: signSadcCompliant,
        sign_visibility: signVisibility,
        sign_name: signName || undefined,
      };
    } else if (assetCategory === "piped_causeway") {
      draftData = {
        ...baseData,
        causeway_name: causewayName,
        causeway_condition: causewayCondition,
        causeway_type: causewayType,
        causeway_length_m: causewayLength ? parseFloat(causewayLength) : undefined,
        causeway_openings: causewayOpenings ? parseInt(causewayOpenings) : undefined,
        causeway_box_size: causewayBoxSize || undefined,
        causeway_pipe_material: causewayPipeMaterial,
        causeway_pipe_diameter: causewayPipeDiameter,
        causeway_drainage: causewayDrainage,
        causeway_serviceability: causewayServiceability,
      };
    } else if (assetCategory === "drift") {
      draftData = {
        ...baseData,
        drift_name: driftName,
        drift_condition: driftCondition,
        drift_surface: driftSurface,
        drift_passability: driftPassability,
        drift_width: driftWidth ? parseFloat(driftWidth) : undefined,
        drift_length_m: driftLength ? parseFloat(driftLength) : undefined,
        drift_type: driftType,
      };
    } else if (assetCategory === "grid") {
      draftData = {
        ...baseData,
        grid_name: gridName,
        grid_condition: gridCondition,
        grid_material: gridMaterial,
        grid_operational: gridOperational,
        grid_serviceability: gridServiceability,
        grid_passability: gridPassability,
      };
    } else if (assetCategory === "traffic_lights") {
      draftData = {
        ...baseData,
        traffic_lights_location: trafficLightsLocation,
        traffic_lights_condition: trafficLightsCondition,
        traffic_lights_operational: trafficLightsOperational,
        traffic_lights_type: trafficLightsType,
        traffic_lights_phases: trafficLightsPhases ? parseInt(trafficLightsPhases) : undefined,
        traffic_lights_power_source: trafficLightsPowerSource,
      };
    } else if (assetCategory === "streetlight") {
      draftData = {
        ...baseData,
        streetlight_type: streetlightType,
        streetlight_condition: streetlightCondition,
        streetlight_power_source: streetlightPowerSource,
        streetlight_operational: streetlightOperational,
        streetlight_count: streetlightCount ? parseInt(streetlightCount) : undefined,
      };
    } else if (assetCategory === "catchpit") {
      draftData = {
        ...baseData,
        catchpit_condition: catchpitCondition,
      };
    } else if (assetCategory === "traffic_calming") {
      draftData = {
        ...baseData,
        traffic_calming_type: trafficCalmingType,
        traffic_calming_condition: trafficCalmingCondition,
      };
    } else {
      draftData = { ...baseData };
    }

    // Attach GPS line geometry for road survey types
    if (isRoadType && segmentGeometry) {
      draftData = {
        ...draftData,
        road_segment_points: segmentGeometry.points,
        road_segment_geojson: segmentGeometry.geojson,
        road_segment_length_m: segmentGeometry.length_m,
        road_segment_start_time: segmentGeometry.start_time,
        road_segment_end_time: segmentGeometry.end_time,
        road_segment_avg_accuracy_m: segmentGeometry.avg_accuracy_m,
        road_segment_point_count: segmentGeometry.point_count,
      };
    }

    if (editingDraftId) {
      db.updateDraft(editingDraftId, draftData);
      showToast(`${assetCategory.toUpperCase()} survey updated (${saveAsDraft ? "Draft" : "Queued"})!`, "success");
    } else {
      db.addDraft(draftData);
      showToast(`${assetCategory.toUpperCase()} survey saved as ${saveAsDraft ? "Draft" : "Queued for Sync"}!`, "success");
    }

    // Clear temp draft — form data is now properly saved
    localStorage.removeItem("roads_temp_draft");
    setHasTempDraft(false);

    const updated = db.getDrafts();
    setDrafts(updated);

    // Keep paused line session when saving a point asset mid-route
    const keepPausedLine = !isRoadType && !!pausedRoadContext;
    const pausedSnapshot = pausedRoadContext;
    clearForm();
    // Clear GPS refs so the next point asset cannot reuse this fix
    liveGpsPosRef.current = null;
    bestGpsPosRef.current = null;
    setLiveGpsAccuracy(null);
    setBestGpsAccuracy(null);
    setGps("");
    if (keepPausedLine && pausedSnapshot) {
      persistPausedRoadContext(pausedSnapshot);
      setSelectedCategory(null);
      showToast(
        `Point saved. Resume ${pausedSnapshot.roadCategory} line (${pausedSnapshot.pointCount} GPS pts) when ready.`,
        "info"
      );
    } else if (isRoadType) {
      discardPausedRoadSession();
    }
  };

  const handleDeleteDraft = (id: string) => {
    const target = drafts.find((d) => d.id === id);
    const kind = target?.status === "queued" ? "queued survey" : "draft";
    if (!window.confirm(`Delete this ${kind}? This cannot be undone.`)) return;
    db.deleteDraft(id);
    setDrafts(db.getDrafts());
    showToast("Survey draft deleted.", "info");
  };

  const handleSyncDrafts = async () => {
    const queuedDrafts = drafts.filter((d) => d.status === "queued");
    if (queuedDrafts.length === 0) {
      showToast("No queued surveys ready to sync. Complete and queue drafts first!", "info");
      return;
    }

    setIsSyncing(true);
    setSyncProgress({ current: 0, total: queuedDrafts.length, currentName: "" });
    showToast(`Uploading ${queuedDrafts.length} queued surveys directly to server...`, "info");

    const SUPABASE_URL = "https://kchmhpwmyubesocdssga.supabase.co";
    const SUPABASE_ANON_KEY = "sb_publishable_XVL14JBx0YdcbqXlUEsN7w_8xhPeA4W";
    const FIREBASE_PROJECT = "road-condition-survey";
    const FIREBASE_DB = "road-condition-survey";

    let successCount = 0;

    const categoryToTable: Record<string, string> = {
      sealed: "survey_sealed_roads",
      gravel: "survey_gravel_roads",
      earth: "survey_earth_roads",
      bridge: "survey_bridges",
      footbridge: "survey_footbridges",
      rail_crossing: "survey_rail_crossings",
      tollgate: "survey_tollgates",
      layby: "survey_laybys",
      busstop: "survey_busstops",
      junction: "survey_junctions",
      sign: "survey_road_signs",
      shelvet: "survey_shelvets",
      culvert: "survey_culverts",
      piped_causeway: "survey_piped_causeways",
      drift: "survey_drifts",
      grid: "survey_grids",
      catchpit: "survey_catchpits",
      traffic_calming: "survey_traffic_calming",
      traffic_lights: "survey_traffic_lights",
      streetlight: "survey_streetlights"
    };

    const mapDraftToSupabaseTable = (draft: any, tableName: string) => {
      const photoList: string[] = [];
      const addPhoto = (item: unknown) => {
        if (typeof item === "string" && item.trim()) photoList.push(item.trim());
      };
      if (Array.isArray(draft.photos)) draft.photos.forEach(addPhoto);
      addPhoto(draft.photo);
      const uniquePhotos = Array.from(new Set(photoList));
      const rawWithoutPhotos =
        draft && typeof draft === "object"
          ? Object.fromEntries(Object.entries(draft).filter(([k]) => k !== "photo" && k !== "photos"))
          : draft;

      const row: any = {
        survey_id:            draft.id,
        asset_category:       draft.asset_category || Object.keys(categoryToTable).find(k => categoryToTable[k] === tableName) || null,
        road_name:            draft.road_name || null,
        section_name:         draft.section_name || null,
        surveyor_name:        draft.surveyor_name || null,
        survey_date:          draft.survey_date || null,
        gps_point:            draft.gps || null,
        image_sadc_compliant: draft.image_SADC_compliant || draft.image_sadc_compliant || "yes",
        photo:                uniquePhotos[0] || null,
        photos:               uniquePhotos.length > 0 ? uniquePhotos : null,
        raw_data:             rawWithoutPhotos,
        source:               "mobile_app"
      };

      const isRoadTable = tableName === "survey_sealed_roads" || tableName === "survey_gravel_roads" || tableName === "survey_earth_roads";

      if (isRoadTable) {
        row.segment_geojson = draft.road_segment_geojson || null;
        row.segment_length_m = draft.road_segment_length_m || null;
        row.segment_point_count = draft.road_segment_point_count || null;
        row.segment_avg_accuracy = draft.road_segment_avg_accuracy_m || null;
        row.segment_start_time = draft.road_segment_start_time || null;
        row.segment_end_time = draft.road_segment_end_time || null;
      }

      if (tableName === "survey_sealed_roads") {
        row.road_condition = draft.paved_road_condition || null;
        row.road_class = draft.paved_road_class || null;

        row.paved_road_name = draft.paved_road_name || null;
        row.paved_road_class = draft.paved_road_class || null;
        row.paved_road_type = draft.paved_road_type || null;
        row.paved_road_condition = draft.paved_road_condition || null;
        row.pothole_patches = draft.pothole_patches || null;
        row.road_name_002 = draft.Road_Name_002 || null;
        row.route_number_004 = draft.Route_number_004 || null;
        row.road_class_002 = draft.Road_Class_002 || null;
        row.road_type = draft.Road_Type || null;
        row.climate_region_001 = draft.Climate_Region_001 || null;
        row.terrain_type_002 = draft.Terrain_Type_002 || null;
        row.datum_point_reference_description = draft.Datum_point_reference_description || null;
        row.authority_name_002 = draft.Authority_Name_002 || null;
        row.number_of_lanes_per_carriageway = draft.Number_of_Lanes_per_carriageway !== undefined ? Number(draft.Number_of_Lanes_per_carriageway) : null;
        row.road_length_km = draft.Road_Length_km !== undefined ? Number(draft.Road_Length_km) : null;
        row.chainage_from_km_002 = draft.Chainage_from_km_002 !== undefined ? Number(draft.Chainage_from_km_002) : null;
        row.chainage_to_km_002 = draft.Chainage_to_km_002 !== undefined ? Number(draft.Chainage_to_km_002) : null;
        row.segment_length_km_002 = draft.Segment_Length_Km_002 !== undefined ? Number(draft.Segment_Length_Km_002) : null;
        row.road_width_m_002 = draft.Road_width_m_002 !== undefined ? Number(draft.Road_width_m_002) : null;
        row.shoulder_width_m = draft.Shoulder_Width_m !== undefined ? Number(draft.Shoulder_Width_m) : null;
        row.drainage_type_002_001 = draft.Drainage_Type_002_001 || null;
        row.servitude_vegetation_001 = draft.servitude_vegetation_001 || null;
        row.narrow_cracks_degree = draft.Narrow_cracks_degree || null;
        row.wide_cracks_degree = draft.Wide_cracks_degree || null;
        row.pothole_patches_degree = draft.Pothole_patches_degree || null;
        row.rutting_degree = draft.Rutting_degree || null;
        row.edge_breaks_degree = draft.Edge_breaks_Degree || null;
        row.edge_drop_degree = draft.Edge_Drop_Degree || null;
        row.drainage_001 = draft.Drainage_001 || null;
        row.ravelling_degree = draft.Ravelling_Degree || null;
        row.riding_quality_degree_001 = draft.Riding_quality_degree_001 || null;
        row.road_markings = draft.Road_markings || null;
        row.road_studs = draft.Road_studs || null;
        row.passability_002 = draft.Passability_002 || null;
        row.year_constructed_to_sealed_standard = draft.Year_constructed_to_sealed_standard !== undefined ? Number(draft.Year_constructed_to_sealed_standard) : null;
        row.last_surface_year = draft.Last_surface_year !== undefined ? Number(draft.Last_surface_year) : null;
        row.surface_type = draft.Surface_type || null;
        row.pothole_density = draft.Pothole_density || null;
        row.cycle_track = draft.Cycle_track || null;
        row.survey_side = draft.Survey_side || null;
        row.survey_direction = draft.Survey_direction || null;
        row.drainage_lining = draft.Drainage_lining || null;
        row.road_markings_visible = draft.Road_markings_visible || null;
        row.median_type = draft.Median_type || null;
        row.carriage1_narrow_cracks = draft.Carriage1_Narrow_cracks || null;
        row.carriage1_wide_cracks = draft.Carriage1_Wide_cracks || null;
        row.carriage1_pothole_patches = draft.Carriage1_Pothole_patches || null;
        row.carriage1_rutting = draft.Carriage1_Rutting || null;
        row.carriage1_edge_breaks = draft.Carriage1_Edge_breaks || null;
        row.carriage1_edge_drop = draft.Carriage1_Edge_drop || null;
        row.carriage1_ravelling = draft.Carriage1_Ravelling || null;
        row.carriage1_riding_quality = draft.Carriage1_Riding_quality || null;
        row.carriage2_narrow_cracks = draft.Carriage2_Narrow_cracks || null;
        row.carriage2_wide_cracks = draft.Carriage2_Wide_cracks || null;
        row.carriage2_pothole_patches = draft.Carriage2_Pothole_patches || null;
        row.carriage2_rutting = draft.Carriage2_Rutting || null;
        row.carriage2_edge_breaks = draft.Carriage2_Edge_breaks || null;
        row.carriage2_edge_drop = draft.Carriage2_Edge_drop || null;
        row.carriage2_ravelling = draft.Carriage2_Ravelling || null;
        row.carriage2_riding_quality = draft.Carriage2_Riding_quality || null;
      } else if (tableName === "survey_gravel_roads") {
        row.road_condition = draft.gravel_condition || null;
        row.road_class = draft.gravel_road_class || null;

        row.gravel_road_name = draft.gravel_road_name || null;
        row.gravel_road_class = draft.gravel_road_class || null;
        row.gravel_thickness = draft.gravel_thickness || null;
        row.gravel_condition = draft.gravel_condition || null;
        row.drainage_condition = draft.drainage_condition || null;
        row.road_name_gravel = draft.Road_Name || null;
        row.route_number = draft.Route_Number || null;
        row.road_length = draft.Road_Length !== undefined ? Number(draft.Road_Length) : null;
        row.datum_point_description = draft.Datum_point_description || null;
        row.road_class_raw = draft.Road_Class || null;
        row.authority_name = draft.Authority_Name || null;
        row.servitude_vegetation = draft.servitude_vegetation || null;
        row.climate_region = draft.Climate_Region || null;
        row.terrain_type = draft.Terrain_Type || null;
        row.chainage_from_km = draft.Chainage_From_km !== undefined ? Number(draft.Chainage_From_km) : null;
        row.chainage_to_km = draft.Chainage_To_km !== undefined ? Number(draft.Chainage_To_km) : null;
        row.segment_length_km = draft.Segment_Length_km !== undefined ? Number(draft.Segment_Length_km) : null;
        row.road_width_m = draft.Road_Width_m !== undefined ? Number(draft.Road_Width_m) : null;
        row.drainage_type = draft.Drainage_Type || null;
        row.cross_section = draft.Cross_section || null;
        row.gravel_thickness_mm = draft.Gravel_Thickness_mm || null;
        row.corrugations = draft.Corrugations || null;
        row.riding_quality_degree = draft.Riding_Quality_degree || null;
        row.potholes_degree = draft.Potholes_Degree || null;
        row.passability = draft.Passability || null;
        row.year_of_construction = draft.Year_of_Counstruction !== undefined ? Number(draft.Year_of_Counstruction) : null;
        row.age_in_years = draft.Age_in_Years !== undefined ? Number(draft.Age_in_Years) : null;
        row.last_year_of_re_gravelling = draft.Last_year_of_re_gravelling !== undefined ? Number(draft.Last_year_of_re_gravelling) : null;
        row.drainage_condition_raw = draft.Drainage_condition || null;
        row.gravel_corrugations_severity = draft.gravel_corrugations_severity || null;
        row.gravel_cross_section_severity = draft.gravel_cross_section_severity || null;
        row.gravel_drainage_severity = draft.gravel_drainage_severity || null;
        row.gravel_potholes_severity = draft.gravel_potholes_severity || null;
        row.gravel_riding_severity = draft.gravel_riding_severity || null;
      } else if (tableName === "survey_earth_roads") {
        row.road_condition = draft.earth_road_condition || null;
        row.road_class = draft.earth_road_class || null;

        row.earth_road_name = draft.earth_road_name || null;
        row.earth_road_class = draft.earth_road_class || null;
        row.earth_road_width = draft.earth_road_width !== undefined ? Number(draft.earth_road_width) : null;
        row.earth_road_length = draft.earth_road_length !== undefined ? Number(draft.earth_road_length) : null;
        row.earth_road_condition = draft.earth_road_condition || null;
        row.earth_road_passability = draft.earth_road_passability || null;
        row.earth_drainage_type = draft.earth_drainage_type || null;
        row.earth_drainage_condition = draft.earth_drainage_condition || null;
        row.earth_terrain = draft.earth_terrain || null;
        row.earth_climate = draft.earth_climate || null;
        row.earth_authority = draft.earth_authority || null;
        row.earth_year_constructed = draft.earth_year_constructed !== undefined ? Number(draft.earth_year_constructed) : null;
        row.chainage_from_km = draft.chainage_from_km !== undefined ? Number(draft.chainage_from_km) : null;
        row.chainage_to_km = draft.chainage_to_km !== undefined ? Number(draft.chainage_to_km) : null;
      } else if (tableName === "survey_catchpits") {
        row.catchpit_condition = draft.catchpit_condition || null;
      } else if (tableName === "survey_traffic_calming") {
        row.traffic_calming_type = draft.traffic_calming_type || null;
        row.traffic_calming_condition = draft.traffic_calming_condition || null;
      } else if (tableName === "survey_bridges") {
        row.bridge = draft.bridge || null;
        row.bridge_crossing = draft.bridge_crossing || null;
        row.bridge_type = draft.bridge_type || null;
        row.bridge_bearing = draft.bridge_bearing || null;
        row.bridge_joints = draft.bridge_joints || null;
        row.bearings_state = draft.bearings_state || null;
        row.parapet = draft.parapet || null;
        row.chemical_effect = draft.chemical_effect || null;
        row.vegetation_growth = draft.vegetation_growth || null;
        row.drainage = draft.drainage || null;
        row.bridge_condition = draft.bridge_condition || null;
      } else if (tableName === "survey_footbridges") {
        row.footbridge_name = draft.footbridge_name || null;
        row.footbridge_type = draft.footbridge_type || null;
        row.footbridge_condition = draft.footbridge_condition || null;
        row.footbridge_width = draft.footbridge_width !== undefined ? Number(draft.footbridge_width) : null;
        row.footbridge_span = draft.footbridge_span !== undefined ? Number(draft.footbridge_span) : null;
        row.footbridge_material = draft.footbridge_material || null;
        row.footbridge_crossing = draft.footbridge_crossing || null;
      } else if (tableName === "survey_rail_crossings") {
        row.rail_crossing_name = draft.rail_crossing_name || null;
        row.rail_crossing_type = draft.rail_crossing_type || null;
        row.rail_crossing_condition = draft.rail_crossing_condition || null;
        row.rail_crossing_control = draft.rail_crossing_control || null;
        row.rail_crossing_road_class = draft.rail_crossing_road_class || null;
      } else if (tableName === "survey_tollgates") {
        row.tollgate_name = draft.tollgate_name || null;
        row.tollgate_type = draft.tollgate_type || null;
        row.tollgate_condition = draft.tollgate_condition || null;
        row.tollgate_lanes = draft.tollgate_lanes !== undefined ? Number(draft.tollgate_lanes) : null;
        row.tollgate_operational = draft.tollgate_operational || null;
      } else if (tableName === "survey_laybys") {
        row.layby_condition = draft.layby_condition || null;
        row.layby_surface = draft.layby_surface || null;
        row.layby_length = draft.layby_length !== undefined ? Number(draft.layby_length) : null;
        row.layby_drainage = draft.layby_drainage || null;
      } else if (tableName === "survey_busstops") {
        row.busstop_type = draft.busstop_type || null;
        row.busstop_condition = draft.busstop_condition || null;
        row.busstop_shelter = draft.busstop_shelter || null;
        row.busstop_drainage = draft.busstop_drainage || null;
      } else if (tableName === "survey_junctions") {
        row.junction_type = draft.junction_type || null;
        row.junction_condition = draft.junction_condition || null;
        row.junction_control = draft.junction_control || null;
        row.junction_road_markings = draft.junction_road_markings || null;
        row.junction_signage = draft.junction_signage || null;
      } else if (tableName === "survey_road_signs") {
        row.sign_type = draft.sign_type || null;
        row.sign_condition = draft.sign_condition || null;
        row.sign_sadc_compliant = draft.sign_sadc_compliant || null;
        row.sign_visibility = draft.sign_visibility || null;
        row.sign_name = draft.sign_name || null;
      } else if (tableName === "survey_shelvets") {
        row.shelvets_type = draft.shelvets_type || null;
        row.shelvet_condition = draft.shelvet_condition || null;
      } else if (tableName === "survey_culverts") {
        row.culvet_class = draft.culvet_class || null;
        row.culvet_type = draft.culvet_type || null;
        row.culvet_serviceability = draft.culvet_serviceability || null;
      } else if (tableName === "survey_piped_causeways") {
        row.causeway_name = draft.causeway_name || null;
        row.causeway_condition = draft.causeway_condition || null;
        row.causeway_pipe_material = draft.causeway_pipe_material || null;
        row.causeway_pipe_diameter = draft.causeway_pipe_diameter || null;
        row.causeway_drainage = draft.causeway_drainage || null;
        row.causeway_serviceability = draft.causeway_serviceability || null;
      } else if (tableName === "survey_drifts") {
        row.drift_name = draft.drift_name || null;
        row.drift_condition = draft.drift_condition || null;
        row.drift_surface = draft.drift_surface || null;
        row.drift_passability = draft.drift_passability || null;
        row.drift_width = draft.drift_width !== undefined ? Number(draft.drift_width) : null;
      } else if (tableName === "survey_grids") {
        row.grid_name = draft.grid_name || null;
        row.grid_condition = draft.grid_condition || null;
        row.grid_material = draft.grid_material || null;
        row.grid_operational = draft.grid_operational || null;
      } else if (tableName === "survey_traffic_lights") {
        row.traffic_lights_location = draft.traffic_lights_location || null;
        row.traffic_lights_condition = draft.traffic_lights_condition || null;
        row.traffic_lights_operational = draft.traffic_lights_operational || null;
        row.traffic_lights_type = draft.traffic_lights_type || null;
        row.traffic_lights_phases = draft.traffic_lights_phases !== undefined ? Number(draft.traffic_lights_phases) : null;
      } else if (tableName === "survey_streetlights") {
        row.streetlight_type = draft.streetlight_type || null;
        row.streetlight_condition = draft.streetlight_condition || null;
        row.streetlight_power_source = draft.streetlight_power_source || null;
        row.streetlight_operational = draft.streetlight_operational || null;
        row.streetlight_count = draft.streetlight_count !== undefined ? Number(draft.streetlight_count) : null;
      }

      return row;
    };

    const toFirestoreDocument = (obj: any) => {
      const fields: any = {};
      for (const [key, val] of Object.entries(obj)) {
        if (val === null || val === undefined) continue;
        if (typeof val === "string") {
          fields[key] = { stringValue: val };
        } else if (typeof val === "number") {
          if (Number.isInteger(val)) {
            fields[key] = { integerValue: val.toString() };
          } else {
            fields[key] = { doubleValue: val };
          }
        } else if (typeof val === "boolean") {
          fields[key] = { booleanValue: val };
        } else if (Array.isArray(val)) {
          fields[key] = {
            arrayValue: {
              values: val.map(item => {
                if (typeof item === "object") {
                  return { stringValue: JSON.stringify(item) };
                }
                return { stringValue: String(item) };
              })
            }
          };
        } else if (typeof val === "object") {
          fields[key] = { stringValue: JSON.stringify(val) };
        }
      }
      return { fields };
    };

    for (let i = 0; i < queuedDrafts.length; i++) {
      const draft = queuedDrafts[i];
      let draftName = "Road Survey";
      if (draft.bridge) draftName = `Bridge: ${draft.bridge}`;
      else if (draft.footbridge_name) draftName = `Footbridge: ${draft.footbridge_name}`;
      else if (draft.culvet_class) draftName = `Culvert: ${String(draft.culvet_class).replace("_", " ")}`;
      else if (draft.shelvets_type) draftName = `Shelvert: ${draft.shelvets_type}`;
      else if (draft.gravel_road_name) draftName = `Gravel Road: ${draft.gravel_road_name}`;
      else if (draft.earth_road_name) draftName = `Earth Road: ${draft.earth_road_name}`;
      else if (draft.causeway_name) draftName = `Piped Causeway: ${draft.causeway_name}`;
      else if (draft.drift_name) draftName = `Drift: ${draft.drift_name}`;
      else if (draft.grid_name) draftName = `Grid: ${draft.grid_name}`;
      else if (draft.tollgate_name) draftName = `Tollgate: ${draft.tollgate_name}`;
      else if (draft.traffic_lights_location) draftName = `Traffic Lights: ${draft.traffic_lights_location}`;
      else if (draft.streetlight_type) draftName = `Streetlight: ${draft.streetlight_type}`;
      else if (draft.rail_crossing_name) draftName = `Rail Crossing: ${draft.rail_crossing_name}`;
      else if (draft.junction_type) draftName = `Junction: ${String(draft.junction_type).replace("_", "-")}`;
      else if (draft.catchpit_condition) draftName = `Catchpit (${draft.catchpit_condition})`;
      else if (draft.traffic_calming_type) draftName = `Traffic Calming: ${String(draft.traffic_calming_type).replace("_", " ")}`;

      setSyncProgress({ current: i + 1, total: queuedDrafts.length, currentName: draftName });

      try {
        const category = draft.asset_category || "sealed";
        const tableName = categoryToTable[category] || "survey_sealed_roads";
        const supabaseRow = mapDraftToSupabaseTable(draft, tableName);

        // 1. Upload directly to Supabase PostgREST API
        const supabaseRes = await fetch(`${SUPABASE_URL}/rest/v1/${tableName}`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "apikey": SUPABASE_ANON_KEY,
            "Authorization": `Bearer ${SUPABASE_ANON_KEY}`
          },
          body: JSON.stringify(supabaseRow)
        });

        if (!supabaseRes.ok) {
          const errText = await supabaseRes.text();
          throw new Error(`Supabase write failed: ${errText}`);
        }

        // 2. Upload directly to Firebase Firestore REST API
        try {
          const firestoreDoc = toFirestoreDocument(supabaseRow);
          const firebaseRes = await fetch(
            `https://firestore.googleapis.com/v1/projects/${FIREBASE_PROJECT}/databases/${FIREBASE_DB}/documents/${tableName}?documentId=${draft.id}`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(firestoreDoc)
            }
          );
          if (!firebaseRes.ok) {
            console.warn(`Firebase sync failed (Status ${firebaseRes.status}):`, await firebaseRes.text());
          }
        } catch (fbErr) {
          console.error("Firebase sync error:", fbErr);
        }

        db.deleteDraft(draft.id);
        successCount++;
      } catch (err: any) {
        console.error("Server sync error:", err);
        showToast(`Sync failed: ${err.message || err}`, "error");
        break; // Stop loop on primary database sync failure
      }
    }

    setDrafts(db.getDrafts());
    setIsSyncing(false);

    if (successCount === queuedDrafts.length) {
      showToast(`Successfully uploaded all ${successCount} road surveys to the server!`, "success");
    } else if (successCount > 0) {
      showToast(`Synced ${successCount} surveys. ${queuedDrafts.length - successCount} drafts failed.`, "error");
    } else {
      showToast("Sync failed. Check internet connection and database status.", "error");
    }
  };

  return (
    <div className="mobile-app-shell">
      {/* Toast Notification */}
      {toast && (
        <div className="mobile-toast">
          {toast.type === "success" && <CheckCircle size={14} color="var(--accent-emerald)" />}
          {toast.type === "error" && <AlertCircle size={14} color="var(--accent-rose)" />}
          {toast.type === "info" && <Info size={14} color="var(--accent-blue)" />}
          <span>{toast.message}</span>
        </div>
      )}

      {/* Header */}
      <header className="mobile-header">
        <div className="mobile-logo-group">
          <img src={assetUrl("coat_of_arms.png")} alt="Zimbabwe Coat of Arms" className="mobile-coat" />
          <div className="mobile-header-title-container">
            <h1 className="mobile-header-title">MOTID COLLECT</h1>
            <span className="mobile-header-subtitle">Field Survey Telemetry</span>
          </div>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: "6px", fontSize: "10px" }}>
          <Activity size={10} color={isOnline ? "var(--accent-emerald)" : "var(--accent-rose)"} />
          <span style={{ color: isOnline ? "var(--accent-emerald)" : "var(--accent-rose)" }}>
            {isOnline ? "ONLINE" : "OFFLINE"}
          </span>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="mobile-content">
        {activeTab === "welcome" ? (
          /* Welcome Tab */
          <div style={{ display: "flex", flexDirection: "column", gap: "20px", padding: "10px 0" }}>
            {/* Logo/Hero Area */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center", padding: "20px 10px", background: "linear-gradient(135deg, var(--bg-sidebar), #002210)", borderRadius: "var(--radius-lg)", border: "1px solid var(--border-color)", color: "#ffffff", boxShadow: "0 4px 15px rgba(0,0,0,0.08)" }}>
              <img 
                src={assetUrl("coat_of_arms.png")} 
                alt="Zimbabwe Coat of Arms" 
                onClick={handleDevClick}
                style={{ height: "70px", marginBottom: "12px", filter: "drop-shadow(0 2px 4px rgba(0,0,0,0.4))", cursor: "pointer" }} 
              />
              <h2 style={{ fontFamily: "var(--font-title)", fontSize: "20px", fontWeight: "800", letterSpacing: "1px", color: "var(--text-accent)" }}>MOTID COLLECT</h2>
              <span style={{ fontSize: "11px", fontWeight: "600", textTransform: "uppercase", opacity: 0.85, marginTop: "4px" }}>Ministry of Transport &amp; Infrastructural Development</span>
              <p style={{ fontSize: "10px", opacity: 0.7, maxWidth: "250px", marginTop: "8px", lineHeight: "1.4" }}>
                Official mobile survey repository for national roads, bridges, and infrastructure telemetry.
              </p>
            </div>

            {/* Quick Actions Panel */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
              <button
                onClick={() => setActiveTab("form")}
                className="mobile-btn"
                style={{ height: "48px", display: "flex", justifyContent: "center", alignItems: "center", gap: "10px", fontSize: "13px", fontWeight: "700" }}
              >
                <Compass size={16} />
                <span>Start New Survey</span>
              </button>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <button
                  onClick={() => setActiveTab("queue")}
                  className="mobile-btn mobile-btn-outline"
                  style={{ height: "40px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontSize: "11px" }}
                >
                  <Database size={14} color="var(--accent-emerald)" />
                  <span>Draft Queue ({drafts.length})</span>
                </button>
                <button
                  onClick={() => setActiveTab("settings")}
                  className="mobile-btn mobile-btn-outline"
                  style={{ height: "40px", display: "flex", justifyContent: "center", alignItems: "center", gap: "8px", fontSize: "11px" }}
                >
                  <SettingsIcon size={14} color="var(--accent-emerald)" />
                  <span>System Settings</span>
                </button>
              </div>
            </div>

            {/* Status & Surveyor Info */}
            <div style={{ display: "flex", flexDirection: "column", gap: "10px", background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <User size={14} color="var(--accent-emerald)" />
                <span style={{ fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-accent)" }}>Surveyor Information</span>
              </div>
              
              <div style={{ display: "flex", flexDirection: "column", gap: "8px", fontSize: "12px" }}>
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Current Profile:</span>
                  <span style={{ fontWeight: 600, color: defaultSurveyor ? "var(--text-primary)" : "var(--accent-rose)" }}>
                    {defaultSurveyor || "Profile Not Configured"}
                  </span>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between" }}>
                  <span style={{ color: "var(--text-muted)" }}>Network State:</span>
                  <span style={{ fontWeight: 600, color: isOnline ? "var(--accent-emerald)" : "var(--accent-rose)", display: "flex", alignItems: "center", gap: "4px" }}>
                    <span style={{ display: "inline-block", width: "6px", height: "6px", borderRadius: "50%", background: isOnline ? "var(--accent-emerald)" : "var(--accent-rose)" }}></span>
                    {isOnline ? "Online (Connected)" : "Offline (Local Queue)"}
                  </span>
                </div>
              </div>
            </div>

            {/* Instruction Tips */}
            <div style={{ display: "flex", gap: "10px", background: "rgba(0, 102, 51, 0.04)", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-md)", padding: "12px", fontSize: "11px", color: "var(--text-primary)", lineHeight: "1.4" }}>
              <Info size={16} color="var(--accent-emerald)" style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong style={{ display: "block", marginBottom: "4px", color: "var(--accent-emerald)" }}>Field Operation Guide</strong>
                When performing road condition surveys, make sure to keep your device's GPS accuracy under 3m. Points are automatically collected in high-precision mode. Ensure drafts are fully completed before triggering upload sync.
              </div>
            </div>
          </div>
        ) : activeTab === "form" ? (
          selectedCategory === null ? (
            /* Asset Category Selection Page */
            <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                <h2 style={{ fontSize: "16px", fontWeight: "800", color: "var(--accent-emerald)", fontFamily: "var(--font-title)" }}>Select Asset to Survey</h2>
                <span style={{ fontSize: "11px", color: "var(--text-muted)" }}>Choose from the road and structures inventory classes below</span>
              </div>

              {pausedRoadContext && (
                <div
                  style={{
                    background: "rgba(180,83,9,0.08)",
                    border: "1.5px solid #b45309",
                    borderRadius: "var(--radius-md)",
                    padding: "12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: "10px",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "flex-start", gap: "10px" }}>
                    <Pause size={18} color="#b45309" style={{ marginTop: 2, flexShrink: 0 }} />
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "12px", fontWeight: 800, color: "#b45309" }}>
                        Line survey paused
                      </div>
                      <div style={{ fontSize: "10px", color: "var(--text-secondary)", marginTop: 3, lineHeight: 1.45 }}>
                        {ASSET_CLASSES.find((a) => a.id === pausedRoadContext.roadCategory)?.label || "Road"}
                        {pausedRoadContext.roadName ? ` · ${pausedRoadContext.roadName}` : ""}
                        {" · "}
                        {pausedRoadContext.pointCount} GPS pts
                        {pausedRoadContext.length_m ? ` · ${pausedRoadContext.length_m} m` : ""}
                        . Collect a point asset below, then resume the same line.
                      </div>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={resumePausedRoadSurvey}
                      className="mobile-btn"
                      style={{ flex: 1, height: "38px", fontSize: "11px", gap: "6px" }}
                    >
                      <Play size={14} />
                      Resume Line
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm("Discard the paused line segment? GPS points will be lost.")) {
                          discardPausedRoadSession();
                          showToast("Paused line discarded.", "info");
                        }
                      }}
                      className="mobile-btn mobile-btn-outline"
                      style={{ height: "38px", fontSize: "11px", color: "#dc2626", borderColor: "#dc2626" }}
                    >
                      Discard
                    </button>
                  </div>
                </div>
              )}
              
              {/* Category Filters Badges */}
              <div style={{
                display: "flex",
                gap: "8px",
                overflowX: "auto",
                padding: "4px 2px",
                scrollbarWidth: "none",
                msOverflowStyle: "none",
              }} className="no-scrollbar">
                <style>{`
                  .no-scrollbar::-webkit-scrollbar { display: none; }
                  .asset-card {
                    -webkit-tap-highlight-color: transparent;
                  }
                  .asset-card:hover {
                    transform: translateY(-2px);
                    border-color: var(--accent-emerald) !important;
                    box-shadow: 0 6px 16px rgba(0, 77, 38, 0.08) !important;
                  }
                  .asset-card:active {
                    transform: scale(0.98);
                  }
                `}</style>
                {[
                  { id: "all", label: "All Assets", count: 20 },
                  { id: "roads", label: "Roads", count: 3 },
                  { id: "structures", label: "Structures", count: 4 },
                  { id: "drainage", label: "Drainage", count: 5 },
                  { id: "traffic", label: "Traffic", count: 4 },
                  { id: "amenities", label: "Amenities", count: 5 }
                ].map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    onClick={() => setFilterCategory(cat.id)}
                    style={{
                      padding: "8px 14px",
                      fontSize: "11px",
                      fontWeight: "700",
                      borderRadius: "20px",
                      border: "1px solid",
                      borderColor: filterCategory === cat.id ? "var(--accent-emerald)" : "var(--border-color)",
                      background: filterCategory === cat.id ? "var(--accent-emerald)" : "var(--bg-card)",
                      color: filterCategory === cat.id ? "#ffffff" : "var(--text-muted)",
                      cursor: "pointer",
                      whiteSpace: "nowrap",
                      transition: "all 0.2s ease"
                    }}
                  >
                    {cat.label} ({cat.count})
                  </button>
                ))}
              </div>

              {/* Grid of Asset Cards */}
              <div style={{
                display: "grid",
                gridTemplateColumns: "1fr",
                gap: "10px",
                overflowY: "auto",
                maxHeight: "calc(100vh - 210px)",
                paddingBottom: "30px",
                paddingTop: "2px"
              }}>
                {ASSET_CLASSES
                  .filter((asset) => filterCategory === "all" || asset.category === filterCategory)
                  .map((asset) => (
                    <button
                      key={asset.id}
                      type="button"
                      onClick={() => {
                        const isRoadAsset = asset.id === "sealed" || asset.id === "gravel" || asset.id === "earth";
                        if (pausedRoadContext && isRoadAsset) {
                          resumePausedRoadSurvey();
                          return;
                        }
                        setSelectedCategory(asset.id);
                        setAssetCategory(asset.id as any);
                        // Always clear GPS when starting any new asset so point surveys
                        // cannot inherit the previous capture
                        setSegmentGeometry(null);
                        setGps("");
                        setPhotos([]);
                        setEditingDraftId(null);
                        liveGpsPosRef.current = null;
                        bestGpsPosRef.current = null;
                        setLiveGpsAccuracy(null);
                        setBestGpsAccuracy(null);
                        if (pausedRoadContext) {
                          // Mid-line point collect: keep route metadata only
                          setRoadName(pausedRoadContext.roadName || roadName);
                          setSectionName(pausedRoadContext.sectionName || sectionName);
                          setSurveyorName(pausedRoadContext.surveyorName || surveyorName || defaultSurveyor);
                          setSurveyDate(pausedRoadContext.surveyDate || surveyDate);
                        }
                      }}
                      className="asset-card"
                      style={{
                        background: "var(--bg-card)",
                        border: "1px solid var(--border-color)",
                        borderRadius: "var(--radius-md)",
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        gap: "14px",
                        cursor: "pointer",
                        textAlign: "left",
                        transition: "all 0.25s ease",
                        boxShadow: "0 2px 4px rgba(0,0,0,0.01)",
                        outline: "none",
                        width: "100%"
                      }}
                    >
                      {/* Icon Container with beautiful gradient background */}
                      <div style={{
                        width: "44px",
                        height: "44px",
                        borderRadius: "12px",
                        background: asset.grad || "linear-gradient(135deg, var(--accent-emerald), #002210)",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#ffffff",
                        flexShrink: 0,
                        boxShadow: "0 4px 10px rgba(0, 0, 0, 0.05)"
                      }}>
                        {asset.icon}
                      </div>

                      {/* Details */}
                      <div style={{ flex: 1 }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: "13px", fontWeight: "800", color: "var(--text-primary)" }}>{asset.label}</span>
                          <span style={{
                            fontSize: "8px",
                            fontWeight: "800",
                            textTransform: "uppercase",
                            padding: "2px 6px",
                            borderRadius: "10px",
                            background: "rgba(0,102,51,0.06)",
                            color: "var(--accent-emerald)"
                          }}>
                            {asset.type}
                          </span>
                        </div>
                        <p style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: "4px", lineHeight: "1.4" }}>
                          {asset.desc}
                        </p>
                      </div>
                    </button>
                  ))}
              </div>
            </div>
          ) : (
            <form className="mobile-form" onSubmit={(e) => handleSaveForm(e, false)}>
              {/* Back to assets button at top */}
              <div style={{ display: "flex", alignItems: "center", gap: "10px", marginBottom: "12px", borderBottom: "1px solid var(--border-color)", paddingBottom: "10px" }}>
                <button
                  type="button"
                  onClick={() => {
                    // Soft exit while a line is paused — keep GPS session for later resume
                    if (pausedRoadContext) {
                      setSelectedCategory(null);
                      showToast("Paused line kept. Collect a point asset or resume the road.", "info");
                      return;
                    }
                    // If actively tracking (session exists), auto-pause so points are not lost
                    let hasActiveSession = false;
                    try {
                      const raw = localStorage.getItem(SEGMENT_SESSION_KEY);
                      if (raw) {
                        const sess = JSON.parse(raw);
                        hasActiveSession = Array.isArray(sess.points) && sess.points.length > 0;
                      }
                    } catch (_) { /* ignore */ }
                    if (hasActiveSession && isRoadType && !segmentGeometry) {
                      persistPausedRoadContext({
                        roadCategory: assetCategory as RoadCategory,
                        roadName,
                        sectionName,
                        surveyorName,
                        surveyDate,
                        pointCount: (() => {
                          try {
                            const sess = JSON.parse(localStorage.getItem(SEGMENT_SESSION_KEY) || "{}");
                            return sess.points?.length || 0;
                          } catch { return 0; }
                        })(),
                        length_m: 0,
                      });
                      // Mark session as paused so remount does not auto-reconnect GPS
                      try {
                        const raw = localStorage.getItem(SEGMENT_SESSION_KEY);
                        if (raw) {
                          const sess = JSON.parse(raw);
                          sess.phase = "paused";
                          sess.savedAt = Date.now();
                          localStorage.setItem(SEGMENT_SESSION_KEY, JSON.stringify(sess));
                        }
                      } catch (_) { /* ignore */ }
                      setSelectedCategory(null);
                      setSegmentGeometry(null);
                      showToast("Line auto-paused. Collect a point or tap Resume Line.", "info");
                      return;
                    }
                    setSelectedCategory(null);
                    clearForm();
                  }}
                  style={{
                    background: "transparent", border: "1px solid var(--border-color)", borderRadius: "var(--radius-sm)",
                    padding: "4px 8px", fontSize: "10px", fontWeight: 600, color: "var(--text-muted)", cursor: "pointer",
                    display: "flex", alignItems: "center", gap: "4px"
                  }}
                >
                  ← Back to Selection
                </button>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", flex: 1 }}>
                  <span style={{ fontSize: "12px", fontWeight: 800, color: "var(--accent-emerald)", textTransform: "uppercase" }}>
                    {ASSET_CLASSES.find(a => a.id === assetCategory)?.label || assetCategory}
                  </span>
                  {editingDraftId && (
                    <span style={{
                      fontSize: "9px",
                      fontWeight: "700",
                      background: "var(--accent-rose)",
                      color: "#ffffff",
                      padding: "2px 8px",
                      borderRadius: "10px",
                      display: "flex",
                      alignItems: "center",
                      gap: "4px"
                    }}>
                      ⚠️ EDIT MODE
                    </span>
                  )}
                  {/* Auto-saved status chip */}
                  {autoSaveStatus === "saving" && (
                    <span style={{
                      fontSize: "9px", fontWeight: 600,
                      color: "var(--text-muted)", display: "flex", alignItems: "center", gap: "3px"
                    }}>
                      <span style={{ width: "6px", height: "6px", borderRadius: "50%", background: "#f59e0b", display: "inline-block", animation: "pulse 1s infinite" }} />
                      Saving…
                    </span>
                  )}
                  {autoSaveStatus === "saved" && (
                    <span style={{
                      fontSize: "9px", fontWeight: 600,
                      color: "var(--accent-emerald)", display: "flex", alignItems: "center", gap: "3px"
                    }}>
                      ✓ Auto-saved
                    </span>
                  )}
                </div>
              </div>

              {/* Recovery Banner — shown when a temp draft was found from a previous interrupted session */}
              {showRecoveryBanner && (
                <div style={{
                  background: "rgba(245, 158, 11, 0.08)",
                  border: "1px solid rgba(245, 158, 11, 0.4)",
                  borderRadius: "var(--radius-md)",
                  padding: "10px 12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  marginBottom: "4px",
                }}>
                  <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                    <span style={{ fontSize: "16px" }}>⚠️</span>
                    <div>
                      <p style={{ fontSize: "12px", fontWeight: 700, color: "#d97706", margin: 0 }}>
                        Unsaved Survey Found
                      </p>
                      <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0" }}>
                        A previous survey was interrupted. Do you want to resume it?
                      </p>
                    </div>
                  </div>
                  <div style={{ display: "flex", gap: "8px" }}>
                    <button
                      type="button"
                      onClick={loadTempDraft}
                      className="mobile-btn"
                      style={{ flex: 1, height: "34px", fontSize: "11px", background: "#d97706", borderColor: "#d97706" }}
                    >
                      ↩ Resume Survey
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        localStorage.removeItem("roads_temp_draft");
                        setHasTempDraft(false);
                        setShowRecoveryBanner(false);
                      }}
                      className="mobile-btn mobile-btn-outline"
                      style={{ flex: 1, height: "34px", fontSize: "11px", borderColor: "var(--accent-rose)", color: "var(--accent-rose)" }}
                    >
                      🗑 Discard
                    </button>
                  </div>
                </div>
              )}

            {/* Core Metadata */}
            <div className="mobile-form-group">
              <label className="mobile-label">Highway Route</label>
              <AutocompleteInput
                placeholder="e.g. A4 Highway (Harare - Masvingo - Beitbridge)"
                value={roadName}
                onChange={setRoadName}
                suggestions={highwaySuggestions(drafts)}
                required
              />
            </div>

            <div className="mobile-form-group">
              <label className="mobile-label">Section Name</label>
              <AutocompleteInput
                placeholder="e.g. Marondera - Rusape Section"
                value={sectionName}
                onChange={setSectionName}
                suggestions={sectionSuggestions(drafts)}
                required
              />
            </div>

            {isRoadType && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                <div className="mobile-form-group">
                  <label className="mobile-label">Chainage from (km)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={chainageFrom}
                    onChange={(e) => setChainageFrom(e.target.value)}
                    className="mobile-input"
                  />
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label">Chainage to (km)</label>
                  <input
                    type="number"
                    step="any"
                    placeholder="Optional"
                    value={chainageTo}
                    onChange={(e) => setChainageTo(e.target.value)}
                    className="mobile-input"
                  />
                </div>
              </div>
            )}

            <div className="mobile-form-group">
              <label className="mobile-label">Surveyor Name</label>
              <AutocompleteInput
                placeholder="e.g. Eng. Rondozai"
                value={surveyorName}
                onChange={setSurveyorName}
                suggestions={surveyorSuggestions(drafts)}
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: isRoadType ? "1fr" : "1fr 1fr", gap: "10px" }}>
              {/* For road types, vegetation moves below the completed segment */}
              {!isRoadType && (
                <div className="mobile-form-group">
                  <label className="mobile-label">Vegetation Status</label>
                  <select value={vegetation} onChange={(e) => setVegetation(e.target.value)} className="mobile-select" required>
                    <option value="none">None</option>
                    <option value="light">Light</option>
                    <option value="medium">Medium</option>
                    <option value="dense">Dense</option>
                  </select>
                </div>
              )}
              <div className="mobile-form-group">
                <label className="mobile-label">SADC Sign Compliant</label>
                <select
                  value={imageSadcCompliant}
                  onChange={(e) => setImageSadcCompliant(e.target.value as "yes" | "no" | "mixed")}
                  className="mobile-select"
                >
                  <option value="yes">Yes (Compliant)</option>
                  <option value="no">No (Non-Compliant)</option>
                  <option value="mixed">Mixed</option>
                </select>
              </div>
            </div>

            {/* Geolocation Input — hidden for road types (GPS is captured via segment tracker) */}
            {!isRoadType && (() => {
              const displayAcc = liveGpsAccuracy ?? bestGpsAccuracy;
              const unlockAcc = bestGpsAccuracy ?? liveGpsAccuracy;
              const pointAccColour =
                displayAcc == null ? "#6b7280"
                  : (unlockAcc != null && unlockAcc <= gpsAccuracyLimit) ? "#22c55e"
                  : "#ef4444";
              const pointAccLabel =
                displayAcc == null ? "Acquiring GPS — stand outdoors, clear sky…"
                  : (unlockAcc != null && unlockAcc <= gpsAccuracyLimit)
                    ? `±${unlockAcc.toFixed(1)} m — Excellent 🟢`
                    : `±${displayAcc.toFixed(1)} m — Improving… (need ≤${gpsAccuracyLimit.toFixed(1)}m)${bestGpsAccuracy != null && bestGpsAccuracy < displayAcc ? ` · best ±${bestGpsAccuracy.toFixed(1)}m` : ""}`;
              const gpsReady = unlockAcc != null && unlockAcc <= gpsAccuracyLimit;

              return (
              <div className="mobile-form-group">
                <label className="mobile-label">GPS Geolocation</label>

                {/* Live accuracy meter — same behaviour as linear segment tracker */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                    background: "var(--bg-card)",
                    border: `2px solid ${pointAccColour}`,
                    borderRadius: "var(--radius-md)",
                    padding: "8px 12px",
                    marginBottom: "8px",
                    transition: "border-color 0.4s",
                  }}
                >
                  <Gauge size={15} color={pointAccColour} />
                  <span style={{ fontSize: "11px", fontWeight: 700, color: pointAccColour }}>
                    {pointAccLabel}
                  </span>
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder={gpsReady ? "Ready — tap capture" : `Waiting for ≤${gpsAccuracyLimit.toFixed(1)} m accuracy…`}
                    value={gps}
                    readOnly
                    className="mobile-input"
                    style={{ background: "var(--accent-emerald)", color: "#ffffff", fontWeight: "600", border: "none" }}
                  />
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isCapturingGps || !gpsReady}
                    className="mobile-btn"
                    style={{
                      width: "42px",
                      height: "38px",
                      padding: 0,
                      opacity: isCapturingGps || !gpsReady ? 0.45 : 1,
                    }}
                    title={gpsReady ? "Capture GPS" : `Wait until accuracy ≤ ${gpsAccuracyLimit.toFixed(1)} m`}
                  >
                    {isCapturingGps ? (
                      <div className="spinner"></div>
                    ) : (
                      <Compass size={16} />
                    )}
                  </button>
                </div>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  🛰 Live GPS accuracy shown above — capture unlocks at ≤ {gpsAccuracyLimit.toFixed(1)} m (Excellent)
                </span>
                {!Capacitor.isNativePlatform() && liveGpsAccuracy == null && (
                  <button
                    type="button"
                    onClick={() => {
                      const lat = -17.8292;
                      const lng = 31.0522;
                      const alt = 1480;
                      const acc = 2.4;
                      setLiveGpsAccuracy(acc);
                      liveGpsPosRef.current = { lat, lng, alt, acc };
                      showToast("Simulated live GPS: ±2.4 m — Excellent. Tap capture.", "info");
                    }}
                    style={{
                      marginTop: "8px",
                      width: "100%",
                      padding: "8px",
                      fontSize: "10px",
                      fontWeight: 700,
                      borderRadius: "var(--radius-sm)",
                      border: "1px dashed var(--border-color)",
                      background: "var(--bg-app)",
                      color: "var(--text-muted)",
                      cursor: "pointer",
                    }}
                  >
                    Browser testing: simulate Excellent GPS (≤3 m)
                  </button>
                )}
              </div>
              );
            })()}

            {/* Multi-photo capture — native Camera on APK; multiple for linear surveys */}
            <PhotoCapture
              photos={photos}
              onChange={setPhotos}
              maxPhotos={isRoadType ? MAX_ROAD_PHOTOS : MAX_POINT_PHOTOS}
              label={isRoadType ? "Road Photos (Optional)" : "Photos (Optional)"}
              hint={
                isRoadType
                  ? `Take photos along the segment while recording (up to ${MAX_ROAD_PHOTOS}). You can also use Snap Road Photo on the tracker below.`
                  : `Use the camera for a clear photo of the asset (up to ${MAX_POINT_PHOTOS} photos).`
              }
            />

            {/* GPS Segment Tracker — Sealed / Gravel / Earth roads only */}
            {isRoadType && (
              <SegmentTracker
                roadLabel={
                  assetCategory === "sealed" ? "Sealed Road"
                  : assetCategory === "gravel" ? "Gravel Road"
                  : "Earth Road"
                }
                maxSegmentLengthM={segmentMaxLengthM(
                  assetCategory === "sealed" ? sealedClass
                  : assetCategory === "gravel" ? gravelClass : earthClass
                )}
                segmentLimitHint={fmtSegmentLimitHint(
                  assetCategory === "sealed" ? sealedClass
                  : assetCategory === "gravel" ? gravelClass : earthClass
                )}
                onSegmentComplete={(geo) => {
                  setSegmentGeometry(geo);
                  persistPausedRoadContext(null);
                  clearPausedRoadPhotos();
                  setAutoResumeSegment(false);
                }}
                onReset={() => {
                  setSegmentGeometry(null);
                  discardPausedRoadSession();
                }}
                existingGeometry={segmentGeometry}
                accuracyThreshold={gpsAccuracyLimit}
                autoResume={autoResumeSegment}
                photoCount={photos.length}
                maxPhotos={MAX_ROAD_PHOTOS}
                onAddPhoto={async () => {
                  if (photos.length >= MAX_ROAD_PHOTOS) {
                    showToast(`Maximum ${MAX_ROAD_PHOTOS} photos reached.`, "info");
                    return;
                  }
                  try {
                    const dataUrl = await capturePhotoNativeOrNull();
                    if (dataUrl) {
                      setPhotos((prev) => {
                        const next = [...prev, dataUrl].slice(0, MAX_ROAD_PHOTOS);
                        showToast(`Photo ${next.length} saved`, "success");
                        return next;
                      });
                    } else {
                      showToast("Camera unavailable — check camera permission.", "info");
                    }
                  } catch (e: unknown) {
                    const msg = (e as Error)?.message || "";
                    if (!/cancel|dismiss|User cancelled/i.test(msg)) {
                      showToast("Camera failed — try again.", "error");
                    }
                  }
                }}
                onSessionCleared={() => {
                  persistPausedRoadContext(null);
                  clearPausedRoadPhotos();
                  setAutoResumeSegment(false);
                }}
                onSegmentPaused={(info) => {
                  setAutoResumeSegment(false);
                  savePausedRoadPhotos(photos);
                  persistPausedRoadContext({
                    roadCategory: assetCategory as RoadCategory,
                    roadName,
                    sectionName,
                    surveyorName,
                    surveyDate,
                    pointCount: info.pointCount,
                    length_m: info.length_m,
                  });
                }}
                onCollectPointAlongRoute={() => {
                  setAutoResumeSegment(false);
                  savePausedRoadPhotos(photos);
                  setSelectedCategory(null);
                  setGps("");
                  setPhotos([]);
                  setSegmentGeometry(null);
                  setEditingDraftId(null);
                  showToast("Line paused. Pick a point asset (bus stop, bridge…), then resume the same line.", "info");
                }}
              />
            )}

            {/* Divider + label after segment completion */}
            {isRoadType && segmentGeometry && (
              <div style={{ display: "flex", alignItems: "center", gap: "10px", margin: "4px 0" }}>
                <div style={{ flex: 1, height: "1px", background: "var(--border-color)" }} />
                <span style={{ fontSize: "10px", color: "var(--text-accent)", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
                  Road Attributes
                </span>
                <div style={{ flex: 1, height: "1px", background: "var(--border-color)" }} />
              </div>
            )}

            {/* Vegetation after segment — road surveys only */}
            {isRoadType && segmentGeometry && (
              <div className="mobile-form-group">
                <label className="mobile-label">Vegetation Status</label>
                <select value={vegetation} onChange={(e) => setVegetation(e.target.value)} className="mobile-select" required>
                  <option value="none">None</option>
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="dense">Dense</option>
                </select>
              </div>
            )}

            {/* Lock message when road type chosen but no segment yet */}
            {isRoadType && !segmentGeometry && (
              <div style={{ textAlign: "center", padding: "14px 10px", color: "var(--text-muted)", fontSize: "11px", background: "var(--bg-card)", border: "1px dashed var(--border-color)", borderRadius: "var(--radius-md)" }}>
                🔒 Complete the GPS segment recording above to unlock road attributes
              </div>
            )}

            {/* Conditional Form: Bridge */}
            {assetCategory === "bridge" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Bridge structural grades</legend>
                
                <div className="mobile-form-group">
                  <label className="mobile-label">Bridge Structure Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Tokwe River Bridge"
                    value={bridgeName}
                    onChange={(e) => setBridgeName(e.target.value)}
                    className="mobile-input"
                    required={assetCategory === "bridge"}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Structure Type</label>
                    <select value={bridgeStructureType} onChange={(e) => setBridgeStructureType(e.target.value)} className="mobile-select">
                      <option value="beam">Beam</option>
                      <option value="arch">Arch</option>
                      <option value="slab">Slab</option>
                      <option value="truss">Truss</option>
                      <option value="cantilever">Cantilever</option>
                      <option value="suspension">Suspension</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Crossing Type</label>
                    <select value={bridgeCrossing} onChange={(e) => setBridgeCrossing(e.target.value)} className="mobile-select">
                      <option value="stream">Stream</option>
                      <option value="river">River</option>
                      <option value="road">Road flyover</option>
                      <option value="rail">Railway flyover</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Deck Type</label>
                    <select value={bridgeType} onChange={(e) => setBridgeType(e.target.value)} className="mobile-select">
                      <option value="hldc">HLDC Deck</option>
                      <option value="sldc">SLDC Deck</option>
                      <option value="slc">SLC Deck</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Length (m)</label>
                    <input type="number" step="any" placeholder="e.g. 45" value={bridgeLength} onChange={(e) => setBridgeLength(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Width (m)</label>
                    <input type="number" step="any" placeholder="e.g. 7.2" value={bridgeWidth} onChange={(e) => setBridgeWidth(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Spans</label>
                    <input type="number" min="1" placeholder="e.g. 3" value={bridgeSpans} onChange={(e) => setBridgeSpans(e.target.value)} className="mobile-input" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Bearing type</label>
                    <select value={bridgeBearing} onChange={(e) => setBridgeBearing(e.target.value)} className="mobile-select">
                      <option value="elastometric">Elastometric</option>
                      <option value="sliding">Sliding</option>
                      <option value="roller">Roller</option>
                      <option value="rocker and pin">Rocker and pin</option>
                      <option value="disk">Disk</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Bearing condition</label>
                    <select value={bearingsState} onChange={(e) => setBearingsState(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Expansion Joints</label>
                    <select value={bridgeJoints} onChange={(e) => setBridgeJoints(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Parapet damage</label>
                    <select value={parapet} onChange={(e) => setParapet(e.target.value)} className="mobile-select">
                      <option value="undamaged">Undamaged</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Concrete Chemical reaction</label>
                    <select value={chemicalEffect} onChange={(e) => setChemicalEffect(e.target.value)} className="mobile-select">
                      <option value="none">None</option>
                      <option value="mild">Mild</option>
                      <option value="severe">Severe</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Joint Vegetation growth</label>
                    <select value={vegetationGrowth} onChange={(e) => setVegetationGrowth(e.target.value)} className="mobile-select">
                      <option value="no">No growth</option>
                      <option value="yes">Yes (Invasive)</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Approach condition</label>
                    <select value={bridgeApproachCondition} onChange={(e) => setBridgeApproachCondition(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Signage</label>
                    <select value={bridgeSignage} onChange={(e) => setBridgeSignage(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="partial">Partial</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage status</label>
                    <select value={drainage} onChange={(e) => setDrainage(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="clogged">Clogged</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Overall Bridge Grade</label>
                    <select value={bridgeCondition} onChange={(e) => setBridgeCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Culvert */}
            {assetCategory === "culvert" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Culvert properties</legend>
                
                <div className="mobile-form-group">
                  <label className="mobile-label">Culvert Type</label>
                  <select value={culvertClass} onChange={(e) => setCulvertClass(e.target.value)} className="mobile-select">
                    <option value="box_culvert">Box Culvert</option>
                    <option value="pipe_culvert">Pipe Culvert</option>
                  </select>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-label">Material</label>
                  <SelectWithOther
                    value={culvertType}
                    onChange={setCulvertType}
                    options={[
                      { value: "concrete", label: "Concrete" },
                      { value: "steel", label: "Steel" },
                      { value: "masonry", label: "Masonry" },
                      { value: "corrugated_metal", label: "Corrugated Metal" },
                    ]}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Size (m²)</label>
                    <input type="number" step="any" placeholder="e.g. 2.5" value={culvertSizeM2} onChange={(e) => setCulvertSizeM2(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Number of openings</label>
                    <input type="number" min="1" placeholder="e.g. 2" value={culvertOpenings} onChange={(e) => setCulvertOpenings(e.target.value)} className="mobile-input" />
                  </div>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-label">Serviceability state</label>
                  <select value={culvertServiceability} onChange={(e) => setCulvertServiceability(e.target.value)} className="mobile-select">
                    <option value="good">Good (Operational)</option>
                    <option value="partially_blocked">Partially Blocked</option>
                    <option value="fully_blocked">Fully Blocked</option>
                    <option value="damaged">Damaged structural walls</option>
                  </select>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Shelvet */}
            {assetCategory === "shelvet" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Shelvert properties</legend>
                
                <div className="mobile-form-group">
                  <label className="mobile-label">Shelvert material/type</label>
                  <SelectWithOther
                    value={shelvetType}
                    onChange={setShelvetType}
                    options={[
                      { value: "armco", label: "Armco steel pipe" },
                      { value: "shelvets", label: "Masonry shelverts" },
                      { value: "concrete", label: "Concrete shelverts" },
                    ]}
                  />
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-label">Serviceability</label>
                  <select value={shelvetServiceability} onChange={(e) => setShelvetServiceability(e.target.value)} className="mobile-select">
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="blocked">Blocked</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Size (m²)</label>
                    <input type="number" step="any" placeholder="e.g. 1.5" value={shelvetSizeM2} onChange={(e) => setShelvetSizeM2(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Number of openings</label>
                    <input type="number" min="1" placeholder="e.g. 1" value={shelvetOpenings} onChange={(e) => setShelvetOpenings(e.target.value)} className="mobile-input" />
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Sealed Road */}
            {assetCategory === "sealed" && segmentGeometry && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Sealed Road Properties</legend>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Class</label>
                    <select value={sealedClass} onChange={(e) => setSealedClass(e.target.value)} className="mobile-select">
                      {SEALED_ROAD_CLASS_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Type</label>
                    <select value={sealedType} onChange={(e) => setSealedType(e.target.value)} className="mobile-select">
                      {SEALED_ROAD_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Surface Type</label>
                    <select value={sealedSurfaceType} onChange={(e) => setSealedSurfaceType(e.target.value)} className="mobile-select">
                      {SURFACE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Pothole Density</label>
                    <select value={sealedPotholeDensity} onChange={(e) => setSealedPotholeDensity(e.target.value)} className="mobile-select">
                      {POTHOLE_DENSITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Climate Region</label>
                    <select value={sealedClimate} onChange={(e) => setSealedClimate(e.target.value)} className="mobile-select">
                      <option value="dry">Dry</option>
                      <option value="moderate">Moderate</option>
                      <option value="wet">Wet</option>
                      <option value="very_wet">Very Wet</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Terrain Type</label>
                    <select value={sealedTerrain} onChange={(e) => setSealedTerrain(e.target.value)} className="mobile-select">
                      <option value="flat">Flat</option>
                      <option value="undulating">Undulating</option>
                      <option value="mountainous">Mountainous</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Authority Name</label>
                    <SelectWithOther value={sealedAuthority} onChange={setSealedAuthority} options={AUTHORITY_OPTIONS} />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Cycle Track</label>
                    <select value={sealedCycleTrack} onChange={(e) => setSealedCycleTrack(e.target.value)} className="mobile-select">
                      {YES_NO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Length (km)</label>
                    <input type="number" step="any" placeholder="e.g. 15.5" value={sealedLength} onChange={(e) => setSealedLength(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Width (m)</label>
                    <input type="number" step="any" placeholder="e.g. 7.2" value={sealedWidth} onChange={(e) => setSealedWidth(e.target.value)} className="mobile-input" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Lanes per Carriage</label>
                    <input type="number" min="1" placeholder="e.g. 2" value={sealedLanesPerCarriage} onChange={(e) => setSealedLanesPerCarriage(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Shoulder Width (m)</label>
                    <input type="number" step="any" placeholder="e.g. 1.5" value={sealedShoulderWidth} onChange={(e) => setSealedShoulderWidth(e.target.value)} className="mobile-input" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Median Type</label>
                    <select value={sealedMedianType} onChange={(e) => setSealedMedianType(e.target.value)} className="mobile-select">
                      {MEDIAN_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Servitude Vegetation</label>
                    <select value={sealedVegetation} onChange={(e) => setSealedVegetation(e.target.value)} className="mobile-select">
                      <option value="none">None</option>
                      <option value="light">Light</option>
                      <option value="medium">Medium</option>
                      <option value="dense">Dense</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Survey Side</label>
                    <select value={sealedSurveySide} onChange={(e) => setSealedSurveySide(e.target.value)} className="mobile-select">
                      {SURVEY_SIDE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Survey Direction</label>
                    <input type="text" placeholder="e.g. Northbound" value={sealedSurveyDirection} onChange={(e) => setSealedSurveyDirection(e.target.value)} className="mobile-input" />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage</label>
                    <select value={sealedDrainage} onChange={(e) => setSealedDrainage(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                      <option value="eroded">Eroded</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage Type</label>
                    <select value={sealedDrainageType} onChange={(e) => setSealedDrainageType(e.target.value)} className="mobile-select">
                      {DRAINAGE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-label">Drainage Lining</label>
                  <select value={sealedDrainageLining} onChange={(e) => setSealedDrainageLining(e.target.value)} className="mobile-select">
                    {DRAINAGE_LINING_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                {!isDualCarriageway(sealedType) && (
                  <>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="mobile-form-group">
                        <label className="mobile-label">Narrow Cracks</label>
                        <select value={sealedNarrowCracks} onChange={(e) => setSealedNarrowCracks(e.target.value)} className="mobile-select">
                          <option value="no_cracks">No cracks</option>
                          <option value="faint_cracks">Faint cracks</option>
                          <option value="distinct_cracks_up_to_1mm">Distinct cracks up to 1mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                      <div className="mobile-form-group">
                        <label className="mobile-label">Wide Cracks</label>
                        <select value={sealedWideCracks} onChange={(e) => setSealedWideCracks(e.target.value)} className="mobile-select">
                          <option value="no_cracks">No cracks</option>
                          <option value="cracks_3_5mm">Cracks 3-5mm</option>
                          <option value="cracks_5_10mm">Cracks 5-10mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="mobile-form-group">
                        <label className="mobile-label">Pothole / Patches</label>
                        <SelectWithOther value={sealedPotholesPatches} onChange={setSealedPotholesPatches} options={POTHOLE_PATCHES_OPTIONS} includeOther={false} />
                      </div>
                      <div className="mobile-form-group">
                        <label className="mobile-label">Rutting Degree</label>
                        <select value={sealedRutting} onChange={(e) => setSealedRutting(e.target.value)} className="mobile-select">
                          <option value="no_rutting__5mm">No rutting &lt;5mm</option>
                          <option value="discernible_5_15mm">Discernible 5-15mm</option>
                          <option value="large_15_25mm">Large 15-25mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="mobile-form-group">
                        <label className="mobile-label">Edge Breaks</label>
                        <select value={sealedEdgeBreaks} onChange={(e) => setSealedEdgeBreaks(e.target.value)} className="mobile-select">
                          <option value="no_edge_break">No edge break</option>
                          <option value="up_to_50mm">Up to 50mm</option>
                          <option value="50_100mm_break">50-100mm break</option>
                          <option value="__100mm">&gt; 100mm</option>
                        </select>
                      </div>
                      <div className="mobile-form-group">
                        <label className="mobile-label">Edge Drop</label>
                        <select value={sealedEdgeDrop} onChange={(e) => setSealedEdgeDrop(e.target.value)} className="mobile-select">
                          <option value="no_edge_break">No edge drop</option>
                          <option value="up_to_50mm">Up to 50mm</option>
                          <option value="50_100mm_break">50-100mm drop</option>
                          <option value="__100mm">&gt; 100mm</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                      <div className="mobile-form-group">
                        <label className="mobile-label">Ravelling Degree</label>
                        <select value={sealedRavelling} onChange={(e) => setSealedRavelling(e.target.value)} className="mobile-select">
                          <option value="none">None</option>
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                        </select>
                      </div>
                      <div className="mobile-form-group">
                        <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Riding Quality</label>
                        <SelectWithOther value={sealedRidingQuality} onChange={setSealedRidingQuality} options={CONDITION_GFPM_CONSTRUCTION} includeOther={false} style={{ borderColor: "var(--accent-emerald)" }} />
                      </div>
                    </div>
                  </>
                )}

                {isDualCarriageway(sealedType) && (
                  <>
                    <fieldset style={{ border: "1px dashed var(--border-color)", padding: "10px", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <legend style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-accent)", padding: "0 4px" }}>Carriage 1</legend>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Narrow Cracks</label>
                          <select value={sealedC1NarrowCracks} onChange={(e) => setSealedC1NarrowCracks(e.target.value)} className="mobile-select">
                            <option value="no_cracks">No cracks</option>
                            <option value="faint_cracks">Faint cracks</option>
                            <option value="distinct_cracks_up_to_1mm">Distinct cracks up to 1mm</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Wide Cracks</label>
                          <select value={sealedC1WideCracks} onChange={(e) => setSealedC1WideCracks(e.target.value)} className="mobile-select">
                            <option value="no_cracks">No cracks</option>
                            <option value="cracks_3_5mm">Cracks 3-5mm</option>
                            <option value="cracks_5_10mm">Cracks 5-10mm</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Pothole / Patches</label>
                          <SelectWithOther value={sealedC1Potholes} onChange={setSealedC1Potholes} options={POTHOLE_PATCHES_OPTIONS} includeOther={false} />
                        </div>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Rutting</label>
                          <select value={sealedC1Rutting} onChange={(e) => setSealedC1Rutting(e.target.value)} className="mobile-select">
                            <option value="no_rutting__5mm">No rutting &lt;5mm</option>
                            <option value="discernible_5_15mm">Discernible 5-15mm</option>
                            <option value="large_15_25mm">Large 15-25mm</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Edge Breaks</label>
                          <select value={sealedC1EdgeBreaks} onChange={(e) => setSealedC1EdgeBreaks(e.target.value)} className="mobile-select">
                            <option value="no_edge_break">No edge break</option>
                            <option value="up_to_50mm">Up to 50mm</option>
                            <option value="50_100mm_break">50-100mm break</option>
                            <option value="__100mm">&gt; 100mm</option>
                          </select>
                        </div>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Edge Drop</label>
                          <select value={sealedC1EdgeDrop} onChange={(e) => setSealedC1EdgeDrop(e.target.value)} className="mobile-select">
                            <option value="no_edge_break">No edge drop</option>
                            <option value="up_to_50mm">Up to 50mm</option>
                            <option value="50_100mm_break">50-100mm drop</option>
                            <option value="__100mm">&gt; 100mm</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Ravelling</label>
                          <select value={sealedC1Ravelling} onChange={(e) => setSealedC1Ravelling(e.target.value)} className="mobile-select">
                            <option value="none">None</option>
                            <option value="minor">Minor</option>
                            <option value="major">Major</option>
                          </select>
                        </div>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Riding Quality</label>
                          <SelectWithOther value={sealedC1RidingQuality} onChange={setSealedC1RidingQuality} options={CONDITION_GFPM_CONSTRUCTION} includeOther={false} />
                        </div>
                      </div>
                    </fieldset>
                    <fieldset style={{ border: "1px dashed var(--border-color)", padding: "10px", borderRadius: "var(--radius-sm)", display: "flex", flexDirection: "column", gap: "8px" }}>
                      <legend style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-accent)", padding: "0 4px" }}>Carriage 2</legend>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Narrow Cracks</label>
                          <select value={sealedC2NarrowCracks} onChange={(e) => setSealedC2NarrowCracks(e.target.value)} className="mobile-select">
                            <option value="no_cracks">No cracks</option>
                            <option value="faint_cracks">Faint cracks</option>
                            <option value="distinct_cracks_up_to_1mm">Distinct cracks up to 1mm</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Wide Cracks</label>
                          <select value={sealedC2WideCracks} onChange={(e) => setSealedC2WideCracks(e.target.value)} className="mobile-select">
                            <option value="no_cracks">No cracks</option>
                            <option value="cracks_3_5mm">Cracks 3-5mm</option>
                            <option value="cracks_5_10mm">Cracks 5-10mm</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Pothole / Patches</label>
                          <SelectWithOther value={sealedC2Potholes} onChange={setSealedC2Potholes} options={POTHOLE_PATCHES_OPTIONS} includeOther={false} />
                        </div>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Rutting</label>
                          <select value={sealedC2Rutting} onChange={(e) => setSealedC2Rutting(e.target.value)} className="mobile-select">
                            <option value="no_rutting__5mm">No rutting &lt;5mm</option>
                            <option value="discernible_5_15mm">Discernible 5-15mm</option>
                            <option value="large_15_25mm">Large 15-25mm</option>
                            <option value="mixed">Mixed</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Edge Breaks</label>
                          <select value={sealedC2EdgeBreaks} onChange={(e) => setSealedC2EdgeBreaks(e.target.value)} className="mobile-select">
                            <option value="no_edge_break">No edge break</option>
                            <option value="up_to_50mm">Up to 50mm</option>
                            <option value="50_100mm_break">50-100mm break</option>
                            <option value="__100mm">&gt; 100mm</option>
                          </select>
                        </div>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Edge Drop</label>
                          <select value={sealedC2EdgeDrop} onChange={(e) => setSealedC2EdgeDrop(e.target.value)} className="mobile-select">
                            <option value="no_edge_break">No edge drop</option>
                            <option value="up_to_50mm">Up to 50mm</option>
                            <option value="50_100mm_break">50-100mm drop</option>
                            <option value="__100mm">&gt; 100mm</option>
                          </select>
                        </div>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Ravelling</label>
                          <select value={sealedC2Ravelling} onChange={(e) => setSealedC2Ravelling(e.target.value)} className="mobile-select">
                            <option value="none">None</option>
                            <option value="minor">Minor</option>
                            <option value="major">Major</option>
                          </select>
                        </div>
                        <div className="mobile-form-group">
                          <label className="mobile-label">Riding Quality</label>
                          <SelectWithOther value={sealedC2RidingQuality} onChange={setSealedC2RidingQuality} options={CONDITION_GFPM_CONSTRUCTION} includeOther={false} />
                        </div>
                      </div>
                    </fieldset>
                  </>
                )}

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Markings</label>
                    <select value={sealedRoadMarkings} onChange={(e) => setSealedRoadMarkings(e.target.value)} className="mobile-select">
                      {YES_NO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  {sealedRoadMarkings === "yes" && (
                    <div className="mobile-form-group">
                      <label className="mobile-label">Markings Visible</label>
                      <select value={sealedRoadMarkingsVisible} onChange={(e) => setSealedRoadMarkingsVisible(e.target.value)} className="mobile-select">
                        {YES_NO_OPTIONS.map((o) => (
                          <option key={o.value} value={o.value}>{o.label}</option>
                        ))}
                      </select>
                    </div>
                  )}
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Studs</label>
                    <select value={sealedRoadStuds} onChange={(e) => setSealedRoadStuds(e.target.value)} className="mobile-select">
                      {YES_NO_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Passability</label>
                    <select value={sealedPassability} onChange={(e) => setSealedPassability(e.target.value)} className="mobile-select">
                      <option value="all_year_round">All year round</option>
                      <option value="dry_season_only">Dry season</option>
                      <option value="rupture">Rupture</option>
                      <option value="under_construction">Under construction / rehabilitation (detour)</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Year Sealed</label>
                    <input type="number" placeholder="e.g. 2015" value={sealedYearConstructed} onChange={(e) => setSealedYearConstructed(e.target.value)} className="mobile-input" />
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Gravel Road */}
            {assetCategory === "gravel" && segmentGeometry && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Gravel Road Properties</legend>

                <div className="mobile-form-group">
                  <label className="mobile-label">Road Class</label>
                  <select value={gravelClass} onChange={(e) => setGravelClass(e.target.value)} className="mobile-select">
                    {SEALED_ROAD_CLASS_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Length (km)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 8.4"
                      value={gravelLength}
                      onChange={(e) => setGravelLength(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Width (m)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 5.5"
                      value={gravelWidth}
                      onChange={(e) => setGravelWidth(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Authority Name</label>
                    <SelectWithOther
                      value={gravelAuthority}
                      onChange={setGravelAuthority}
                      options={AUTHORITY_OPTIONS}
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Servitude Vegetation</label>
                    <select value={gravelVegetation} onChange={(e) => setGravelVegetation(e.target.value)} className="mobile-select">
                      <option value="none">None</option>
                      <option value="light">Light</option>
                      <option value="medium">Medium</option>
                      <option value="dense">Dense</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Climate Region</label>
                    <select value={gravelClimate} onChange={(e) => setGravelClimate(e.target.value)} className="mobile-select">
                      <option value="dry">Dry</option>
                      <option value="moderate">Moderate</option>
                      <option value="wet">Wet</option>
                      <option value="very_wet">Very Wet</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Terrain Type</label>
                    <select value={gravelTerrain} onChange={(e) => setGravelTerrain(e.target.value)} className="mobile-select">
                      <option value="flat">Flat</option>
                      <option value="rolling">Rolling</option>
                      <option value="mountainous">Mountainous</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage Type</label>
                    <select value={gravelDrainageType} onChange={(e) => setGravelDrainageType(e.target.value)} className="mobile-select">
                      {DRAINAGE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Cross section</label>
                    <select value={gravelCrossSection} onChange={(e) => setGravelCrossSection(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="flat">Flat</option>
                      <option value="inverted">Inverted</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Gravel Thickness (mm)</label>
                    <select value={gravelThickness} onChange={(e) => setGravelThickness(e.target.value)} className="mobile-select">
                      <option value="_50">&lt;50</option>
                      <option value="50_100">50-100</option>
                      <option value="_100">&gt;100</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Corrugations</label>
                    <select value={gravelCorrugations} onChange={(e) => setGravelCorrugations(e.target.value)} className="mobile-select">
                      <option value="none">None</option>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage Condition</label>
                    <select value={gravelDrainageCond} onChange={(e) => setGravelDrainageCond(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Potholes Degree</label>
                    <select value={gravelPotholes} onChange={(e) => setGravelPotholes(e.target.value)} className="mobile-select">
                      <option value="none">None</option>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Corrugations Severity</label>
                    <select value={gravelCorrugationsSeverity} onChange={(e) => setGravelCorrugationsSeverity(e.target.value)} className="mobile-select">
                      {DEFECT_SEVERITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Cross Section Severity</label>
                    <select value={gravelCrossSectionSeverity} onChange={(e) => setGravelCrossSectionSeverity(e.target.value)} className="mobile-select">
                      {DEFECT_SEVERITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage Condition Severity</label>
                    <select value={gravelDrainageSeverity} onChange={(e) => setGravelDrainageSeverity(e.target.value)} className="mobile-select">
                      {DEFECT_SEVERITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Potholes Severity</label>
                    <select value={gravelPotholesSeverity} onChange={(e) => setGravelPotholesSeverity(e.target.value)} className="mobile-select">
                      {DEFECT_SEVERITY_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-label">Riding Quality Severity</label>
                  <select value={gravelRidingSeverity} onChange={(e) => setGravelRidingSeverity(e.target.value)} className="mobile-select">
                    {DEFECT_SEVERITY_OPTIONS.map((o) => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Passability</label>
                    <select value={gravelPassability} onChange={(e) => setGravelPassability(e.target.value)} className="mobile-select">
                      <option value="all_year_round">All year round</option>
                      <option value="dry_season_only">Dry season</option>
                      <option value="rupture">Rupture</option>
                      <option value="under_construction">Under construction / rehabilitation (detour)</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Year of construction</label>
                    <input
                      type="number"
                      placeholder="e.g. 1995"
                      value={gravelYearConstructed}
                      onChange={(e) => setGravelYearConstructed(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Riding Quality Condition</label>
                  <SelectWithOther
                    value={gravelRidingQuality}
                    onChange={setGravelRidingQuality}
                    options={CONDITION_GFPM_CONSTRUCTION}
                    includeOther={false}
                    style={{ borderColor: "var(--accent-emerald)" }}
                  />
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Earth Roads */}
            {assetCategory === "earth" && segmentGeometry && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Earth Road Properties</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Class</label>
                    <select value={earthClass} onChange={(e) => setEarthClass(e.target.value)} className="mobile-select">
                      <option value="tertiary_feeder">Tertiary Feeder</option>
                      <option value="tertiary_access">Tertiary Access</option>
                      <option value="urban_local">Urban Local</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Authority</label>
                    <SelectWithOther
                      value={earthAuthority}
                      onChange={setEarthAuthority}
                      options={AUTHORITY_OPTIONS}
                    />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Length (km)</label>
                    <input type="number" step="any" placeholder="e.g. 5.2" value={earthLength} onChange={(e) => setEarthLength(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Width (m)</label>
                    <input type="number" step="any" placeholder="e.g. 4.0" value={earthWidth} onChange={(e) => setEarthWidth(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Terrain Type</label>
                    <select value={earthTerrain} onChange={(e) => setEarthTerrain(e.target.value)} className="mobile-select">
                      <option value="flat">Flat</option>
                      <option value="rolling">Rolling</option>
                      <option value="mountainous">Mountainous</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Climate Region</label>
                    <select value={earthClimate} onChange={(e) => setEarthClimate(e.target.value)} className="mobile-select">
                      <option value="dry">Dry</option>
                      <option value="moderate">Moderate</option>
                      <option value="wet">Wet</option>
                      <option value="very_wet">Very Wet</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage Type</label>
                    <select value={earthDrainageType} onChange={(e) => setEarthDrainageType(e.target.value)} className="mobile-select">
                      {DRAINAGE_TYPE_OPTIONS.map((o) => (
                        <option key={o.value} value={o.value}>{o.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage Condition</label>
                    <select value={earthDrainageCond} onChange={(e) => setEarthDrainageCond(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Passability</label>
                    <select value={earthPassability} onChange={(e) => setEarthPassability(e.target.value)} className="mobile-select">
                      <option value="all_year_round">All Year Round</option>
                      <option value="dry_season_only">Dry season</option>
                      <option value="rupture">Rupture</option>
                      <option value="under_construction">Under construction / rehabilitation (detour)</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Year Constructed</label>
                    <input type="number" placeholder="e.g. 1998" value={earthYearConstructed} onChange={(e) => setEarthYearConstructed(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Overall Condition</label>
                  <SelectWithOther
                    value={earthCondition}
                    onChange={setEarthCondition}
                    options={CONDITION_GFPM_CONSTRUCTION}
                    includeOther={false}
                    style={{ borderColor: "var(--accent-emerald)" }}
                  />
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Catchpit */}
            {assetCategory === "catchpit" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Catchpit Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Catchpit Condition</label>
                  <select value={catchpitCondition} onChange={(e) => setCatchpitCondition(e.target.value)} className="mobile-select">
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="blocked">Blocked</option>
                  </select>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Traffic Calming */}
            {assetCategory === "traffic_calming" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Traffic Calming Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Type</label>
                  <SelectWithOther value={trafficCalmingType} onChange={setTrafficCalmingType} options={TRAFFIC_CALMING_TYPES} />
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label">Condition</label>
                  <select value={trafficCalmingCondition} onChange={(e) => setTrafficCalmingCondition(e.target.value)} className="mobile-select">
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Footbridge */}
            {assetCategory === "footbridge" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Foot Bridge Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Footbridge Name</label>
                  <input type="text" placeholder="e.g. Mupfure Footbridge" value={footbridgeName} onChange={(e) => setFootbridgeName(e.target.value)} className="mobile-input" required={assetCategory === "footbridge"} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Bridge Type</label>
                    <select value={footbridgeType} onChange={(e) => setFootbridgeType(e.target.value)} className="mobile-select">
                      <option value="suspension">Suspension</option>
                      <option value="simply_supported">Simply Supported</option>
                      <option value="cantilever">Cantilever</option>
                      <option value="arch">Arch</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Material</label>
                    <select value={footbridgeMaterial} onChange={(e) => setFootbridgeMaterial(e.target.value)} className="mobile-select">
                      <option value="steel">Steel</option>
                      <option value="timber">Timber</option>
                      <option value="concrete">Concrete</option>
                      <option value="masonry">Masonry</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Crossing Type</label>
                    <select value={footbridgeCrossing} onChange={(e) => setFootbridgeCrossing(e.target.value)} className="mobile-select">
                      <option value="river">River</option>
                      <option value="road">Road</option>
                      <option value="valley">Valley</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Width (m)</label>
                    <input type="number" step="any" placeholder="e.g. 1.2" value={footbridgeWidth} onChange={(e) => setFootbridgeWidth(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label">Span (m)</label>
                  <input type="number" step="any" placeholder="e.g. 25.0" value={footbridgeSpan} onChange={(e) => setFootbridgeSpan(e.target.value)} className="mobile-input" />
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Overall Condition</label>
                  <select value={footbridgeCondition} onChange={(e) => setFootbridgeCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                    <option value="good">GOOD</option>
                    <option value="fair">FAIR</option>
                    <option value="poor">POOR</option>
                  </select>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Rail Level Crossing */}
            {assetCategory === "rail_crossing" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Rail Level Crossing Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Crossing Name / Location</label>
                  <input type="text" placeholder="e.g. Ruwa Level Crossing" value={railCrossingName} onChange={(e) => setRailCrossingName(e.target.value)} className="mobile-input" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Crossing Type</label>
                    <select value={railCrossingType} onChange={(e) => setRailCrossingType(e.target.value)} className="mobile-select">
                      <option value="at_grade">At Grade</option>
                      <option value="grade_separated">Grade Separated</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Control Mechanism</label>
                    <select value={railCrossingControl} onChange={(e) => setRailCrossingControl(e.target.value)} className="mobile-select">
                      <option value="gates">Gates / Barriers</option>
                      <option value="signals">Traffic Signals</option>
                      <option value="signs_only">Signs Only</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Class</label>
                    <select value={railCrossingRoadClass} onChange={(e) => setRailCrossingRoadClass(e.target.value)} className="mobile-select">
                      {ROAD_CLASS_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Condition</label>
                    <select value={railCrossingCondition} onChange={(e) => setRailCrossingCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Tollgate */}
            {assetCategory === "tollgate" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Tollgate Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Tollgate Name</label>
                  <input type="text" placeholder="e.g. Plumtree Toll Plaza" value={tollgateName} onChange={(e) => setTollgateName(e.target.value)} className="mobile-input" required={assetCategory === "tollgate"} />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Tollgate Type</label>
                    <select value={tollgateType} onChange={(e) => setTollgateType(e.target.value)} className="mobile-select">
                      <option value="manual">Manual</option>
                      <option value="electronic">Electronic</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">No. of Lanes</label>
                    <input type="number" min="1" placeholder="e.g. 4" value={tollgateLanes} onChange={(e) => setTollgateLanes(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Dualisation</label>
                    <select value={tollgateDualisation} onChange={(e) => setTollgateDualisation(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Servitude Vegetation</label>
                    <select value={tollgateVegetation} onChange={(e) => setTollgateVegetation(e.target.value)} className="mobile-select">
                      <option value="none">None</option>
                      <option value="light">Light</option>
                      <option value="medium">Medium</option>
                      <option value="dense">Dense</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Operational Status</label>
                    <select value={tollgateOperational} onChange={(e) => setTollgateOperational(e.target.value)} className="mobile-select">
                      <option value="yes">Operational</option>
                      <option value="partial">Partially Operational</option>
                      <option value="no">Not Operational</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Condition</label>
                    <select value={tollgateCondition} onChange={(e) => setTollgateCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Lay-by */}
            {assetCategory === "layby" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Lay By Properties</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Surface Type</label>
                    <select value={laybySurface} onChange={(e) => setLaybySurface(e.target.value)} className="mobile-select">
                      <option value="gravel">Gravel</option>
                      <option value="sealed">Sealed</option>
                      <option value="concrete">Concrete</option>
                      <option value="earth">Earth</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Length (m)</label>
                    <input type="number" step="any" placeholder="e.g. 50" value={laybyLength} onChange={(e) => setLaybyLength(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Width (m)</label>
                    <input type="number" step="any" placeholder="e.g. 4.0" value={laybyWidth} onChange={(e) => setLaybyWidth(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Street furniture condition</label>
                    <select value={laybyFurniture} onChange={(e) => setLaybyFurniture(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                      <option value="none">None</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Refuse bin</label>
                    <select value={laybyRefuseBin} onChange={(e) => setLaybyRefuseBin(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage</label>
                    <select value={laybyDrainage} onChange={(e) => setLaybyDrainage(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Condition</label>
                    <select value={laybyCondition} onChange={(e) => setLaybyCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Bus Stop */}
            {assetCategory === "busstop" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Bus Stop Properties</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Bus Stop Type</label>
                    <select value={busstopType} onChange={(e) => setBusstopType(e.target.value)} className="mobile-select">
                      <option value="bay_type">Bay Type</option>
                      <option value="on_street">On Street</option>
                      <option value="terminal">Terminal / Terminus</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Shelter Present</label>
                    <select value={busstopShelter} onChange={(e) => setBusstopShelter(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Furniture condition</label>
                    <select value={busstopFurnitureCondition} onChange={(e) => setBusstopFurnitureCondition(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Refuse bin</label>
                    <select value={busstopRefuseBin} onChange={(e) => setBusstopRefuseBin(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="damaged">Damaged</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage</label>
                    <select value={busstopDrainage} onChange={(e) => setBusstopDrainage(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Condition</label>
                    <select value={busstopCondition} onChange={(e) => setBusstopCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Junction */}
            {assetCategory === "junction" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Junction Properties</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Junction Type</label>
                    <select value={junctionType} onChange={(e) => setJunctionType(e.target.value)} className="mobile-select">
                      <option value="t_junction">T-Junction</option>
                      <option value="y_junction">Y-Junction</option>
                      <option value="crossroads">Crossroads</option>
                      <option value="roundabout">Roundabout</option>
                      <option value="interchange">Interchange</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Traffic Control</label>
                    <select value={junctionControl} onChange={(e) => setJunctionControl(e.target.value)} className="mobile-select">
                      <option value="signs">Signs</option>
                      <option value="traffic_lights">Traffic Lights</option>
                      <option value="roundabout">Roundabout</option>
                      <option value="none">Uncontrolled</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Markings</label>
                    <select value={junctionMarkings} onChange={(e) => setJunctionMarkings(e.target.value)} className="mobile-select">
                      <option value="yes">Yes (Present)</option>
                      <option value="faded">Faded</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Signage Condition</label>
                    <select value={junctionSignage} onChange={(e) => setJunctionSignage(e.target.value)} className="mobile-select">
                      {CONDITION_GFP.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Junction Condition</label>
                  <select value={junctionCondition} onChange={(e) => setJunctionCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                    <option value="good">GOOD</option>
                    <option value="fair">FAIR</option>
                    <option value="poor">POOR</option>
                  </select>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Road Sign */}
            {assetCategory === "sign" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Road Sign Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Sign Name</label>
                  <input type="text" placeholder="e.g. Speed Limit 80" value={signName} onChange={(e) => setSignName(e.target.value)} className="mobile-input" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Sign Type</label>
                    <select value={signType} onChange={(e) => setSignType(e.target.value)} className="mobile-select">
                      <option value="warning">Warning</option>
                      <option value="regulatory">Regulatory</option>
                      <option value="informatory">Informative</option>
                      <option value="direction">Direction</option>
                      <option value="speed_limit">Speed Limit</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Visibility</label>
                    <select value={signVisibility} onChange={(e) => setSignVisibility(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="obstructed">Obstructed</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">SADC Compliant</label>
                    <select
                      value={signSadcCompliant}
                      onChange={(e) => setSignSadcCompliant(e.target.value as "yes" | "no" | "mixed")}
                      className="mobile-select"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                      <option value="mixed">Mixed</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Sign Condition</label>
                    <select value={signCondition} onChange={(e) => setSignCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                      <option value="missing">MISSING</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Piped Causeway */}
            {assetCategory === "piped_causeway" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Piped Causeway Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Causeway Name / Location</label>
                  <input type="text" placeholder="e.g. Mwenezi Piped Causeway" value={causewayName} onChange={(e) => setCausewayName(e.target.value)} className="mobile-input" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Causeway type</label>
                    <select value={causewayType} onChange={(e) => setCausewayType(e.target.value)} className="mobile-select">
                      <option value="boxed">Boxed</option>
                      <option value="piped">Piped</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Condition</label>
                    <select value={causewayCondition} onChange={(e) => setCausewayCondition(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Length (m)</label>
                    <input type="number" step="any" placeholder="e.g. 12" value={causewayLength} onChange={(e) => setCausewayLength(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Number of openings</label>
                    <input type="number" min="1" placeholder="e.g. 2" value={causewayOpenings} onChange={(e) => setCausewayOpenings(e.target.value)} className="mobile-input" />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Box size (m²)</label>
                    <input type="number" step="any" placeholder={causewayType === "boxed" ? "e.g. 1.2" : "N/A for piped"} value={causewayBoxSize} onChange={(e) => setCausewayBoxSize(e.target.value)} className="mobile-input" disabled={causewayType !== "boxed"} />
                  </div>
                </div>
                {causewayType === "piped" && (
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Pipe Material</label>
                    <select value={causewayPipeMaterial} onChange={(e) => setCausewayPipeMaterial(e.target.value)} className="mobile-select">
                      <option value="concrete">Concrete</option>
                      <option value="steel">Steel</option>
                      <option value="corrugated_metal">Corrugated Metal</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Pipe Diameter (mm)</label>
                    <select value={causewayPipeDiameter} onChange={(e) => setCausewayPipeDiameter(e.target.value)} className="mobile-select">
                      <option value="300_600">300-600mm</option>
                      <option value="600_900">600-900mm</option>
                      <option value="900_1200">900-1200mm</option>
                      <option value="more_1200">&gt;1200mm</option>
                    </select>
                  </div>
                </div>
                )}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage</label>
                    <select value={causewayDrainage} onChange={(e) => setCausewayDrainage(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="partially_blocked">Partially Blocked</option>
                      <option value="blocked">Blocked</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Serviceability</label>
                    <select value={causewayServiceability} onChange={(e) => setCausewayServiceability(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                      <option value="failed">FAILED</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Drift */}
            {assetCategory === "drift" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Drift Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Drift Name / Location</label>
                  <input type="text" placeholder="e.g. Tokwe Drift Crossing" value={driftName} onChange={(e) => setDriftName(e.target.value)} className="mobile-input" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drift type</label>
                    <select value={driftType} onChange={(e) => setDriftType(e.target.value)} className="mobile-select">
                      <option value="concrete">Concrete</option>
                      <option value="masonry">Masonry</option>
                      <option value="earth">Earth</option>
                      <option value="rock">Rock</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Length (m)</label>
                    <input type="number" step="any" placeholder="e.g. 8.0" value={driftLength} onChange={(e) => setDriftLength(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Surface Type</label>
                    <select value={driftSurface} onChange={(e) => setDriftSurface(e.target.value)} className="mobile-select">
                      <option value="concrete">Concrete</option>
                      <option value="masonry">Masonry</option>
                      <option value="earth">Earth</option>
                      <option value="rock">Rock</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Width (m)</label>
                    <input type="number" step="any" placeholder="e.g. 6.0" value={driftWidth} onChange={(e) => setDriftWidth(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Passability</label>
                    <select value={driftPassability} onChange={(e) => setDriftPassability(e.target.value)} className="mobile-select">
                      <option value="all_year_round">All Year Round</option>
                      <option value="dry_season_only">Dry Season Only</option>
                      <option value="seasonal">Seasonal</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Condition</label>
                    <select value={driftCondition} onChange={(e) => setDriftCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Grid */}
            {assetCategory === "grid" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Grid Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Grid Name / Location</label>
                  <input type="text" placeholder="e.g. Beit Bridge Border Grid" value={gridName} onChange={(e) => setGridName(e.target.value)} className="mobile-input" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Material</label>
                    <select value={gridMaterial} onChange={(e) => setGridMaterial(e.target.value)} className="mobile-select">
                      <option value="steel">Steel</option>
                      <option value="concrete">Concrete</option>
                      <option value="timber">Timber</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Operational</label>
                    <select value={gridOperational} onChange={(e) => setGridOperational(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="partial">Partial</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Serviceability</label>
                    <select value={gridServiceability} onChange={(e) => setGridServiceability(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                      <option value="failed">Failed</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Passability</label>
                    <select value={gridPassability} onChange={(e) => setGridPassability(e.target.value)} className="mobile-select">
                      <option value="all_year_round">All Year Round</option>
                      <option value="dry_season_only">Dry Season Only</option>
                      <option value="seasonal">Seasonal</option>
                    </select>
                  </div>
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Grid Condition</label>
                  <select value={gridCondition} onChange={(e) => setGridCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                    <option value="good">GOOD</option>
                    <option value="fair">FAIR</option>
                    <option value="poor">POOR</option>
                  </select>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Traffic Lights */}
            {assetCategory === "traffic_lights" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Traffic Lights Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Location / Intersection Name</label>
                  <input type="text" placeholder="e.g. Samora Machel / Julius Nyerere Intersection" value={trafficLightsLocation} onChange={(e) => setTrafficLightsLocation(e.target.value)} className="mobile-input" />
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Signal Type</label>
                    <select value={trafficLightsType} onChange={(e) => setTrafficLightsType(e.target.value)} className="mobile-select">
                      <option value="standard">Standard LED</option>
                      <option value="pedestrian">Pedestrian Signal</option>
                      <option value="flashing">Flashing Amber</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">No. of Phases (max 6)</label>
                    <input type="number" min="2" max="6" placeholder="e.g. 3" value={trafficLightsPhases} onChange={(e) => setTrafficLightsPhases(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Power source</label>
                    <select value={trafficLightsPowerSource} onChange={(e) => setTrafficLightsPowerSource(e.target.value)} className="mobile-select">
                      <option value="grid">Grid</option>
                      <option value="solar">Solar</option>
                      <option value="generator">Generator</option>
                      <option value="hybrid">Hybrid</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Operational</label>
                    <select value={trafficLightsOperational} onChange={(e) => setTrafficLightsOperational(e.target.value)} className="mobile-select">
                      <option value="yes">Operational</option>
                      <option value="partial">Partially Working</option>
                      <option value="no">Not Working</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Condition</label>
                    <select value={trafficLightsCondition} onChange={(e) => setTrafficLightsCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Streetlights */}
            {assetCategory === "streetlight" && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Streetlight Properties</legend>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Light Type</label>
                    <select value={streetlightType} onChange={(e) => setStreetlightType(e.target.value)} className="mobile-select">
                      <option value="led">LED</option>
                      <option value="sodium">Sodium Vapor</option>
                      <option value="fluorescent">Fluorescent</option>
                      <option value="solar">Solar LED</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Power Source</label>
                    <select value={streetlightPowerSource} onChange={(e) => setStreetlightPowerSource(e.target.value)} className="mobile-select">
                      <option value="grid">ZESA Grid</option>
                      <option value="solar">Solar</option>
                      <option value="generator">Generator</option>
                    </select>
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Operational</label>
                    <select value={streetlightOperational} onChange={(e) => setStreetlightOperational(e.target.value)} className="mobile-select">
                      <option value="yes">Operational</option>
                      <option value="partial">Partially Working</option>
                      <option value="no">Not Working</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Number of lamps</label>
                    <input type="number" min="1" placeholder="e.g. 12" value={streetlightCount} onChange={(e) => setStreetlightCount(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Overall Condition</label>
                  <select value={streetlightCondition} onChange={(e) => setStreetlightCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                    <option value="good">GOOD</option>
                    <option value="fair">FAIR</option>
                    <option value="poor">POOR</option>
                  </select>
                </div>
              </fieldset>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginTop: "8px" }}>
              <div style={{ display: "flex", gap: "10px" }}>
                <button
                  type="button"
                  onClick={(e) => handleSaveForm(e, true)}
                  className="mobile-btn mobile-btn-outline"
                  style={{ flex: 1 }}
                >
                  Save Draft
                </button>
                <button
                  type="submit"
                  className="mobile-btn"
                  style={{ flex: 1 }}
                >
                  <PlusCircle size={14} />
                  <span>{editingDraftId ? "Queue Update" : "Queue for Sync"}</span>
                </button>
              </div>
              {editingDraftId && (
                <button
                  type="button"
                  onClick={() => {
                    clearForm();
                    showToast("Edit cancelled.", "info");
                  }}
                  className="mobile-btn mobile-btn-outline"
                  style={{ width: "100%", borderColor: "var(--accent-rose)", color: "var(--accent-rose)" }}
                >
                  Cancel Edit
                </button>
              )}
            </div>
          </form>
          )
        ) : activeTab === "queue" ? (
          /* Queue tab content */
          <div style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
            {/* Sub-tab selection switch */}
            <div style={{ display: "flex", gap: "6px", background: "var(--bg-app)", padding: "3px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setQueueSubTab("drafts")}
                style={{
                  flex: 1, padding: "8px 0", fontSize: "10px", border: "none", borderRadius: "var(--radius-sm)",
                  background: queueSubTab === "drafts" ? "var(--accent-emerald)" : "transparent",
                  color: queueSubTab === "drafts" ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
                }}
              >
                Drafts ({drafts.filter(d => d.status === "draft" || !d.status).length})
              </button>
              <button
                type="button"
                onClick={() => setQueueSubTab("queued")}
                style={{
                  flex: 1, padding: "8px 0", fontSize: "10px", border: "none", borderRadius: "var(--radius-sm)",
                  background: queueSubTab === "queued" ? "var(--accent-emerald)" : "transparent",
                  color: queueSubTab === "queued" ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer", transition: "all 0.2s"
                }}
              >
                Ready to Sync ({drafts.filter(d => d.status === "queued").length})
              </button>
            </div>

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h2 style={{ fontSize: "14px", fontWeight: "700" }}>
                {queueSubTab === "drafts" ? "In-Progress Drafts" : "Sync Queue"}
              </h2>
              {queueSubTab === "queued" && (
                <button
                  onClick={handleSyncDrafts}
                  disabled={isSyncing || drafts.filter(d => d.status === "queued").length === 0}
                  className="mobile-btn"
                  style={{ padding: "6px 12px", fontSize: "11px" }}
                >
                  {isSyncing ? (
                    <div className="spinner"></div>
                  ) : (
                    <>
                      <Server size={12} />
                      <span>Upload to Server</span>
                    </>
                  )}
                </button>
              )}
            </div>

            {isSyncing && (
              <div
                style={{
                  background: "rgba(0, 102, 51, 0.05)",
                  border: "1px solid rgba(0, 102, 51, 0.15)",
                  borderRadius: "10px",
                  padding: "12px",
                  display: "flex",
                  flexDirection: "column",
                  gap: "8px",
                  boxShadow: "0 2px 8px rgba(0,0,0,0.05)",
                  fontFamily: "var(--font-body)"
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "12px", fontWeight: "600", color: "#006633" }}>
                  <span>Syncing Telemetry...</span>
                  <span>{syncProgress.current} / {syncProgress.total}</span>
                </div>
                
                {/* Progress bar background */}
                <div style={{ width: "100%", height: "6px", background: "rgba(0,0,0,0.08)", borderRadius: "3px", overflow: "hidden" }}>
                  <div
                    style={{
                      width: `${(syncProgress.current / syncProgress.total) * 100}%`,
                      height: "100%",
                      background: "linear-gradient(90deg, #10b981, #059669)",
                      borderRadius: "3px",
                      transition: "width 0.3s ease-out"
                    }}
                  />
                </div>
                
                {syncProgress.currentName && (
                  <div style={{ fontSize: "10px", color: "var(--text-muted)", fontStyle: "italic" }}>
                    Uploading: {syncProgress.currentName}
                  </div>
                )}
              </div>
            )}

            <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
              {(() => {
                const inProgressDrafts = drafts.filter((d) => d.status === "draft" || !d.status);
                const queuedDraftsList = drafts.filter((d) => d.status === "queued");
                const displayedDrafts = queueSubTab === "drafts" ? inProgressDrafts : queuedDraftsList;

                if (displayedDrafts.length === 0) {
                  return (
                    <div style={{ padding: "40px 10px", textAlign: "center", color: "var(--text-muted)", fontSize: "12px" }}>
                      {queueSubTab === "drafts" 
                        ? "No in-progress drafts. Start a new survey form!" 
                        : "No queued surveys ready to sync. Complete drafts first!"}
                    </div>
                  );
                }

                return displayedDrafts.map((draft) => {
                  let title = "Road Survey";
                  if (draft.bridge) title = `Bridge: ${draft.bridge}`;
                  else if (draft.footbridge_name) title = `Footbridge: ${draft.footbridge_name}`;
                  else if (draft.culvet_class) title = `Culvert: ${String(draft.culvet_class).replace("_", " ")}`;
                  else if (draft.shelvets_type) title = `Shelvert: ${draft.shelvets_type}`;
                  else if (draft.gravel_road_name) title = `Gravel Road: ${draft.gravel_road_name}`;
                  else if (draft.earth_road_name) title = `Earth Road: ${draft.earth_road_name}`;
                  else if (draft.causeway_name) title = `Piped Causeway: ${draft.causeway_name}`;
                  else if (draft.drift_name) title = `Drift: ${draft.drift_name}`;
                  else if (draft.grid_name) title = `Grid: ${draft.grid_name}`;
                  else if (draft.tollgate_name) title = `Tollgate: ${draft.tollgate_name}`;
                  else if (draft.traffic_lights_location) title = `Traffic Lights: ${draft.traffic_lights_location}`;
                  else if (draft.streetlight_type) title = `Streetlight: ${draft.streetlight_type}`;
                  else if (draft.rail_crossing_name) title = `Rail Crossing: ${draft.rail_crossing_name}`;
                  else if (draft.junction_type) title = `Junction: ${String(draft.junction_type).replace("_", "-")}`;
                  else if (draft.busstop_type) title = `Bus Stop: ${String(draft.busstop_type).replace("_", " ")}`;
                  else if (draft.layby_surface) title = `Lay-by: ${draft.layby_surface}`;
                  else if (draft.sign_type) title = `Road Sign: ${draft.sign_type}`;
                  else if (draft.paved_road_name) {
                    title = draft.paved_road_type === "concrete_pavement"
                      ? `Concrete Road: ${draft.paved_road_name}`
                      : `Sealed Road: ${draft.paved_road_name}`;
                  }
                  const upperTitle = String(title).replace(/\b\w/g, (c) => c.toUpperCase());
                  const draftPhotos = normalizePhotos(draft);
                  
                  return (
                    <div key={draft.id} className="queue-item" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      {draftPhotos.length > 0 ? (
                        <div style={{ position: "relative", flexShrink: 0 }}>
                          <img src={draftPhotos[0]} alt="Thumbnail" style={{ width: "38px", height: "38px", borderRadius: "6px", objectFit: "cover", border: "1px solid var(--border-color)" }} />
                          {draftPhotos.length > 1 && (
                            <span style={{
                              position: "absolute", bottom: -2, right: -2,
                              background: "var(--accent-emerald)", color: "#fff",
                              fontSize: 8, fontWeight: 800, borderRadius: 8,
                              padding: "1px 4px", lineHeight: 1.2,
                            }}>
                              {draftPhotos.length}
                            </span>
                          )}
                        </div>
                      ) : (
                        <div style={{ width: "38px", height: "38px", borderRadius: "6px", background: "rgba(0,0,0,0.04)", border: "1px dashed var(--border-color)", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
                          <Camera size={14} color="var(--text-muted)" />
                        </div>
                      )}
                      <div className="queue-details" style={{ flex: 1 }}>
                        <span className="queue-title">{upperTitle}</span>
                        <span className="queue-subtitle">
                          {draft.road_name.split(" (")[0]}
                        </span>
                      </div>
                      <div style={{ display: "flex", gap: "6px" }}>
                        <button
                          onClick={() => handleEditDraft(draft)}
                          className="mobile-btn mobile-btn-outline"
                          style={{ width: "32px", height: "32px", padding: 0, color: "var(--accent-emerald)", borderColor: "rgba(16, 185, 129, 0.3)" }}
                          title="Edit Draft"
                        >
                          <Edit size={12} />
                        </button>
                        <button
                          onClick={() => handleDeleteDraft(draft.id)}
                          className="mobile-btn mobile-btn-outline mobile-btn-danger"
                          style={{ width: "32px", height: "32px", padding: 0 }}
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    </div>
                  );
                })
              })()}
            </div>
          </div>
        ) : (
          /* Settings tab content */
          <div className="mobile-settings" style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
            <h2 style={{ fontSize: "14px", fontWeight: "700" }}>System Settings</h2>

            <SurveyProgressPanel drafts={drafts} />
            
            {/* Server Settings Hidden from regular users, unlocked via Dev Mode */}
            {showDevSettings && (
              <div style={{ background: "var(--bg-card)", border: "2px dashed var(--accent-gold)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px", boxShadow: "0 4px 12px rgba(0,0,0,0.05)" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                  <Server size={16} color="var(--accent-emerald)" />
                  <span style={{ fontWeight: 700, fontSize: "12px", textTransform: "uppercase", color: "var(--text-accent)" }}>Developer Configuration</span>
                </div>
                
                <div className="mobile-form-group">
                  <label className="mobile-label">Backend Server URL</label>
                  <input
                    type="text"
                    value={serverUrl}
                    onChange={(e) => setServerUrl(e.target.value)}
                    placeholder="e.g. http://192.168.1.100:3002"
                    className="mobile-input"
                  />
                </div>

                <div style={{ display: "flex", gap: "8px" }}>
                  <button
                    type="button"
                    onClick={() => {
                      localStorage.setItem("roads_server_url", serverUrl);
                      showToast("Server URL saved!", "success");
                    }}
                    className="mobile-btn"
                    style={{ flex: 1, height: "36px", padding: 0 }}
                  >
                    Save URL
                  </button>
                  <button
                    type="button"
                    onClick={async () => {
                      setIsTestingConnection(true);
                      try {
                        const res = await fetch(`${serverUrl}/api/roads`, { method: "GET" });
                        if (res.ok) {
                          setConnectionStatus("online");
                          showToast("Connection Successful!", "success");
                        } else {
                          setConnectionStatus("offline");
                          showToast("Server returned error response.", "error");
                        }
                      } catch (err) {
                        setConnectionStatus("offline");
                        showToast("Failed to connect to server.", "error");
                      } finally {
                        setIsTestingConnection(false);
                      }
                    }}
                    disabled={isTestingConnection}
                    className="mobile-btn mobile-btn-outline"
                    style={{ flex: 1, height: "36px", padding: 0 }}
                  >
                    {isTestingConnection ? "Testing..." : "Test Connection"}
                  </button>
                </div>
                
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: "10px", marginTop: "4px" }}>
                  <span style={{ color: "var(--text-muted)" }}>Status:</span>
                  <span style={{ fontWeight: 700, color: connectionStatus === "online" ? "var(--accent-emerald)" : connectionStatus === "offline" ? "var(--accent-rose)" : "var(--text-muted)" }}>
                    {connectionStatus.toUpperCase()}
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowDevSettings(false)}
                    style={{ background: "transparent", border: "none", color: "var(--accent-rose)", cursor: "pointer", fontWeight: 700 }}
                  >
                    Hide Settings
                  </button>
                </div>
              </div>
            )}

            {/* Surveyor Profile Card */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <User size={16} color="var(--accent-emerald)" />
                <span style={{ fontWeight: 700, fontSize: "12px", textTransform: "uppercase", color: "var(--text-accent)" }}>Surveyor Profile</span>
              </div>
              
              <div className="mobile-form-group">
                <label className="mobile-label">Default Surveyor Name</label>
                <input
                  type="text"
                  value={defaultSurveyor}
                  onChange={(e) => setDefaultSurveyor(e.target.value)}
                  placeholder="e.g. Eng. Rondozai"
                  className="mobile-input"
                />
                <span style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>
                  Pre-populates the Surveyor Name field when launching new survey forms.
                </span>
              </div>

              <button
                type="button"
                onClick={() => {
                  localStorage.setItem("default_surveyor_name", defaultSurveyor);
                  setSurveyorName(defaultSurveyor);
                  showToast("Default surveyor profile updated!", "success");
                }}
                className="mobile-btn"
                style={{ width: "100%", height: "36px", padding: 0 }}
              >
                Save Profile
              </button>
            </div>

            {/* GPS Telemetry Settings Card */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <Compass size={16} color="var(--accent-emerald)" />
                <span style={{ fontWeight: 700, fontSize: "12px", textTransform: "uppercase", color: "var(--text-accent)" }}>GPS Telemetry Settings</span>
              </div>
              
              <div className="mobile-form-group">
                <label className="mobile-label">Strict Accuracy Limit: {gpsAccuracyLimit.toFixed(1)} m</label>
                <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                  <input
                    type="range"
                    min="1.0"
                    max="10.0"
                    step="0.5"
                    value={gpsAccuracyLimit}
                    onChange={(e) => {
                      const val = parseFloat(e.target.value);
                      setGpsAccuracyLimit(val);
                      localStorage.setItem("roads_gps_accuracy_limit", val.toString());
                    }}
                    style={{ flex: 1, accentColor: "var(--accent-emerald)" }}
                  />
                </div>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "2px" }}>
                  GPS accuracy threshold for locking road points (Default: 3.0m). Relaxing this to 5m or 10m allows data capture in poor conditions, and snapping handles precision!
                </span>
              </div>
            </div>

            {/* System Info Card */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "10px", fontSize: "11px", color: "var(--text-muted)" }}>
              <div 
                onClick={handleDevClick}
                style={{ display: "flex", justifyContent: "space-between", cursor: "pointer" }}
              >
                <span>App Version</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>MOTID Collect v2.0.0</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span>Local Draft Queue</span>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{drafts.length} Surveys</span>
              </div>
            </div>

            {/* Developer Info Card */}
            <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", borderRadius: "var(--radius-md)", padding: "16px", display: "flex", flexDirection: "column", gap: "12px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "8px", borderBottom: "1px solid var(--border-color)", paddingBottom: "8px" }}>
                <Info size={14} color="var(--accent-emerald)" />
                <span style={{ fontWeight: 700, fontSize: "11px", textTransform: "uppercase", color: "var(--text-accent)" }}>Developer Information</span>
              </div>

              <div style={{ fontSize: "11px", lineHeight: "1.5", color: "var(--text-primary)" }}>
                This application was developed by the <strong>Zimbabwe National Geospatial and Space Agency (ZINGSA)</strong>.
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer Navigation */}
      <nav className="mobile-nav-bar">
        <button
          onClick={() => setActiveTab("welcome")}
          className={`mobile-nav-item ${activeTab === "welcome" ? "active" : ""}`}
        >
          <Compass size={18} className="mobile-nav-icon" />
          <span>Home</span>
        </button>
        <button
          onClick={() => setActiveTab("form")}
          className={`mobile-nav-item ${activeTab === "form" ? "active" : ""}`}
        >
          <PlusCircle size={18} className="mobile-nav-icon" />
          <span>New Survey</span>
        </button>
        <button
          onClick={() => setActiveTab("queue")}
          className={`mobile-nav-item ${activeTab === "queue" ? "active" : ""}`}
        >
          <Database size={18} className="mobile-nav-icon" />
          {drafts.length > 0 && <span className="mobile-nav-badge">{drafts.length}</span>}
          <span>Draft Queue</span>
        </button>
        <button
          onClick={() => setActiveTab("settings")}
          className={`mobile-nav-item ${activeTab === "settings" ? "active" : ""}`}
        >
          <SettingsIcon size={18} className="mobile-nav-icon" />
          <span>Settings</span>
        </button>
      </nav>
    </div>
  );
}
