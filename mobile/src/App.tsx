import React, { useState, useEffect } from "react";
import { db } from "./lib/db";
import type { SurveyDraft } from "./lib/db";
import { SegmentTracker } from "./components/SegmentTracker";
import type { SegmentGeometry } from "./components/SegmentTracker";
import { Geolocation } from "@capacitor/geolocation";
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
  Waves,
  Grid,
  Flame,
  Sun,
} from "lucide-react";

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
    category: "amenities",
    icon: <Info size={20} />,
    desc: "Speed limits & safety signs. Inspect SADC compliance status, poles, and reflectivity.",
    color: "#4c1d95",
    grad: "linear-gradient(135deg, #8b5cf6, #3b0764)"
  },
  {
    id: "shelvet",
    label: "Shelvets",
    type: "Drainage",
    category: "drainage",
    icon: <FolderOpen size={20} />,
    desc: "Masonry or concrete side drainage structures. Monitor siltation and crack damage.",
    color: "#2563eb",
    grad: "linear-gradient(135deg, #3b82f6, #1d4ed8)"
  },
  {
    id: "culvert",
    label: "Culvets",
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
    id: "grid",
    label: "Grid",
    type: "Drainage",
    category: "drainage",
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
  const [assetCategory, setAssetCategory] = useState<"sealed" | "gravel" | "earth" | "bridge" | "footbridge" | "rail_crossing" | "tollgate" | "layby" | "busstop" | "junction" | "sign" | "shelvet" | "culvert" | "piped_causeway" | "drift" | "grid" | "traffic_lights" | "streetlight">("sealed");
  const [segmentGeometry, setSegmentGeometry] = useState<SegmentGeometry | null>(null);
  const isRoadType = assetCategory === "sealed" || assetCategory === "gravel" || assetCategory === "earth";
  const [roadName, setRoadName] = useState("A4 Highway (Harare - Masvingo - Beitbridge)");
  const [sectionName, setSectionName] = useState("");
  const [surveyorName, setSurveyorName] = useState("");
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split("T")[0]);
  const [vegetation, setVegetation] = useState("medium");
  const [gps, setGps] = useState("");
  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const [imageSadcCompliant, setImageSadcCompliant] = useState<"yes" | "no">("yes");
  const [photo, setPhoto] = useState<string | null>(null);

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

  // Conditional Culvert Fields
  const [culvertClass, setCulvertClass] = useState("pipe_culvert");
  const [culvertType, setCulvertType] = useState("concrete");
  const [culvertServiceability, setCulvertServiceability] = useState("good");

  // Conditional Shelvet Fields
  const [shelvetType, setShelvetType] = useState("armco");
  const [shelvetCondition, setShelvetCondition] = useState("good");

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
  const [sealedPotholesPatches, setSealedPotholesPatches] = useState("good");
  const [sealedRutting, setSealedRutting] = useState("no_rutting__5mm");
  const [sealedEdgeBreaks, setSealedEdgeBreaks] = useState("no_edge_break");
  const [sealedEdgeDrop, setSealedEdgeDrop] = useState("no_edge_break");
  const [sealedDrainage, setSealedDrainage] = useState("good");
  const [sealedRavelling, setSealedRavelling] = useState("none");
  const [sealedRidingQuality, setSealedRidingQuality] = useState("good");
  const [sealedRoadMarkings, setSealedRoadMarkings] = useState("yes");
  const [sealedRoadStuds, setSealedRoadStuds] = useState("yes");
  const [sealedPassability, setSealedPassability] = useState("all_year_round");
  const [sealedGrid, setSealedGrid] = useState("good");
  const [sealedYearConstructed, setSealedYearConstructed] = useState("");

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

  // Lay-by Fields
  const [laybyCondition, setLaybyCondition] = useState("good");
  const [laybySurface, setLaybySurface] = useState("gravel");
  const [laybyLength, setLaybyLength] = useState("");
  const [laybyDrainage, setLaybyDrainage] = useState("good");

  // Bus Stop Fields
  const [busstopType, setBusstopType] = useState("bay_type");
  const [busstopCondition, setBusstopCondition] = useState("good");
  const [busstopShelter, setBusstopShelter] = useState("yes");
  const [busstopDrainage, setBusstopDrainage] = useState("good");

  // Junction Fields
  const [junctionType, setJunctionType] = useState("t_junction");
  const [junctionCondition, setJunctionCondition] = useState("good");
  const [junctionControl, setJunctionControl] = useState("signs");
  const [junctionMarkings, setJunctionMarkings] = useState("yes");
  const [junctionSignage, setJunctionSignage] = useState("yes");

  // Road Sign Fields
  const [signType, setSignType] = useState("warning");
  const [signCondition, setSignCondition] = useState("good");
  const [signSadcCompliant, setSignSadcCompliant] = useState("yes");
  const [signVisibility, setSignVisibility] = useState("good");

  // Piped Causeway Fields
  const [causewayName, setCausewayName] = useState("");
  const [causewayPipeMaterial, setCausewayPipeMaterial] = useState("concrete");
  const [causewayPipeDiameter, setCausewayPipeDiameter] = useState("600_900");
  const [causewayDrainage, setCausewayDrainage] = useState("good");
  const [causewayServiceability, setCausewayServiceability] = useState("good");

  // Drift Fields
  const [driftName, setDriftName] = useState("");
  const [driftCondition, setDriftCondition] = useState("good");
  const [driftSurface, setDriftSurface] = useState("concrete");
  const [driftPassability, setDriftPassability] = useState("dry_season_only");
  const [driftWidth, setDriftWidth] = useState("");

  // Grid Fields
  const [gridName, setGridName] = useState("");
  const [gridCondition, setGridCondition] = useState("good");
  const [gridMaterial, setGridMaterial] = useState("steel");
  const [gridOperational, setGridOperational] = useState("yes");

  // Traffic Lights Fields
  const [trafficLightsLocation, setTrafficLightsLocation] = useState("");
  const [trafficLightsCondition, setTrafficLightsCondition] = useState("good");
  const [trafficLightsOperational, setTrafficLightsOperational] = useState("yes");
  const [trafficLightsType, setTrafficLightsType] = useState("standard");
  const [trafficLightsPhases, setTrafficLightsPhases] = useState("3");

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

    // Background GPS Warming
    const startGpsWarming = async () => {
      try {
        try {
          await Geolocation.requestPermissions();
        } catch (permErr) {
          console.warn("Silent permission request failed:", permErr);
        }
        const id = await Geolocation.watchPosition(
          { enableHighAccuracy: true, timeout: 30000, maximumAge: 0 },
          (position) => {
            if (position) {
              console.log("GPS Warmed up, accuracy:", position.coords.accuracy);
            }
          }
        );
        warmUpWatchIdRef.current = id;
      } catch (err) {
        console.warn("GPS warm-up watch failed to start:", err);
      }
    };
    startGpsWarming();

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      if (warmUpWatchIdRef.current) {
        Geolocation.clearWatch({ id: warmUpWatchIdRef.current });
      }
    };
  }, []);

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
          roadName, sectionName, surveyorName, surveyDate, vegetation, gps,
          imageSadcCompliant, photo,
          // Bridge
          bridgeName, bridgeCrossing, bridgeType, bridgeBearing, bridgeJoints,
          bearingsState, parapet, chemicalEffect, vegetationGrowth, drainage, bridgeCondition,
          // Culvert
          culvertClass, culvertType, culvertServiceability,
          // Shelvet
          shelvetType, shelvetCondition,
          // Sealed
          sealedName, sealedRoute, sealedClass, sealedType, sealedClimate, sealedTerrain,
          sealedAuthority, sealedLength, sealedWidth, sealedDrainageType, sealedVegetation,
          sealedNarrowCracks, sealedWideCracks, sealedPotholesPatches, sealedRutting,
          sealedEdgeBreaks, sealedEdgeDrop, sealedDrainage, sealedRavelling,
          sealedRidingQuality, sealedRoadMarkings, sealedRoadStuds, sealedPassability,
          sealedGrid, sealedYearConstructed,
          // Gravel
          gravelName, gravelRoute, gravelLength, gravelClass, gravelAuthority, gravelVegetation,
          gravelClimate, gravelTerrain, gravelWidth, gravelDrainageType, gravelCrossSection,
          gravelThickness, gravelCorrugations, gravelRidingQuality, gravelDrainageCond,
          gravelPotholes, gravelPassability, gravelYearConstructed,
          // Earth
          earthName, earthClass, earthWidth, earthLength, earthCondition, earthPassability,
          earthDrainageType, earthDrainageCond, earthTerrain, earthClimate, earthAuthority, earthYearConstructed,
          // Footbridge
          footbridgeName, footbridgeType, footbridgeCondition, footbridgeWidth, footbridgeSpan,
          footbridgeMaterial, footbridgeCrossing,
          // Rail crossing
          railCrossingName, railCrossingType, railCrossingCondition, railCrossingControl, railCrossingRoadClass,
          // Tollgate
          tollgateName, tollgateType, tollgateCondition, tollgateLanes, tollgateOperational,
          // Layby
          laybyCondition, laybySurface, laybyLength, laybyDrainage,
          // Bus stop
          busstopType, busstopCondition, busstopShelter, busstopDrainage,
          // Junction
          junctionType, junctionCondition, junctionControl, junctionMarkings, junctionSignage,
          // Sign
          signType, signCondition, signSadcCompliant, signVisibility,
          // Piped Causeway
          causewayName, causewayPipeMaterial, causewayPipeDiameter, causewayDrainage, causewayServiceability,
          // Drift
          driftName, driftCondition, driftSurface, driftPassability, driftWidth,
          // Grid
          gridName, gridCondition, gridMaterial, gridOperational,
          // Traffic Lights
          trafficLightsLocation, trafficLightsCondition, trafficLightsOperational, trafficLightsType, trafficLightsPhases,
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
    assetCategory, roadName, sectionName, surveyorName, surveyDate, vegetation, gps,
    imageSadcCompliant, photo,
    bridgeName, bridgeCrossing, bridgeType, bridgeBearing, bridgeJoints,
    bearingsState, parapet, chemicalEffect, vegetationGrowth, drainage, bridgeCondition,
    culvertClass, culvertType, culvertServiceability,
    shelvetType, shelvetCondition,
    sealedName, sealedRoute, sealedClass, sealedType, sealedClimate, sealedTerrain,
    sealedAuthority, sealedLength, sealedWidth, sealedDrainageType, sealedVegetation,
    sealedNarrowCracks, sealedWideCracks, sealedPotholesPatches, sealedRutting,
    sealedEdgeBreaks, sealedEdgeDrop, sealedDrainage, sealedRavelling,
    sealedRidingQuality, sealedRoadMarkings, sealedRoadStuds, sealedPassability,
    sealedGrid, sealedYearConstructed,
    gravelName, gravelRoute, gravelLength, gravelClass, gravelAuthority, gravelVegetation,
    gravelClimate, gravelTerrain, gravelWidth, gravelDrainageType, gravelCrossSection,
    gravelThickness, gravelCorrugations, gravelRidingQuality, gravelDrainageCond,
    gravelPotholes, gravelPassability, gravelYearConstructed,
    earthName, earthClass, earthWidth, earthLength, earthCondition, earthPassability,
    earthDrainageType, earthDrainageCond, earthTerrain, earthClimate, earthAuthority, earthYearConstructed,
    footbridgeName, footbridgeType, footbridgeCondition, footbridgeWidth, footbridgeSpan,
    footbridgeMaterial, footbridgeCrossing,
    railCrossingName, railCrossingType, railCrossingCondition, railCrossingControl, railCrossingRoadClass,
    tollgateName, tollgateType, tollgateCondition, tollgateLanes, tollgateOperational,
    laybyCondition, laybySurface, laybyLength, laybyDrainage,
    busstopType, busstopCondition, busstopShelter, busstopDrainage,
    junctionType, junctionCondition, junctionControl, junctionMarkings, junctionSignage,
    signType, signCondition, signSadcCompliant, signVisibility,
    causewayName, causewayPipeMaterial, causewayPipeDiameter, causewayDrainage, causewayServiceability,
    driftName, driftCondition, driftSurface, driftPassability, driftWidth,
    gridName, gridCondition, gridMaterial, gridOperational,
    trafficLightsLocation, trafficLightsCondition, trafficLightsOperational, trafficLightsType, trafficLightsPhases,
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
      if (s.surveyorName !== undefined) setSurveyorName(s.surveyorName);
      if (s.surveyDate !== undefined) setSurveyDate(s.surveyDate);
      if (s.vegetation !== undefined) setVegetation(s.vegetation);
      if (s.gps !== undefined) setGps(s.gps);
      if (s.imageSadcCompliant !== undefined) setImageSadcCompliant(s.imageSadcCompliant);
      if (s.photo !== undefined) setPhoto(s.photo);

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
      // Culvert
      if (s.culvertClass !== undefined) setCulvertClass(s.culvertClass);
      if (s.culvertType !== undefined) setCulvertType(s.culvertType);
      if (s.culvertServiceability !== undefined) setCulvertServiceability(s.culvertServiceability);
      // Shelvet
      if (s.shelvetType !== undefined) setShelvetType(s.shelvetType);
      if (s.shelvetCondition !== undefined) setShelvetCondition(s.shelvetCondition);
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
      if (s.sealedPotholesPatches !== undefined) setSealedPotholesPatches(s.sealedPotholesPatches);
      if (s.sealedRutting !== undefined) setSealedRutting(s.sealedRutting);
      if (s.sealedEdgeBreaks !== undefined) setSealedEdgeBreaks(s.sealedEdgeBreaks);
      if (s.sealedEdgeDrop !== undefined) setSealedEdgeDrop(s.sealedEdgeDrop);
      if (s.sealedDrainage !== undefined) setSealedDrainage(s.sealedDrainage);
      if (s.sealedRavelling !== undefined) setSealedRavelling(s.sealedRavelling);
      if (s.sealedRidingQuality !== undefined) setSealedRidingQuality(s.sealedRidingQuality);
      if (s.sealedRoadMarkings !== undefined) setSealedRoadMarkings(s.sealedRoadMarkings);
      if (s.sealedRoadStuds !== undefined) setSealedRoadStuds(s.sealedRoadStuds);
      if (s.sealedPassability !== undefined) setSealedPassability(s.sealedPassability);
      if (s.sealedGrid !== undefined) setSealedGrid(s.sealedGrid);
      if (s.sealedYearConstructed !== undefined) setSealedYearConstructed(s.sealedYearConstructed);
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
      // Layby
      if (s.laybyCondition !== undefined) setLaybyCondition(s.laybyCondition);
      if (s.laybySurface !== undefined) setLaybySurface(s.laybySurface);
      if (s.laybyLength !== undefined) setLaybyLength(s.laybyLength);
      if (s.laybyDrainage !== undefined) setLaybyDrainage(s.laybyDrainage);
      // Bus stop
      if (s.busstopType !== undefined) setBusstopType(s.busstopType);
      if (s.busstopCondition !== undefined) setBusstopCondition(s.busstopCondition);
      if (s.busstopShelter !== undefined) setBusstopShelter(s.busstopShelter);
      if (s.busstopDrainage !== undefined) setBusstopDrainage(s.busstopDrainage);
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
      // Causeway
      if (s.causewayName !== undefined) setCausewayName(s.causewayName);
      if (s.causewayPipeMaterial !== undefined) setCausewayPipeMaterial(s.causewayPipeMaterial);
      if (s.causewayPipeDiameter !== undefined) setCausewayPipeDiameter(s.causewayPipeDiameter);
      if (s.causewayDrainage !== undefined) setCausewayDrainage(s.causewayDrainage);
      if (s.causewayServiceability !== undefined) setCausewayServiceability(s.causewayServiceability);
      // Drift
      if (s.driftName !== undefined) setDriftName(s.driftName);
      if (s.driftCondition !== undefined) setDriftCondition(s.driftCondition);
      if (s.driftSurface !== undefined) setDriftSurface(s.driftSurface);
      if (s.driftPassability !== undefined) setDriftPassability(s.driftPassability);
      if (s.driftWidth !== undefined) setDriftWidth(s.driftWidth);
      // Grid
      if (s.gridName !== undefined) setGridName(s.gridName);
      if (s.gridCondition !== undefined) setGridCondition(s.gridCondition);
      if (s.gridMaterial !== undefined) setGridMaterial(s.gridMaterial);
      if (s.gridOperational !== undefined) setGridOperational(s.gridOperational);
      // Traffic Lights
      if (s.trafficLightsLocation !== undefined) setTrafficLightsLocation(s.trafficLightsLocation);
      if (s.trafficLightsCondition !== undefined) setTrafficLightsCondition(s.trafficLightsCondition);
      if (s.trafficLightsOperational !== undefined) setTrafficLightsOperational(s.trafficLightsOperational);
      if (s.trafficLightsType !== undefined) setTrafficLightsType(s.trafficLightsType);
      if (s.trafficLightsPhases !== undefined) setTrafficLightsPhases(s.trafficLightsPhases);
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

  const handleCaptureGps = async () => {
    setIsCapturingGps(true);
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
        
        if (acc > gpsAccuracyLimit) {
          showToast(`❌ GPS accuracy ±${acc}m is too poor (target: ≤${gpsAccuracyLimit}m). Stand in open-sky area and try again!`, "error");
          setIsCapturingGps(false);
        } else {
          setGps(`${latitude.toFixed(6)} ${longitude.toFixed(6)} ${alt} ${acc}`);
          setIsCapturingGps(false);
          showToast(`🟢 High-precision GPS captured (accuracy: ±${acc}m)`, "success");
        }
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
            
            if (acc > gpsAccuracyLimit) {
              showToast(`❌ Browser GPS accuracy ±${acc}m is too poor (target: ≤${gpsAccuracyLimit}m). Try again!`, "error");
              setIsCapturingGps(false);
            } else {
              setGps(`${latitude.toFixed(6)} ${longitude.toFixed(6)} ${alt} ${acc}`);
              setIsCapturingGps(false);
              showToast("GPS Telemetry captured successfully!", "success");
            }
          },
          (webErr) => {
            console.error("Web fallback Geolocation failed:", webErr);
            simulateZimbabweGps();
          },
          { enableHighAccuracy: true, timeout: 8000 }
        );
      } else {
        simulateZimbabweGps();
      }
    }
  };

  const simulateZimbabweGps = () => {
    // Generate coordinates on routes between Harare (-17.8292, 31.0522) and Beitbridge (-22.2178, 30.0000)
    const lat = (-17.5 - Math.random() * 4.5).toFixed(6);
    const lng = (29.0 + Math.random() * 3.5).toFixed(6);
    const alt = Math.floor(400 + Math.random() * 1200);
    const acc = Math.floor(1 + Math.random() * 3); // 1, 2, or 3 (must be <= 3m)
    
    setGps(`${lat} ${lng} ${alt} ${acc}`);
    showToast("Simulated GPS coordinates captured on Zimbabwean highway.", "info");
    setIsCapturingGps(false);
  };

  const clearForm = () => {
    setSectionName("");
    setGps("");
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
    setSegmentGeometry(null);

    setSealedLength("");
    setSealedWidth("");
    setGravelLength("");
    setGravelWidth("");
    setEarthLength("");
    setEarthWidth("");
    setFootbridgeWidth("");
    setFootbridgeSpan("");
    setTollgateLanes("2");
    setTrafficLightsPhases("");
    setStreetlightCount("");
    setEditingDraftId(null);
    setSelectedCategory(null);
    setPhoto(null);
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
    if (draft.paved_road_name) return "sealed";
    return "sealed";
  };

  const handleEditDraft = (draft: SurveyDraft) => {
    setEditingDraftId(draft.id);
    
    setRoadName(draft.road_name);
    setSectionName(draft.section_name);
    setSurveyorName(draft.surveyor_name);
    setSurveyDate(draft.survey_date);
    setVegetation(draft.vegetation);
    setGps(draft.gps);
    setImageSadcCompliant(draft.image_SADC_compliant || "yes");
    setPhoto(draft.photo || null);

    const category = getDraftCategory(draft);
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
    } else if (category === "culvert") {
      setCulvertClass(draft.culvet_class || "pipe_culvert");
      setCulvertType(draft.culvet_type || "concrete");
      setCulvertServiceability(draft.culvet_serviceability || "good");
    } else if (category === "shelvet") {
      setShelvetType(draft.shelvets_type || "armco");
      setShelvetCondition(draft.shelvet_condition || "good");
    } else if (category === "sealed") {
      setSealedName(draft.paved_road_name || "");
      setSealedRoute(draft.Route_number_004 || "");
      setSealedClass(draft.paved_road_class || "secondary");
      setSealedType(draft.paved_road_type || "wide_mat_ss");
      setSealedClimate(draft.Climate_Region_001 || "moderate");
      setSealedTerrain(draft.Terrain_Type_002 || "flat");
      setSealedAuthority(draft.Authority_Name_002 || "rdc");
      setSealedLength(draft.Road_Length_km !== undefined ? String(draft.Road_Length_km) : "");
      setSealedWidth(draft.Road_width_m_002 !== undefined ? String(draft.Road_width_m_002) : "");
      setSealedDrainageType(draft.Drainage_Type_002_001 || "v_drain");
      setSealedVegetation(draft.servitude_vegetation_001 || "medium");
      setSealedNarrowCracks(draft.Narrow_cracks_degree || "no_cracks");
      setSealedWideCracks(draft.Wide_cracks_degree || "no_cracks");
      setSealedPotholesPatches(draft.Pothole_patches_degree || "good");
      setSealedRutting(draft.Rutting_degree || "no_rutting__5mm");
      setSealedEdgeBreaks(draft.Edge_breaks_Degree || "no_edge_break");
      setSealedEdgeDrop(draft.Edge_Drop_Degree || "no_edge_break");
      setSealedDrainage(draft.Drainage_001 || "good");
      setSealedRavelling(draft.Ravelling_Degree || "none");
      setSealedRidingQuality(draft.Riding_quality_degree_001 || "good");
      setSealedRoadMarkings(draft.Road_markings || "yes");
      setSealedRoadStuds(draft.Road_studs || "yes");
      setSealedPassability(draft.Passability_002 || "all_year_round");
      setSealedGrid(draft.Grid || "good");
      setSealedYearConstructed(draft.Year_constructed_to_sealed_standard !== undefined ? String(draft.Year_constructed_to_sealed_standard) : "");
    } else if (category === "gravel") {
      setGravelName(draft.gravel_road_name || "");
      setGravelRoute(draft.Route_Number || "");
      setGravelLength(draft.Road_Length !== undefined ? String(draft.Road_Length) : "");
      setGravelClass(draft.gravel_road_class || "urban_collector");
      setGravelAuthority(draft.Authority_Name || "rdc");
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
      setEarthAuthority(draft.earth_authority || "rdc");
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
      setRailCrossingType(draft.rail_crossing_type || "concrete");
      setRailCrossingCondition(draft.rail_crossing_condition || "good");
      setRailCrossingControl(draft.rail_crossing_control || "passive");
      setRailCrossingRoadClass(draft.rail_crossing_road_class || "secondary");
    } else if (category === "tollgate") {
      setTollgateName(draft.tollgate_name || "");
      setTollgateType(draft.tollgate_type || "booth");
      setTollgateCondition(draft.tollgate_condition || "good");
      setTollgateLanes(draft.tollgate_lanes !== undefined ? String(draft.tollgate_lanes) : "");
      setTollgateOperational(draft.tollgate_operational || "yes");
    } else if (category === "layby") {
      setLaybyCondition(draft.layby_condition || "good");
      setLaybySurface(draft.layby_surface || "gravel");
      setLaybyLength(draft.layby_length !== undefined ? String(draft.layby_length) : "");
      setLaybyDrainage(draft.layby_drainage || "good");
    } else if (category === "busstop") {
      setBusstopType(draft.busstop_type || "sheltered");
      setBusstopCondition(draft.busstop_condition || "good");
      setBusstopShelter(draft.busstop_shelter || "steel");
      setBusstopDrainage(draft.busstop_drainage || "good");
    } else if (category === "junction") {
      setJunctionType(draft.junction_type || "t_junction");
      setJunctionCondition(draft.junction_condition || "good");
      setJunctionControl(draft.junction_control || "give_way");
      setJunctionMarkings(draft.junction_road_markings || "good");
      setJunctionSignage(draft.junction_signage || "good");
    } else if (category === "sign") {
      setSignType(draft.sign_type || "regulatory");
      setSignCondition(draft.sign_condition || "good");
      setSignSadcCompliant(draft.sign_sadc_compliant || "yes");
      setSignVisibility(draft.sign_visibility || "good");
    } else if (category === "piped_causeway") {
      setCausewayName(draft.causeway_name || "");
      setCausewayPipeMaterial(draft.causeway_pipe_material || "concrete");
      setCausewayPipeDiameter(draft.causeway_pipe_diameter || "600");
      setCausewayDrainage(draft.causeway_drainage || "good");
      setCausewayServiceability(draft.causeway_serviceability || "good");
    } else if (category === "drift") {
      setDriftName(draft.drift_name || "");
      setDriftCondition(draft.drift_condition || "good");
      setDriftSurface(draft.drift_surface || "concrete");
      setDriftPassability(draft.drift_passability || "all_year");
      setDriftWidth(draft.drift_width !== undefined ? String(draft.drift_width) : "");
    } else if (category === "grid") {
      setGridName(draft.grid_name || "");
      setGridCondition(draft.grid_condition || "good");
      setGridMaterial(draft.grid_material || "steel");
      setGridOperational(draft.grid_operational || "yes");
    } else if (category === "traffic_lights") {
      setTrafficLightsLocation(draft.traffic_lights_location || "");
      setTrafficLightsCondition(draft.traffic_lights_condition || "good");
      setTrafficLightsOperational(draft.traffic_lights_operational || "yes");
      setTrafficLightsType(draft.traffic_lights_type || "standard");
      setTrafficLightsPhases(draft.traffic_lights_phases !== undefined ? String(draft.traffic_lights_phases) : "");
    } else if (category === "streetlight") {
      setStreetlightType(draft.streetlight_type || "led");
      setStreetlightCondition(draft.streetlight_condition || "good");
      setStreetlightPowerSource(draft.streetlight_power_source || "grid");
      setStreetlightOperational(draft.streetlight_operational || "yes");
      setStreetlightCount(draft.streetlight_count !== undefined ? String(draft.streetlight_count) : "");
    }

    setActiveTab("form");
    showToast(`Loaded draft for editing.`, "info");
  };

  const handleSaveForm = (e: React.FormEvent, saveAsDraft: boolean) => {
    e.preventDefault();

    if (!saveAsDraft) {
      if (!sectionName) {
        showToast("Section Name is required", "error");
        return;
      }
      if (!surveyorName) {
        showToast("Surveyor Name is required", "error");
        return;
      }

      if (isRoadType) {
        // Road surveys: GPS is derived from segment geometry — no separate point capture needed
        if (!segmentGeometry || segmentGeometry.points.length === 0) {
          showToast("🛰 Please complete the GPS segment recording before queueing.", "error");
          return;
        }
        // Auto-populate GPS from the first segment point
        const firstPt = segmentGeometry.points[0];
        const derivedGps = `${firstPt.lat.toFixed(6)} ${firstPt.lng.toFixed(6)} ${firstPt.alt ?? 1200} ${Math.round(firstPt.acc)}`;
        setGps(derivedGps);
      } else {
        // Non-road surveys: require explicit GPS point capture
        if (!gps) {
          showToast("GPS location coordinates must be captured.", "error");
          return;
        }
        // Validate that the captured GPS meets the accuracy requirement
        const gpsParts = gps.trim().split(" ");
        const gpsAcc = gpsParts.length >= 4 ? parseFloat(gpsParts[3]) : NaN;
        if (!isNaN(gpsAcc) && gpsAcc > gpsAccuracyLimit) {
          showToast(`❌ GPS accuracy ±${Math.round(gpsAcc)}m is too poor (≤${gpsAccuracyLimit}m required). Re-capture GPS in open-sky area.`, "error");
          return;
        }
      }
    }

    const baseData = {
      asset_category: assetCategory,
      road_name: roadName,
      section_name: sectionName || "(Incomplete Draft)",
      surveyor_name: surveyorName || "(Draft Surveyor)",
      survey_date: surveyDate,
      vegetation,
      gps: gps || "",
      image_SADC_compliant: imageSadcCompliant,
      photo: photo || undefined,
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
      };
    } else if (assetCategory === "culvert") {
      draftData = {
        ...baseData,
        culvet_class: culvertClass,
        culvet_type: culvertType,
        culvet_serviceability: culvertServiceability,
      };
    } else if (assetCategory === "shelvet") {
      draftData = {
        ...baseData,
        shelvets_type: shelvetType,
        shelvet_condition: shelvetCondition,
      };
    } else if (assetCategory === "sealed") {
      const finalSealedName = sealedName || roadName.split(" (")[0];
      draftData = {
        ...baseData,
        // Flat normal keys
        paved_road_name: finalSealedName,
        paved_road_class: sealedClass,
        paved_road_type: sealedType,
        paved_road_condition: sealedRidingQuality,
        pothole_patches: sealedPotholesPatches,
        vegetation: sealedVegetation,

        // KoBo raw keys
        Road_Name_002: finalSealedName,
        Route_number_004: sealedRoute || "A4",
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
        Grid: sealedGrid,
        Year_constructed_to_sealed_standard: sealedYearConstructed ? parseInt(sealedYearConstructed) : undefined,
      };
    } else if (assetCategory === "gravel") {
      const finalGravelName = gravelName || roadName.split(" (")[0];
      draftData = {
        ...baseData,
        // Flat normal keys
        gravel_road_name: finalGravelName,
        gravel_road_class: gravelClass,
        gravel_thickness: gravelThickness,
        gravel_condition: gravelRidingQuality,
        drainage_condition: gravelDrainageCond,
        vegetation: gravelVegetation,

        // KoBo raw keys
        Road_Name: finalGravelName,
        Route_Number: gravelRoute || "A4",
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
      };
    } else if (assetCategory === "earth") {
      draftData = {
        ...baseData,
        earth_road_name: earthName || roadName.split(" (")[0],
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
      };
    } else if (assetCategory === "layby") {
      draftData = {
        ...baseData,
        layby_condition: laybyCondition,
        layby_surface: laybySurface,
        layby_length: laybyLength ? parseFloat(laybyLength) : undefined,
        layby_drainage: laybyDrainage,
      };
    } else if (assetCategory === "busstop") {
      draftData = {
        ...baseData,
        busstop_type: busstopType,
        busstop_condition: busstopCondition,
        busstop_shelter: busstopShelter,
        busstop_drainage: busstopDrainage,
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
      };
    } else if (assetCategory === "piped_causeway") {
      draftData = {
        ...baseData,
        causeway_name: causewayName,
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
      };
    } else if (assetCategory === "grid") {
      draftData = {
        ...baseData,
        grid_name: gridName,
        grid_condition: gridCondition,
        grid_material: gridMaterial,
        grid_operational: gridOperational,
      };
    } else if (assetCategory === "traffic_lights") {
      draftData = {
        ...baseData,
        traffic_lights_location: trafficLightsLocation,
        traffic_lights_condition: trafficLightsCondition,
        traffic_lights_operational: trafficLightsOperational,
        traffic_lights_type: trafficLightsType,
        traffic_lights_phases: trafficLightsPhases ? parseInt(trafficLightsPhases) : undefined,
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
    clearForm();
  };

  const handleDeleteDraft = (id: string) => {
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
      traffic_lights: "survey_traffic_lights",
      streetlight: "survey_streetlights"
    };

    const mapDraftToSupabaseTable = (draft: any, tableName: string) => {
      const row: any = {
        survey_id:            draft.id,
        asset_category:       draft.asset_category || Object.keys(categoryToTable).find(k => categoryToTable[k] === tableName) || null,
        road_name:            draft.road_name || null,
        section_name:         draft.section_name || null,
        surveyor_name:        draft.surveyor_name || null,
        survey_date:          draft.survey_date || null,
        gps_point:            draft.gps || null,
        image_sadc_compliant: draft.image_SADC_compliant || draft.image_sadc_compliant || "yes",
        photo:                draft.photo || null,
        raw_data:             draft,
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
        row.grid = draft.Grid || null;
        row.year_constructed_to_sealed_standard = draft.Year_constructed_to_sealed_standard !== undefined ? Number(draft.Year_constructed_to_sealed_standard) : null;
        row.last_surface_year = draft.Last_surface_year !== undefined ? Number(draft.Last_surface_year) : null;
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
      else if (draft.shelvets_type) draftName = `Shelvet: ${draft.shelvets_type}`;
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
          <img src="/coat_of_arms.png" alt="Zimbabwe Coat of Arms" className="mobile-coat" />
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
                src="/coat_of_arms.png" 
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
                  { id: "all", label: "All Assets", count: 18 },
                  { id: "roads", label: "Roads", count: 3 },
                  { id: "structures", label: "Structures", count: 4 },
                  { id: "drainage", label: "Drainage", count: 5 },
                  { id: "traffic", label: "Traffic", count: 2 },
                  { id: "amenities", label: "Amenities", count: 4 }
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
                        setSelectedCategory(asset.id);
                        setAssetCategory(asset.id as any);
                        setSegmentGeometry(null);
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
              <select value={roadName} onChange={(e) => setRoadName(e.target.value)} className="mobile-select">
                <option value="A4 Highway (Harare - Masvingo - Beitbridge)">A4 (Harare - Beitbridge)</option>
                <option value="A1 Highway (Harare - Chirundu)">A1 (Harare - Chirundu)</option>
                <option value="A3 Highway (Harare - Bulawayo)">A3 (Harare - Bulawayo)</option>
                <option value="A5 Highway (Harare - Mutare)">A5 (Harare - Mutare)</option>
                <option value="A2 Highway (Harare - Nyamapanda)">A2 (Harare - Nyamapanda)</option>
              </select>
            </div>

            <div className="mobile-form-group">
              <label className="mobile-label">Section / Chainage Name</label>
              <input
                type="text"
                placeholder="e.g. Marondera - Rusape Section"
                value={sectionName}
                onChange={(e) => setSectionName(e.target.value)}
                className="mobile-input"
                required
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="mobile-form-group">
                <label className="mobile-label">Surveyor Name</label>
                <input
                  type="text"
                  placeholder="e.g. Eng. Rondozai"
                  value={surveyorName}
                  onChange={(e) => setSurveyorName(e.target.value)}
                  className="mobile-input"
                  required
                />
              </div>
              <div className="mobile-form-group">
                <label className="mobile-label">Survey Date</label>
                <input
                  type="date"
                  value={surveyDate}
                  onChange={(e) => setSurveyDate(e.target.value)}
                  className="mobile-input"
                  required
                />
              </div>
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
              <div className="mobile-form-group">
                <label className="mobile-label">Vegetation Status</label>
                <select value={vegetation} onChange={(e) => setVegetation(e.target.value)} className="mobile-select">
                  <option value="none">None</option>
                  <option value="light">Light</option>
                  <option value="medium">Medium</option>
                  <option value="dense">Dense</option>
                </select>
              </div>
              <div className="mobile-form-group">
                <label className="mobile-label">SADC Sign Compliant</label>
                <select
                  value={imageSadcCompliant}
                  onChange={(e) => setImageSadcCompliant(e.target.value as any)}
                  className="mobile-select"
                >
                  <option value="yes">Yes (Compliant)</option>
                  <option value="no">No (Non-Compliant)</option>
                </select>
              </div>
            </div>

            {/* Geolocation Input — hidden for road types (GPS is captured via segment tracker) */}
            {!isRoadType && (
              <div className="mobile-form-group">
                <label className="mobile-label">GPS Geolocation</label>
                <div style={{ display: "flex", gap: "8px" }}>
                  <input
                    type="text"
                    placeholder="Capture telemetry location"
                    value={gps}
                    readOnly
                    className="mobile-input"
                    style={{ background: "var(--accent-emerald)", color: "#ffffff", fontWeight: "600", border: "none" }}
                  />
                  <button
                    type="button"
                    onClick={handleCaptureGps}
                    disabled={isCapturingGps}
                    className="mobile-btn"
                    style={{ width: "42px", height: "38px", padding: 0 }}
                  >
                    {isCapturingGps ? (
                      <div className="spinner"></div>
                    ) : (
                      <Compass size={16} />
                    )}
                  </button>
                </div>
                <span style={{ fontSize: "9px", color: "var(--text-muted)", marginTop: "4px", display: "block" }}>
                  🛰 Requires high-precision GPS signal (accuracy ≤ 3.0 m)
                </span>
              </div>
            )}

            {/* Optional Photo Capture */}
            <div className="mobile-form-group">
              <label className="mobile-label">Photo (Optional)</label>
              {photo ? (
                <div style={{ position: "relative", marginTop: "6px", borderRadius: "var(--radius-md)", overflow: "hidden", border: "1px solid var(--border-color)", width: "100%", height: "150px", boxShadow: "0 2px 8px rgba(0,0,0,0.1)" }}>
                  <img src={photo} alt="Asset preview" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <button
                    type="button"
                    onClick={() => setPhoto(null)}
                    style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(220, 38, 38, 0.9)", border: "none", borderRadius: "50%", width: "28px", height: "28px", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: "#ffffff", boxShadow: "0 2px 4px rgba(0,0,0,0.2)" }}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              ) : (
                <div style={{ marginTop: "6px" }}>
                  <label
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "center",
                      height: "100px",
                      border: "2px dashed var(--border-color)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--bg-card)",
                      cursor: "pointer",
                      gap: "8px",
                      transition: "all 0.2s"
                    }}
                    onMouseOver={(e) => {
                      e.currentTarget.style.borderColor = "var(--accent-emerald)";
                      e.currentTarget.style.background = "rgba(16, 185, 129, 0.04)";
                    }}
                    onMouseOut={(e) => {
                      e.currentTarget.style.borderColor = "var(--border-color)";
                      e.currentTarget.style.background = "var(--bg-card)";
                    }}
                  >
                    <Camera size={20} color="var(--text-muted)" />
                    <span style={{ fontSize: "11px", fontWeight: "600", color: "var(--text-secondary)" }}>Take Photo or Upload Image</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          const reader = new FileReader();
                          reader.onloadend = () => {
                            setPhoto(reader.result as string);
                          };
                          reader.readAsDataURL(file);
                        }
                      }}
                      style={{ display: "none" }}
                    />
                  </label>
                </div>
              )}
            </div>

            {/* GPS Segment Tracker — Sealed / Gravel / Earth roads only */}
            {isRoadType && (
              <SegmentTracker
                roadLabel={
                  assetCategory === "sealed" ? "Sealed Road"
                  : assetCategory === "gravel" ? "Gravel Road"
                  : "Earth Road"
                }
                onSegmentComplete={(geo) => setSegmentGeometry(geo)}
                onReset={() => setSegmentGeometry(null)}
                existingGeometry={segmentGeometry}
                accuracyThreshold={gpsAccuracyLimit}
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
                    <label className="mobile-label">Crossing Type</label>
                    <select value={bridgeCrossing} onChange={(e) => setBridgeCrossing(e.target.value)} className="mobile-select">
                      <option value="river">River Crossing</option>
                      <option value="road">Road flyover</option>
                      <option value="rail">Railway flyover</option>
                      <option value="other">Other</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Deck Type</label>
                    <select value={bridgeType} onChange={(e) => setBridgeType(e.target.value)} className="mobile-select">
                      <option value="hldc">HLDC Deck</option>
                      <option value="sldc">SLDC Deck</option>
                      <option value="slc">SLC Deck</option>
                    </select>
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
                  <label className="mobile-label">Culvert Class</label>
                  <select value={culvertClass} onChange={(e) => setCulvertClass(e.target.value)} className="mobile-select">
                    <option value="box_culvert">Box Culvert</option>
                    <option value="pipe_culvert">Pipe Culvert</option>
                  </select>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-label">Material Type</label>
                  <select value={culvertType} onChange={(e) => setCulvertType(e.target.value)} className="mobile-select">
                    <option value="concrete">Concrete</option>
                    <option value="steel">Steel</option>
                    <option value="masonry">Masonry</option>
                    <option value="corrugated_metal">Corrugated Metal</option>
                    <option value="other">Other</option>
                  </select>
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
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Shelvet properties</legend>
                
                <div className="mobile-form-group">
                  <label className="mobile-label">Shelvet material/type</label>
                  <select value={shelvetType} onChange={(e) => setShelvetType(e.target.value)} className="mobile-select">
                    <option value="armco">Armco steel pipe</option>
                    <option value="shelvets">Masonry shelvets</option>
                    <option value="concrete">Concrete shelvets</option>
                  </select>
                </div>

                <div className="mobile-form-group">
                  <label className="mobile-label">Condition State</label>
                  <select value={shelvetCondition} onChange={(e) => setShelvetCondition(e.target.value)} className="mobile-select">
                    <option value="good">Good (Dry/Solid)</option>
                    <option value="corroded">Corroded / Rusty</option>
                    <option value="collapsed">Collapsed structural frame</option>
                  </select>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Sealed Road */}
            {assetCategory === "sealed" && segmentGeometry && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Sealed Road Properties</legend>

                <div className="mobile-form-group">
                  <label className="mobile-label">Sealed Road Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Harare - Masvingo Highway Section"
                    value={sealedName}
                    onChange={(e) => setSealedName(e.target.value)}
                    className="mobile-input"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Route Number</label>
                    <input
                      type="text"
                      placeholder="e.g. A4"
                      value={sealedRoute}
                      onChange={(e) => setSealedRoute(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Class</label>
                    <select value={sealedClass} onChange={(e) => setSealedClass(e.target.value)} className="mobile-select">
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="tertiary_feeder">Tertiary Feeder</option>
                      <option value="tertiary_access">Tertiary Access</option>
                      <option value="urban_arterial">Urban Arterial</option>
                      <option value="urban_collector">Urban Collector</option>
                      <option value="urban_local">Urban Local</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Type</label>
                    <select value={sealedType} onChange={(e) => setSealedType(e.target.value)} className="mobile-select">
                      <option value="wide_mat_ss">Wide Mat SS</option>
                      <option value="wide_mat_gs">Wide Mat GS</option>
                      <option value="narrow_mat">Narrow Mat</option>
                      <option value="strip">Strip</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Climate Region</label>
                    <select value={sealedClimate} onChange={(e) => setSealedClimate(e.target.value)} className="mobile-select">
                      <option value="dry">Dry</option>
                      <option value="moderate">Moderate</option>
                      <option value="wet">Wet</option>
                      <option value="very_wet">Very Wet</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Terrain Type</label>
                    <select value={sealedTerrain} onChange={(e) => setSealedTerrain(e.target.value)} className="mobile-select">
                      <option value="flat">Flat</option>
                      <option value="undulating">Undulating</option>
                      <option value="mountainous">Mountainous</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Authority Name</label>
                    <select value={sealedAuthority} onChange={(e) => setSealedAuthority(e.target.value)} className="mobile-select">
                      <option value="rdc">RDC</option>
                      <option value="mot">MOT</option>
                      <option value="ddf">DDF</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Length (km)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 15.5"
                      value={sealedLength}
                      onChange={(e) => setSealedLength(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Width (m)</label>
                    <input
                      type="number"
                      step="any"
                      placeholder="e.g. 7.2"
                      value={sealedWidth}
                      onChange={(e) => setSealedWidth(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage Type</label>
                    <select value={sealedDrainageType} onChange={(e) => setSealedDrainageType(e.target.value)} className="mobile-select">
                      <option value="no_drain">No drain</option>
                      <option value="v_drain">V-drain</option>
                      <option value="trapezoidal">Trapezoidal</option>
                      <option value="piped_kerb">Piped Kerb</option>
                      <option value="fnfc">fnfc</option>
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
                    <label className="mobile-label">Narrow Cracks</label>
                    <select value={sealedNarrowCracks} onChange={(e) => setSealedNarrowCracks(e.target.value)} className="mobile-select">
                      <option value="no_cracks">No cracks</option>
                      <option value="faint_cracks">Faint cracks</option>
                      <option value="distinct_cracks_up_to_1mm">Distinct cracks up to 1mm</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Wide Cracks</label>
                    <select value={sealedWideCracks} onChange={(e) => setSealedWideCracks(e.target.value)} className="mobile-select">
                      <option value="no_cracks">No cracks</option>
                      <option value="cracks_3_5mm">Cracks 3-5mm</option>
                      <option value="cracks_5_10mm">Cracks 5-10mm</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Pothole / Patches</label>
                    <select value={sealedPotholesPatches} onChange={(e) => setSealedPotholesPatches(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Rutting Degree</label>
                    <select value={sealedRutting} onChange={(e) => setSealedRutting(e.target.value)} className="mobile-select">
                      <option value="no_rutting__5mm">No rutting &lt;5mm</option>
                      <option value="discernible_5_15mm">Discernible 5-15mm</option>
                      <option value="large_15_25mm">Large 15-25mm</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Edge Breaks Degree</label>
                    <select value={sealedEdgeBreaks} onChange={(e) => setSealedEdgeBreaks(e.target.value)} className="mobile-select">
                      <option value="no_edge_break">No edge break</option>
                      <option value="up_to_50mm">Up to 50mm</option>
                      <option value="50_100mm_break">50-100mm break</option>
                      <option value="__100mm">&gt; 100mm</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Edge Drop Degree</label>
                    <select value={sealedEdgeDrop} onChange={(e) => setSealedEdgeDrop(e.target.value)} className="mobile-select">
                      <option value="no_edge_break">No edge break</option>
                      <option value="up_to_50mm">Up to 50mm</option>
                      <option value="50_100mm_break">50-100mm break</option>
                      <option value="__100mm">&gt; 100mm</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Drainage status</label>
                    <select value={sealedDrainage} onChange={(e) => setSealedDrainage(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                      <option value="eroded">Eroded</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Ravelling Degree</label>
                    <select value={sealedRavelling} onChange={(e) => setSealedRavelling(e.target.value)} className="mobile-select">
                      <option value="none">None</option>
                      <option value="minor">Minor</option>
                      <option value="major">Major</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road markings</label>
                    <select value={sealedRoadMarkings} onChange={(e) => setSealedRoadMarkings(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road studs</label>
                    <select value={sealedRoadStuds} onChange={(e) => setSealedRoadStuds(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Passability</label>
                    <select value={sealedPassability} onChange={(e) => setSealedPassability(e.target.value)} className="mobile-select">
                      <option value="all_year_round">All year round</option>
                      <option value="dry_season_only">Dry season only</option>
                      <option value="wet_season_only">Wet Season only</option>
                      <option value="rupture">Rupture</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Grid</label>
                    <select value={sealedGrid} onChange={(e) => setSealedGrid(e.target.value)} className="mobile-select">
                      <option value="good">Good</option>
                      <option value="fair">Fair</option>
                      <option value="poor">Poor</option>
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Year Sealed</label>
                    <input
                      type="number"
                      placeholder="e.g. 2015"
                      value={sealedYearConstructed}
                      onChange={(e) => setSealedYearConstructed(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Riding Quality</label>
                    <select value={sealedRidingQuality} onChange={(e) => setSealedRidingQuality(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                      <option value="good">GOOD</option>
                      <option value="fair">FAIR</option>
                      <option value="poor">POOR</option>
                    </select>
                  </div>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Gravel Road */}
            {assetCategory === "gravel" && segmentGeometry && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Gravel Road Properties</legend>

                <div className="mobile-form-group">
                  <label className="mobile-label">Gravel Road Name</label>
                  <input
                    type="text"
                    placeholder="e.g. Delport Gravel Road"
                    value={gravelName}
                    onChange={(e) => setGravelName(e.target.value)}
                    className="mobile-input"
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Route Number</label>
                    <input
                      type="text"
                      placeholder="e.g. Route 3"
                      value={gravelRoute}
                      onChange={(e) => setGravelRoute(e.target.value)}
                      className="mobile-input"
                    />
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Road Class</label>
                    <select value={gravelClass} onChange={(e) => setGravelClass(e.target.value)} className="mobile-select">
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="tertiary_feeder">Tertiary Feeder</option>
                      <option value="tertiary_access">Tertiary Access</option>
                      <option value="urban_arterial">Urban Arterial</option>
                      <option value="urban_collector">Urban Collector</option>
                      <option value="urban_local">Urban Local</option>
                      <option value="industrial">Industrial</option>
                    </select>
                  </div>
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
                    <select value={gravelAuthority} onChange={(e) => setGravelAuthority(e.target.value)} className="mobile-select">
                      <option value="rdc">RDC</option>
                      <option value="mot">MOT</option>
                      <option value="ddf">DDF</option>
                    </select>
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
                      <option value="no_drain">No drain</option>
                      <option value="v_drain">V-drain</option>
                      <option value="trapezoidal">Trapezoidal</option>
                      <option value="piped_kerb">Piped Kerb</option>
                      <option value="fnfc">fnfc</option>
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
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Passability</label>
                    <select value={gravelPassability} onChange={(e) => setGravelPassability(e.target.value)} className="mobile-select">
                      <option value="all_year_round">All year round</option>
                      <option value="dry_season_only">Dry season only</option>
                      <option value="wet_season_only">Wet Season only</option>
                      <option value="rupture">Rupture</option>
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
                  <select value={gravelRidingQuality} onChange={(e) => setGravelRidingQuality(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                    <option value="good">GOOD</option>
                    <option value="fair">FAIR</option>
                    <option value="poor">POOR</option>
                  </select>
                </div>
              </fieldset>
            )}

            {/* Conditional Form: Earth Roads */}
            {assetCategory === "earth" && segmentGeometry && (
              <fieldset style={{ border: "1px solid var(--border-color)", padding: "12px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "10px" }}>
                <legend style={{ fontSize: "10px", fontWeight: "700", textTransform: "uppercase", color: "var(--text-accent)", padding: "0 6px" }}>Earth Road Properties</legend>
                <div className="mobile-form-group">
                  <label className="mobile-label">Earth Road Name</label>
                  <input type="text" placeholder="e.g. Chivake - Mupfure Earth Road" value={earthName} onChange={(e) => setEarthName(e.target.value)} className="mobile-input" />
                </div>
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
                    <select value={earthAuthority} onChange={(e) => setEarthAuthority(e.target.value)} className="mobile-select">
                      <option value="rdc">RDC</option>
                      <option value="mot">MOT</option>
                      <option value="ddf">DDF</option>
                    </select>
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
                      <option value="no_drain">No drain</option>
                      <option value="v_drain">V-drain</option>
                      <option value="trapezoidal">Trapezoidal</option>
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
                      <option value="dry_season_only">Dry Season Only</option>
                      <option value="rupture">Rupture</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Year Constructed</label>
                    <input type="number" placeholder="e.g. 1998" value={earthYearConstructed} onChange={(e) => setEarthYearConstructed(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div className="mobile-form-group">
                  <label className="mobile-label" style={{ color: "var(--text-accent)" }}>Overall Condition</label>
                  <select value={earthCondition} onChange={(e) => setEarthCondition(e.target.value)} className="mobile-select" style={{ borderColor: "var(--accent-emerald)" }}>
                    <option value="good">GOOD</option>
                    <option value="fair">FAIR</option>
                    <option value="poor">POOR</option>
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
                      <option value="primary">Primary</option>
                      <option value="secondary">Secondary</option>
                      <option value="tertiary_feeder">Tertiary Feeder</option>
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
                    <label className="mobile-label">Signage Present</label>
                    <select value={junctionSignage} onChange={(e) => setJunctionSignage(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="partial">Partial</option>
                      <option value="no">No</option>
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
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
                  <div className="mobile-form-group">
                    <label className="mobile-label">Sign Type</label>
                    <select value={signType} onChange={(e) => setSignType(e.target.value)} className="mobile-select">
                      <option value="warning">Warning</option>
                      <option value="regulatory">Regulatory</option>
                      <option value="informatory">Informatory</option>
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
                    <select value={signSadcCompliant} onChange={(e) => setSignSadcCompliant(e.target.value)} className="mobile-select">
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
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
                    <label className="mobile-label">Surface Type</label>
                    <select value={driftSurface} onChange={(e) => setDriftSurface(e.target.value)} className="mobile-select">
                      <option value="concrete">Concrete</option>
                      <option value="masonry">Masonry</option>
                      <option value="earth">Earth</option>
                      <option value="natural">Natural Rock</option>
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
                      <option value="solar">Solar Powered</option>
                      <option value="pedestrian">Pedestrian Signal</option>
                      <option value="flashing">Flashing Amber</option>
                    </select>
                  </div>
                  <div className="mobile-form-group">
                    <label className="mobile-label">No. of Phases</label>
                    <input type="number" min="2" max="6" placeholder="e.g. 3" value={trafficLightsPhases} onChange={(e) => setTrafficLightsPhases(e.target.value)} className="mobile-input" />
                  </div>
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px" }}>
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
                    <label className="mobile-label">No. of Streetlights</label>
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
                  else if (draft.shelvets_type) title = `Shelvet: ${draft.shelvets_type}`;
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
                  
                  return (
                    <div key={draft.id} className="queue-item" style={{ display: "flex", gap: "10px", alignItems: "center" }}>
                      {draft.photo ? (
                        <img src={draft.photo} alt="Thumbnail" style={{ width: "38px", height: "38px", borderRadius: "6px", objectFit: "cover", flexShrink: 0, border: "1px solid var(--border-color)" }} />
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
                        <span style={{ fontSize: "9px", color: "var(--text-accent)", marginTop: "2px" }}>
                          Surveyed on {draft.survey_date}
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

              <button
                type="button"
                onClick={() => window.open("https://wa.me/263773807928", "_blank")}
                className="mobile-btn"
                style={{
                  width: "100%",
                  height: "38px",
                  padding: 0,
                  background: "#25D366", // WhatsApp Official Green
                  color: "#ffffff",
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  gap: "8px",
                  fontWeight: 700,
                  border: "none",
                  borderRadius: "var(--radius-sm)",
                  cursor: "pointer"
                }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M.057 24l1.687-6.163c-1.041-1.804-1.588-3.849-1.587-5.946C.06 5.348 5.397.01 12.008.01c3.202.001 6.212 1.246 8.477 3.514 2.266 2.268 3.507 5.28 3.505 8.484-.004 6.657-5.34 11.997-11.953 11.997-2.005-.001-3.973-.502-5.724-1.455L0 24zm6.59-4.846c1.6.95 3.188 1.449 4.825 1.451 5.436 0 9.86-4.37 9.864-9.799.002-2.63-1.023-5.101-2.885-6.965C16.488 1.977 14.03 .953 11.469.953c-5.442 0-9.866 4.372-9.87 9.802 0 1.63.45 3.22 1.302 4.621L1.87 21.325l6.096-1.597zM18.667 15.11c-.347-.171-2.046-1.002-2.364-1.117-.317-.115-.549-.171-.78.171-.23.343-.89 1.117-1.091 1.346-.202.228-.405.257-.752.086-2.023-1.004-3.327-2.37-4.664-4.646-.35-.597.35-.554 1.003-1.848.1-.2.05-.375-.025-.547-.075-.171-.78-1.868-1.068-2.559-.28-.674-.564-.582-.78-.593-.2-.01-.43-.012-.662-.012-.23 0-.606.086-.924.429-.317.343-1.214 1.173-1.214 2.862 0 1.688 1.242 3.322 1.415 3.55 1.73 2.247 3.3 3.447 5.228 4.195.952.37 1.848.423 2.535.32 1.096-.164 2.364-.954 2.696-1.876.33-.923.33-1.714.23-1.876-.1-.162-.367-.257-.714-.428z"/>
                </svg>
                <span>Contact Developer Support</span>
              </button>
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
