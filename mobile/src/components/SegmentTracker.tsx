import { useState, useEffect, useRef, useCallback } from "react";
import { Geolocation } from "@capacitor/geolocation";
import { BackgroundGeolocation } from "@capgo/background-geolocation";
import { App as CapApp } from "@capacitor/app";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import "leaflet-textpath";
import { MapPin, Navigation, Square, Plus, CheckCircle2, Activity, Gauge, Clock, Wifi, Pause, Play, MapPinned } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SegmentPoint {
  lat: number;
  lng: number;
  alt?: number;
  acc: number;
  ts: number;
  orig_lat?: number;
  orig_lng?: number;
}

export interface SegmentGeometry {
  points: SegmentPoint[];
  geojson: string;
  length_m: number;
  start_time: string;
  end_time: string;
  avg_accuracy_m: number;
  point_count: number;
}

interface Props {
  roadLabel: string;
  onSegmentComplete: (geo: SegmentGeometry) => void;
  onReset: () => void;
  existingGeometry?: SegmentGeometry | null;
  accuracyThreshold?: number;
  /** Fired when user pauses tracking (points are preserved in localStorage). */
  onSegmentPaused?: (info: { pointCount: number; length_m: number }) => void;
  /** Fired when user wants to collect a point asset along the paused route. */
  onCollectPointAlongRoute?: () => void;
}

type Phase = "idle" | "tracking" | "paused" | "completed";

export const SEGMENT_SESSION_KEY = "roads_active_segment";
export const PAUSED_ROAD_CONTEXT_KEY = "roads_paused_road_context";

// ─── Constants ────────────────────────────────────────────────────────────────

const MIN_DISTANCE_M = 3;        // minimum metres between consecutive auto-points
const AUTO_ADD_INTERVAL_MS = 3000; // auto-add interval in ms
const SESSION_PERSIST_EVERY_N = 5; // persist to localStorage every N new points added

// ─── Helpers ─────────────────────────────────────────────────────────────────

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function totalDistance(pts: SegmentPoint[]): number {
  let d = 0;
  for (let i = 1; i < pts.length; i++)
    d += haversine(pts[i - 1].lat, pts[i - 1].lng, pts[i].lat, pts[i].lng);
  return Math.round(d);
}

function toGeoJSON(pts: SegmentPoint[]): string {
  return JSON.stringify({
    type: "Feature",
    geometry: {
      type: "LineString",
      coordinates: pts.map((p) => [p.lng, p.lat, p.alt ?? 0]),
    },
    properties: {
      point_count: pts.length,
      length_m: totalDistance(pts),
    },
  });
}

function fmtElapsed(s: number): string {
  const m = Math.floor(s / 60);
  return `${m}:${(s % 60).toString().padStart(2, "0")}`;
}

function fmtDist(m: number): string {
  return m >= 1000 ? `${(m / 1000).toFixed(3)} km` : `${m} m`;
}

function getLineStringBBox(coordinates: number[][]): [number, number, number, number] {
  let minLon = Infinity, minLat = Infinity;
  let maxLon = -Infinity, maxLat = -Infinity;
  for (let i = 0; i < coordinates.length; i++) {
    const [lon, lat] = coordinates[i];
    if (lon < minLon) minLon = lon;
    if (lat < minLat) minLat = lat;
    if (lon > maxLon) maxLon = lon;
    if (lat > maxLat) maxLat = lat;
  }
  return [minLon, minLat, maxLon, maxLat];
}

// Snapping Math Engine Helpers
function projectPointOnSegment(
  p: { lat: number; lng: number },
  a: [number, number], // [lng, lat]
  b: [number, number]  // [lng, lat]
): { lat: number; lng: number } {
  const A_lng = a[0];
  const A_lat = a[1];
  const B_lng = b[0];
  const B_lat = b[1];

  const dLat = B_lat - A_lat;
  const dLng = B_lng - A_lng;

  if (dLat === 0 && dLng === 0) {
    return { lat: A_lat, lng: A_lng };
  }

  let t = ((p.lat - A_lat) * dLat + (p.lng - A_lng) * dLng) / (dLat * dLat + dLng * dLng);
  t = Math.max(0, Math.min(1, t)); // clamp to segment bounds

  return {
    lat: A_lat + t * dLat,
    lng: A_lng + t * dLng
  };
}

function findClosestSnappedPoint(
  lat: number,
  lng: number,
  roads: any[],
  maxDistMeters: number = 50
): { lat: number; lng: number; dist: number; roadName: string } | null {
  if (!roads || roads.length === 0) return null;

  let bestPoint: { lat: number; lng: number } | null = null;
  let bestDist = Infinity;
  let bestRoadName = "Unnamed Road";

  const buffer = 0.002; // bounding box buffer (approx 220m)

  for (let i = 0; i < roads.length; i++) {
    const road = roads[i];
    if (!road.bbox) continue;

    const [minLon, minLat, maxLon, maxLat] = road.bbox;
    if (
      lng < minLon - buffer ||
      lng > maxLon + buffer ||
      lat < minLat - buffer ||
      lat > maxLat + buffer
    ) {
      continue;
    }

    const coords = road.geometry?.coordinates;
    if (!coords || coords.length < 2) continue;

    const roadName = road.properties?.name || "Existing Road";

    for (let j = 0; j < coords.length - 1; j++) {
      const ptA = coords[j];
      const ptB = coords[j + 1];

      const projected = projectPointOnSegment({ lat, lng }, ptA, ptB);
      const dist = haversine(lat, lng, projected.lat, projected.lng);

      if (dist < bestDist) {
        bestDist = dist;
        bestPoint = projected;
        bestRoadName = roadName;
      }
    }
  }

  if (bestPoint && bestDist <= maxDistMeters) {
    return {
      lat: bestPoint.lat,
      lng: bestPoint.lng,
      dist: bestDist,
      roadName: bestRoadName
    };
  }

  return null;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function SegmentTracker({
  roadLabel,
  onSegmentComplete,
  onReset,
  existingGeometry,
  accuracyThreshold = 3.0,
  onSegmentPaused,
  onCollectPointAlongRoute,
}: Props) {
  const [phase, setPhase] = useState<Phase>(existingGeometry ? "completed" : "idle");
  const [points, setPoints] = useState<SegmentPoint[]>(existingGeometry?.points ?? []);
  const [currentPos, setCurrentPos] = useState<SegmentPoint | null>(null);
  const [currentAcc, setCurrentAcc] = useState<number | null>(null);
  const [elapsed, setElapsed] = useState(0);
  const [statusMsg, setStatusMsg] = useState("");
  const [autoAdded, setAutoAdded] = useState(0);
  const [manualAdded, setManualAdded] = useState(0);
  const [completedGeo, setCompletedGeo] = useState<SegmentGeometry | null>(existingGeometry ?? null);
  const [trackingMode, setTrackingMode] = useState<"auto" | "manual">("auto");
  const [isReconnecting, setIsReconnecting] = useState(false);

  const watchIdRef = useRef<string | null>(null);
  const trackingModeRef = useRef<"auto" | "manual">("auto");
  const startTimeRef = useRef<string>("");
  const pointsSinceLastPersistRef = useRef<number>(0);
  const phaseRef = useRef<Phase>("idle");
  // Ref to reconnectTracking — allows early useEffects to call it before the function is declared
  const reconnectTrackingRef = useRef<((count: number) => Promise<void>) | null>(null);

  useEffect(() => {
    trackingModeRef.current = trackingMode;
  }, [trackingMode]);

  // Keep phaseRef in sync for use inside async callbacks
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  const lastAutoAddRef = useRef<number>(0);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const currentMarkerRef = useRef<L.CircleMarker | null>(null);
  const startMarkerRef = useRef<L.CircleMarker | null>(null);
  const pointsRef = useRef<SegmentPoint[]>([]);
  const offlineRoadsDataRef = useRef<any>(null);
  const offlineRoadsLayerRef = useRef<L.LayerGroup | null>(null);
  
  // Snapping settings & unsnapped line rendering
  const [snapToRoads, setSnapToRoads] = useState<boolean>(true);
  const originalPolylineRef = useRef<L.Polyline | null>(null);

  // Keep ref in sync for use inside watchPosition callback
  useEffect(() => {
    pointsRef.current = points;
  }, [points]);

  // ── Session persistence helpers ─────────────────────────────────────────────

  const persistSession = useCallback((
    pts: SegmentPoint[],
    startTime: string,
    mode: string,
    sessionPhase: "tracking" | "paused" = "tracking",
  ) => {
    try {
      const session = {
        points: pts,
        startTime,
        trackingMode: mode,
        roadLabel,
        phase: sessionPhase,
        savedAt: Date.now(),
      };
      localStorage.setItem(SEGMENT_SESSION_KEY, JSON.stringify(session));
    } catch (e) {
      console.warn("Failed to persist GPS session:", e);
    }
  }, [roadLabel]);

  const clearSession = useCallback(() => {
    try {
      localStorage.removeItem(SEGMENT_SESSION_KEY);
    } catch (e) {
      console.warn("Failed to clear GPS session:", e);
    }
  }, []);

  // Elapsed timer
  useEffect(() => {
    if (phase === "tracking") {
      timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [phase]);

  // ─── Restore session from localStorage on mount ────────────────────────────
  // Runs once. If a GPS session was in progress when the app was killed or
  // backgrounded, we restore all collected points and reconnect to the native
  // BackgroundGeolocation service so recording continues seamlessly.
  useEffect(() => {
    // Only restore if no existing geometry was passed in (not editing a draft)
    if (existingGeometry) return;

    try {
      const raw = localStorage.getItem(SEGMENT_SESSION_KEY);
      if (!raw) return;

      const session = JSON.parse(raw) as {
        points: SegmentPoint[];
        startTime: string;
        trackingMode: "auto" | "manual";
        savedAt: number;
        phase?: "tracking" | "paused";
      };

      // Ignore stale sessions older than 24 hours
      if (Date.now() - session.savedAt > 24 * 60 * 60 * 1000) {
        clearSession();
        return;
      }

      if (!session.points || session.points.length === 0) {
        // Empty session (tracking started but no points yet) — still reconnect
        clearSession();
        return;
      }

      // Restore state
      startTimeRef.current = session.startTime;
      const restoredPoints = session.points;
      pointsRef.current = restoredPoints;
      setPoints(restoredPoints);
      setAutoAdded(restoredPoints.length);
      setTrackingMode(session.trackingMode || "auto");
      trackingModeRef.current = session.trackingMode || "auto";

      // Calculate elapsed from original start time
      const elapsedSec = Math.round((Date.now() - new Date(session.startTime).getTime()) / 1000);
      setElapsed(elapsedSec);

      const restoredPhase = session.phase === "paused" ? "paused" : "tracking";
      setPhase(restoredPhase);
      phaseRef.current = restoredPhase;

      // Only reconnect GPS when the session was actively tracking (not paused)
      if (restoredPhase === "tracking") {
        setTimeout(() => {
          if (reconnectTrackingRef.current) reconnectTrackingRef.current(restoredPoints.length);
        }, 800);
      }

    } catch (e) {
      console.warn("Failed to restore GPS session:", e);
      clearSession();
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Foreground resume reconnect via Capacitor App lifecycle ────────────────
  // When the user switches back to the app from another app or lock screen,
  // re-establish the JS callback to the still-running native GPS service.
  useEffect(() => {
    let listenerHandle: { remove: () => void } | null = null;

    const attachListener = async () => {
      try {
        listenerHandle = await CapApp.addListener("appStateChange", ({ isActive }) => {
          if (isActive && phaseRef.current === "tracking" && watchIdRef.current !== "active") {
            if (reconnectTrackingRef.current) reconnectTrackingRef.current(pointsRef.current.length);
          }
          // When going to background, do a final persist of all current points
          if (!isActive && phaseRef.current === "tracking") {
            persistSession(pointsRef.current, startTimeRef.current, trackingModeRef.current);
          }
        });
      } catch (e) {
        console.warn("Could not attach appStateChange listener:", e);
      }
    };

    attachListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove();
      }
    };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch offline roads dataset on mount
  useEffect(() => {
    fetch("/zimbabwe_roads.geojson")
      .then((res) => {
        if (!res.ok) throw new Error("Failed to load offline roads dataset");
        return res.json();
      })
      .then((data) => {
        if (data && data.features) {
          data.features.forEach((f: any) => {
            if (f.geometry && f.geometry.coordinates) {
              f.bbox = getLineStringBBox(f.geometry.coordinates);
            }
          });
          offlineRoadsDataRef.current = data.features;
          console.log(`Loaded ${data.features.length} offline roads successfully`);
        }
      })
      .catch((err) => {
        console.error("Error loading offline roads:", err);
      });
  }, []);

  // Full cleanup on unmount
  useEffect(() => {
    return () => {
      if (watchIdRef.current) {
        BackgroundGeolocation.stop().catch((e) => console.error("Error stopping background geo on unmount:", e));
      }
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }
    };
  }, []);

  // Initialize Leaflet map when tracking begins
  useEffect(() => {
    if (phase !== "tracking") return;

    const t = setTimeout(() => {
      if (!mapContainerRef.current || mapRef.current) return;

      const center: [number, number] = currentPos
        ? [currentPos.lat, currentPos.lng]
        : [-20.0, 30.0];

      const map = L.map(mapContainerRef.current, {
        center,
        zoom: 18,
        zoomControl: false,
        attributionControl: false,
      });

      L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
        maxZoom: 21,
        maxNativeZoom: 19,
      }).addTo(map);

      L.control.zoom({ position: "topright" }).addTo(map);

      // Create LayerGroup for preloaded offline roads
      const offlineLayerGroup = L.layerGroup().addTo(map);
      offlineRoadsLayerRef.current = offlineLayerGroup;

      const updateVisibleOfflineRoads = () => {
        if (!offlineRoadsDataRef.current || !offlineRoadsLayerRef.current) return;
        const zoom = map.getZoom();
        offlineLayerGroup.clearLayers();

        // Only show roads when zoomed in enough to prevent slow rendering
        if (zoom < 11) return;

        const bounds = map.getBounds();
        const minLat = bounds.getSouth();
        const maxLat = bounds.getNorth();
        const minLon = bounds.getWest();
        const maxLon = bounds.getEast();

        const visibleFeatures: any[] = [];
        const features = offlineRoadsDataRef.current;

        for (let i = 0; i < features.length; i++) {
          const f = features[i];
          if (!f.bbox) continue;

          const [fMinLon, fMinLat, fMaxLon, fMaxLat] = f.bbox;
          const intersects = !(fMinLon > maxLon || fMaxLon < minLon || fMinLat > maxLat || fMaxLat < minLat);

          if (intersects) {
            const h = f.properties?.highway;
            // At zoom 11-12, only show motorway and trunk
            if (zoom >= 11 && zoom <= 12) {
              if (h === "motorway" || h === "trunk") {
                visibleFeatures.push(f);
              }
            } else {
              // Zoom >= 13, show all (motorway, trunk, primary)
              visibleFeatures.push(f);
            }
          }
        }

        // Cap rendering at 400 features for optimal performance
        const sliced = visibleFeatures.slice(0, 400);

        if (sliced.length > 0) {
          const geoJsonLayer = L.geoJSON(sliced as any, {
            style: (feature) => {
              const h = feature?.properties?.highway;
              let color = "#eab308"; // yellow for primary
              let weight = 3.5;
              if (h === "motorway" || h === "trunk") {
                color = "#f97316"; // orange for major highway
                weight = 5;
              }
              return { color, weight, opacity: 0.75, fill: false };
            },
            onEachFeature: (feature, layer) => {
              const name = feature.properties?.name;
              if (name && zoom >= 15) {
                try {
                  (layer as any).setText(name, {
                    center: true,
                    repeat: false,
                    offset: -6,
                    attributes: {
                      fill: "#ffffff",
                      "font-size": "9px",
                      "font-weight": "bold",
                      stroke: "#0f172a",
                      "stroke-width": "2.5px",
                      "stroke-linejoin": "round",
                      "paint-order": "stroke fill"
                    }
                  });
                } catch (e) {
                  console.error("Error setting textpath:", e);
                }
              }
            }
          });
          offlineLayerGroup.addLayer(geoJsonLayer);
        }
      };

      map.on("moveend", updateVisibleOfflineRoads);
      updateVisibleOfflineRoads();

      const poly = L.polyline([], {
        color: "#22c55e",
        weight: 6,
        opacity: 0.95,
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      const origPoly = L.polyline([], {
        color: "#3b82f6",
        weight: 3.5,
        opacity: 0.6,
        dashArray: "6, 12",
        lineCap: "round",
        lineJoin: "round",
      }).addTo(map);

      mapRef.current = map;
      polylineRef.current = poly;
      originalPolylineRef.current = origPoly;

      setTimeout(() => map.invalidateSize(), 350);
    }, 200);

    return () => {
      clearTimeout(t);
      if (mapRef.current) {
        mapRef.current.off("moveend");
        mapRef.current.remove();
        mapRef.current = null;
        polylineRef.current = null;
        originalPolylineRef.current = null;
        currentMarkerRef.current = null;
        startMarkerRef.current = null;
        offlineRoadsLayerRef.current = null;
      }
    };
  }, [phase]); // eslint-disable-line react-hooks/exhaustive-deps

  // Update map polyline + live position marker
  useEffect(() => {
    if (!mapRef.current) return;

    try {
      if (polylineRef.current) {
        polylineRef.current.setLatLngs(
          pointsRef.current.map((p) => [p.lat, p.lng] as [number, number])
        );
      }

      if (originalPolylineRef.current) {
        originalPolylineRef.current.setLatLngs(
          pointsRef.current.map((p) => [p.orig_lat ?? p.lat, p.orig_lng ?? p.lng] as [number, number])
        );
      }

      if (currentPos) {
        const ll: [number, number] = [currentPos.lat, currentPos.lng];
        if (currentMarkerRef.current) {
          currentMarkerRef.current.setLatLng(ll);
        } else if (mapRef.current) {
          currentMarkerRef.current = L.circleMarker(ll, {
            radius: 10,
            fillColor: "#3b82f6",
            color: "#ffffff",
            weight: 3,
            fillOpacity: 1,
          })
            .bindTooltip("You are here", { direction: "top", offset: [0, -12] })
            .addTo(mapRef.current);
        }
        mapRef.current.panTo(ll, { animate: true, duration: 0.6 });
      }
    } catch (err) {
      console.warn("Failed to update map features (app may be backgrounded):", err);
    }
  }, [currentPos, points]);

  // ── Point addition logic ───────────────────────────────────────────────────

  const addPoint = useCallback((pos: SegmentPoint, isManual: boolean): boolean => {
    const current = pointsRef.current;

    // Strict accuracy threshold check for both auto and manual points
    if (pos.acc > accuracyThreshold) {
      if (isManual) {
        setStatusMsg(`❌ Cannot add point: Accuracy is ±${pos.acc.toFixed(1)}m (must be ≤${accuracyThreshold.toFixed(1)}m).`);
        setTimeout(() => setStatusMsg(""), 4000);
      }
      return false;
    }

    let finalPos = { ...pos };
    if (snapToRoads && offlineRoadsDataRef.current) {
      const snapped = findClosestSnappedPoint(pos.lat, pos.lng, offlineRoadsDataRef.current, 50);
      if (snapped) {
        finalPos.orig_lat = pos.lat;
        finalPos.orig_lng = pos.lng;
        finalPos.lat = snapped.lat;
        finalPos.lng = snapped.lng;

        const snapMsg = `Snapped to ${snapped.roadName} (${Math.round(snapped.dist)}m)`;
        setStatusMsg(`🟢 ${snapMsg}`);
        setTimeout(() => setStatusMsg(""), 3000);
      }
    }

    if (!isManual) {
      if (current.length > 0) {
        const last = current[current.length - 1];
        if (haversine(last.lat, last.lng, finalPos.lat, finalPos.lng) < MIN_DISTANCE_M) return false;
      }
      setAutoAdded((n) => n + 1);
    } else {
      setManualAdded((n) => n + 1);
    }

    setPoints((prev) => {
      // Draw green start marker on first point
      if (prev.length === 0 && mapRef.current && !startMarkerRef.current) {
        try {
          startMarkerRef.current = L.circleMarker([finalPos.lat, finalPos.lng], {
            radius: 8,
            fillColor: "#f59e0b",
            color: "#fff",
            weight: 2,
            fillOpacity: 1,
          })
            .bindTooltip("START", { permanent: true, direction: "top", offset: [0, -10] })
            .addTo(mapRef.current);
        } catch (err) {
          console.warn("Failed to draw START marker (app may be backgrounded):", err);
        }
      }
      const updated = [...prev, finalPos];

      // Persist to localStorage every N points to survive backgrounding/kill
      pointsSinceLastPersistRef.current += 1;
      if (pointsSinceLastPersistRef.current >= SESSION_PERSIST_EVERY_N) {
        pointsSinceLastPersistRef.current = 0;
        persistSession(updated, startTimeRef.current, trackingModeRef.current);
      }

      return updated;
    });
    return true;
  }, [snapToRoads, accuracyThreshold, persistSession]);

  // ── Start tracking ─────────────────────────────────────────────────────────

  // ── Core GPS callback (shared by startTracking and reconnectTracking) ─────────

  const buildGpsCallback = useCallback(() => {
    return (location: any, err: any) => {
      if (err || !location) {
        setStatusMsg(`⚠ GPS: ${err?.message ?? "signal lost"}`);
        return;
      }
      const pt: SegmentPoint = {
        lat: location.latitude,
        lng: location.longitude,
        alt: location.altitude || undefined,
        acc: location.accuracy,
        ts: location.time || Date.now(),
      };
      setCurrentPos(pt);
      setCurrentAcc(location.accuracy);
      setStatusMsg("");

      // Hybrid: auto-add every 3 s if in auto mode and accuracy is acceptable
      const now = Date.now();
      if (trackingModeRef.current === "auto" && now - lastAutoAddRef.current >= AUTO_ADD_INTERVAL_MS) {
        lastAutoAddRef.current = now;
        addPoint(pt, false);
      }
    };
  }, [addPoint]); // eslint-disable-line react-hooks/exhaustive-deps

  const startTracking = async () => {
    try {
      setStatusMsg("Requesting background location permission…");
      const status = await BackgroundGeolocation.requestPermissions({
        permissions: ["location", "backgroundLocation", "notification"]
      });
      if (status.location !== "granted") {
        setStatusMsg("❌ Location permission denied. Enable in device Settings.");
        return;
      }
      if (status.backgroundLocation !== "granted" && status.backgroundLocation !== "always") {
        setStatusMsg("⚠ Warning: Background location permission is not 'Allow All The Time'. Background tracking may be suspended when screen is locked.");
      }
    } catch (err) {
      console.warn("Background permissions request skipped/failed:", err);
      try {
        await Geolocation.requestPermissions();
      } catch (err2) {
        console.warn("Standard permission request failed too:", err2);
      }
    }

    setStatusMsg("🛰 Acquiring GPS signal — move outdoors for best accuracy…");
    startTimeRef.current = new Date().toISOString();
    setPoints([]);
    pointsRef.current = [];
    setElapsed(0);
    setAutoAdded(0);
    setManualAdded(0);
    lastAutoAddRef.current = 0;
    pointsSinceLastPersistRef.current = 0;
    setPhase("tracking");

    // Write initial empty session so recovery works even before first point
    persistSession([], startTimeRef.current, trackingModeRef.current);

    try {
      await BackgroundGeolocation.start(
        {
          backgroundTitle: "MOTID Survey in Progress",
          backgroundMessage: `Recording segment for ${roadLabel || "Road"} in background...`,
          requestPermissions: true,
          stale: false,
          distanceFilter: 0
        },
        buildGpsCallback()
      );
      watchIdRef.current = "active";
    } catch (e: unknown) {
      setStatusMsg(`Failed to start GPS: ${(e as Error).message}`);
      setPhase("idle");
      clearSession();
    }
  };

  // ── Reconnect to running native service after foreground resume ──────────────

  const reconnectTracking = useCallback(async (restoredPointCount: number) => {
    if (watchIdRef.current === "active") return; // already connected
    setIsReconnecting(true);
    setStatusMsg(`🔄 Reconnecting GPS — continuing from ${restoredPointCount} points…`);
    try {
      await BackgroundGeolocation.start(
        {
          backgroundTitle: "MOTID Survey in Progress",
          backgroundMessage: `Recording segment for ${roadLabel || "Road"} in background...`,
          requestPermissions: false,
          stale: false,
          distanceFilter: 0
        },
        buildGpsCallback()
      );
      watchIdRef.current = "active";
      setStatusMsg(`📡 Reconnected — continuing from ${restoredPointCount} recorded points`);
      setTimeout(() => setStatusMsg(""), 4000);
    } catch (e: unknown) {
      setStatusMsg(`⚠ Reconnect failed: ${(e as Error).message}`);
    } finally {
      setIsReconnecting(false);
    }
  }, [roadLabel, buildGpsCallback]); // eslint-disable-line react-hooks/exhaustive-deps

  // Keep the ref in sync so early-mounted useEffects can call it
  reconnectTrackingRef.current = reconnectTracking;

  // ── Pause / resume segment (collect point assets mid-line) ─────────────────

  const pauseSegment = async (forPointCollect = false) => {
    if (watchIdRef.current) {
      try {
        await BackgroundGeolocation.stop();
      } catch (e) {
        console.error("Error stopping background geolocation on pause:", e);
      }
      watchIdRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);

    const pts = [...pointsRef.current];
    persistSession(pts, startTimeRef.current, trackingModeRef.current, "paused");
    setPhase("paused");
    phaseRef.current = "paused";
    setStatusMsg("⏸ Segment paused — GPS points kept. Resume anytime or collect a point asset.");

    const info = { pointCount: pts.length, length_m: totalDistance(pts) };
    onSegmentPaused?.(info);
    if (forPointCollect) onCollectPointAlongRoute?.();
  };

  const resumeSegment = async () => {
    setPhase("tracking");
    phaseRef.current = "tracking";
    persistSession(pointsRef.current, startTimeRef.current, trackingModeRef.current, "tracking");
    setStatusMsg("▶ Resuming segment recording…");
    await reconnectTracking(pointsRef.current.length);
  };

  // ── Manual add point ───────────────────────────────────────────────────────

  const manualAdd = () => {
    if (!currentPos) return;
    const added = addPoint({ ...currentPos, ts: Date.now() }, true);
    if (added) {
      setStatusMsg("📍 Point added!");
      setTimeout(() => setStatusMsg(""), 1500);
    }
  };

  // ── End segment ────────────────────────────────────────────────────────────

  const endSegment = async () => {
    if (watchIdRef.current) {
      try {
        await BackgroundGeolocation.stop();
      } catch (e) {
        console.error("Error stopping background geolocation:", e);
      }
      watchIdRef.current = null;
    }
    if (timerRef.current) clearInterval(timerRef.current);

    // Add final position as last point
    if (currentPos) addPoint({ ...currentPos, ts: Date.now() }, true);

    // Allow state to flush
    await new Promise<void>((res) => setTimeout(res, 150));

    const finalPts = [...pointsRef.current];
    const endTime = new Date().toISOString();
    const length_m = totalDistance(finalPts);
    const avg_accuracy_m =
      finalPts.length > 0
        ? Math.round((finalPts.reduce((s, p) => s + p.acc, 0) / finalPts.length) * 10) / 10
        : 0;

    const geo: SegmentGeometry = {
      points: finalPts,
      geojson: toGeoJSON(finalPts),
      length_m,
      start_time: startTimeRef.current,
      end_time: endTime,
      avg_accuracy_m,
      point_count: finalPts.length,
    };

    setCompletedGeo(geo);
    setPhase("completed");
    clearSession(); // Remove active session — tracking complete
    onSegmentComplete(geo);
  };

  // ── Accuracy helpers ───────────────────────────────────────────────────────

  const accColour =
    currentAcc == null ? "#6b7280"
      : currentAcc <= accuracyThreshold ? "#22c55e"
      : "#ef4444";

  const accLabel =
    currentAcc == null ? "Waiting for GPS…"
      : currentAcc <= accuracyThreshold ? `±${currentAcc.toFixed(1)} m — Excellent 🟢`
      : `±${currentAcc.toFixed(1)} m — Poor 🔴 (locked: must be ≤${accuracyThreshold.toFixed(1)}m)`;

  const runningDist = totalDistance(points);

  // ─── RENDER ──────────────────────────────────────────────────────────────────

  // ── Phase: IDLE ─────────────────────────────────────────────────────────────
  if (phase === "idle") {
    return (
      <div
        style={{
          display: "flex", flexDirection: "column", gap: "12px",
          padding: "16px",
          background: "var(--bg-card)",
          border: "1px solid var(--border-color)",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(34,197,94,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Navigation size={18} color="var(--accent-emerald)" />
          </div>
          <div>
            <p style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)", margin: 0 }}>
              {roadLabel} — GPS Line Survey
            </p>
            <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0" }}>
              Record segment geometry before entering attributes
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", margin: "4px 0" }}>
          <div className="mobile-form-group">
            <label className="mobile-label" style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px", display: "block" }}>Recording Mode</label>
            <div style={{ display: "flex", gap: "4px", background: "var(--bg-app)", padding: "3px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setTrackingMode("auto")}
                style={{
                  flex: 1, padding: "6px 0", fontSize: "9px", border: "none", borderRadius: "var(--radius-sm)",
                  background: trackingMode === "auto" ? "var(--accent-emerald)" : "transparent",
                  color: trackingMode === "auto" ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("manual")}
                style={{
                  flex: 1, padding: "6px 0", fontSize: "9px", border: "none", borderRadius: "var(--radius-sm)",
                  background: trackingMode === "manual" ? "var(--accent-emerald)" : "transparent",
                  color: trackingMode === "manual" ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                Manual
              </button>
            </div>
          </div>

          <div className="mobile-form-group">
            <label className="mobile-label" style={{ fontSize: "10px", fontWeight: "700", color: "var(--text-muted)", textTransform: "uppercase", marginBottom: "4px", display: "block" }}>Road Snapping</label>
            <div style={{ display: "flex", gap: "4px", background: "var(--bg-app)", padding: "3px", borderRadius: "var(--radius-sm)", border: "1px solid var(--border-color)" }}>
              <button
                type="button"
                onClick={() => setSnapToRoads(true)}
                style={{
                  flex: 1, padding: "6px 0", fontSize: "9px", border: "none", borderRadius: "var(--radius-sm)",
                  background: snapToRoads ? "var(--accent-emerald)" : "transparent",
                  color: snapToRoads ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                ON
              </button>
              <button
                type="button"
                onClick={() => setSnapToRoads(false)}
                style={{
                  flex: 1, padding: "6px 0", fontSize: "9px", border: "none", borderRadius: "var(--radius-sm)",
                  background: !snapToRoads ? "var(--accent-emerald)" : "transparent",
                  color: !snapToRoads ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                OFF
              </button>
            </div>
          </div>
        </div>

        <div
          style={{
            background: "rgba(34,197,94,0.05)",
            border: "1px dashed rgba(34,197,94,0.25)",
            borderRadius: "var(--radius-sm)",
            padding: "10px 12px",
          }}
        >
          <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: 0, lineHeight: 1.8 }}>
            <strong style={{ color: "var(--text-accent)" }}>High-precision tracking:</strong><br />
            🛰 Points auto-added every 3 s when accuracy ≤ {accuracyThreshold.toFixed(1)} m<br />
            📍 Tap <em>Add Point Now</em> (requires accuracy ≤ {accuracyThreshold.toFixed(1)} m)<br />
            🌳 Operate outdoors under clear skies for sub-{accuracyThreshold.toFixed(0)}m accuracy
          </p>
        </div>

        {statusMsg && (
          <p style={{ fontSize: "11px", color: "#ef4444", margin: 0 }}>{statusMsg}</p>
        )}

        <button
          type="button"
          onClick={startTracking}
          className="mobile-btn"
          style={{ width: "100%", height: "46px", fontSize: "13px", gap: "10px", letterSpacing: "0.02em" }}
        >
          <Navigation size={17} />
          Start Segment Recording
        </button>
      </div>
    );
  }

  // ── Phase: TRACKING ─────────────────────────────────────────────────────────
  if (phase === "tracking") {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
        <style>{`
          @keyframes pulse-green {
            0% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
            70% { transform: scale(1.1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
            100% { transform: scale(0.9); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
          }
          .road-label {
            background: rgba(15, 23, 42, 0.85) !important;
            border: 1px solid rgba(255, 255, 255, 0.15) !important;
            color: #f8fafc !important;
            font-size: 8px !important;
            font-weight: 700 !important;
            padding: 2px 4px !important;
            border-radius: 3px !important;
            box-shadow: none !important;
            pointer-events: none !important;
            white-space: nowrap !important;
          }
          .leaflet-tooltip-top:before,
          .leaflet-tooltip-bottom:before,
          .leaflet-tooltip-left:before,
          .leaflet-tooltip-right:before {
            display: none !important;
          }
        `}</style>

        {/* Accuracy + Timer banner */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            background: "var(--bg-card)",
            border: `2px solid ${accColour}`,
            borderRadius: "var(--radius-md)",
            padding: "8px 12px",
            transition: "border-color 0.4s",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
            <Gauge size={15} color={accColour} />
            <span style={{ fontSize: "11px", fontWeight: 700, color: accColour }}>{accLabel}</span>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
            <Clock size={12} color="var(--text-muted)" />
            <span style={{ fontSize: "11px", color: "var(--text-muted)", fontFamily: "monospace", fontWeight: 600 }}>
              {fmtElapsed(elapsed)}
            </span>
          </div>
        </div>

        {/* Recording Settings Card - LIVE */}
        <div style={{ background: "var(--bg-card)", border: "1px solid var(--border-color)", padding: "10px", borderRadius: "var(--radius-md)", display: "flex", flexDirection: "column", gap: "8px" }}>
          {/* Row 1: Tracking Mode */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-accent)", textTransform: "uppercase" }}>Tracking Mode</span>
            <div style={{ display: "flex", gap: "4px", background: "var(--bg-app)", padding: "2px", borderRadius: "var(--radius-sm)", width: "120px" }}>
              <button
                type="button"
                onClick={() => setTrackingMode("auto")}
                style={{
                  flex: 1, padding: "4px 0", fontSize: "9px", border: "none", borderRadius: "var(--radius-sm)",
                  background: trackingMode === "auto" ? "var(--accent-emerald)" : "transparent",
                  color: trackingMode === "auto" ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                Auto
              </button>
              <button
                type="button"
                onClick={() => setTrackingMode("manual")}
                style={{
                  flex: 1, padding: "4px 0", fontSize: "9px", border: "none", borderRadius: "var(--radius-sm)",
                  background: trackingMode === "manual" ? "var(--accent-emerald)" : "transparent",
                  color: trackingMode === "manual" ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                Manual
              </button>
            </div>
          </div>
          
          {/* Row 2: Road Snapping */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid var(--border-color)", paddingTop: "8px", marginTop: "2px" }}>
            <span style={{ fontSize: "10px", fontWeight: 700, color: "var(--text-accent)", textTransform: "uppercase" }}>Road Snapping</span>
            <div style={{ display: "flex", gap: "4px", background: "var(--bg-app)", padding: "2px", borderRadius: "var(--radius-sm)", width: "120px" }}>
              <button
                type="button"
                onClick={() => {
                  setSnapToRoads(true);
                  setStatusMsg("Road snapping activated.");
                  setTimeout(() => setStatusMsg(""), 2000);
                }}
                style={{
                  flex: 1, padding: "4px 0", fontSize: "9px", border: "none", borderRadius: "var(--radius-sm)",
                  background: snapToRoads ? "var(--accent-emerald)" : "transparent",
                  color: snapToRoads ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                ON
              </button>
              <button
                type="button"
                onClick={() => {
                  setSnapToRoads(false);
                  setStatusMsg("Road snapping deactivated.");
                  setTimeout(() => setStatusMsg(""), 2000);
                }}
                style={{
                  flex: 1, padding: "4px 0", fontSize: "9px", border: "none", borderRadius: "var(--radius-sm)",
                  background: !snapToRoads ? "var(--accent-emerald)" : "transparent",
                  color: !snapToRoads ? "#ffffff" : "var(--text-muted)",
                  fontWeight: 700, cursor: "pointer"
                }}
              >
                OFF
              </button>
            </div>
          </div>
        </div>

        {/* Live Leaflet Map */}
        <div
          ref={mapContainerRef}
          style={{
            width: "100%",
            height: "400px",
            borderRadius: "var(--radius-md)",
            overflow: "hidden",
            border: "1px solid var(--border-color)",
            background: "#0d1117",
          }}
        />

        {/* Stats Grid */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[
            {
              icon: <MapPin size={12} color="var(--accent-emerald)" />,
              value: points.length,
              label: "Points",
            },
            {
              icon: <Activity size={12} color="#f59e0b" />,
              value: fmtDist(runningDist),
              label: "Distance",
            },
            {
              icon: <Navigation size={12} color="#818cf8" />,
              value: `${autoAdded} / ${manualAdded}`,
              label: "Auto / Manual",
            },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                padding: "10px",
                textAlign: "center",
              }}
            >
              <div style={{ display: "flex", justifyContent: "center", marginBottom: "4px" }}>
                {s.icon}
              </div>
              <div style={{ fontSize: "13px", fontWeight: 700, color: "var(--text-primary)" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>

        {/* 📡 Background Recording Badge */}
        <div
          style={{
            display: "flex", alignItems: "center", justifyContent: "center",
            gap: "6px",
            padding: "6px 10px",
            background: isReconnecting
              ? "rgba(234, 179, 8, 0.1)"
              : "rgba(34, 197, 94, 0.08)",
            border: `1px solid ${isReconnecting ? "rgba(234,179,8,0.4)" : "rgba(34,197,94,0.3)"}`,
            borderRadius: "var(--radius-sm)",
          }}
        >
          <Wifi
            size={11}
            color={isReconnecting ? "#eab308" : "#22c55e"}
            style={{ animation: isReconnecting ? "none" : undefined }}
          />
          <span style={{
            fontSize: "9px", fontWeight: 700,
            color: isReconnecting ? "#eab308" : "#22c55e",
            textTransform: "uppercase", letterSpacing: "0.06em"
          }}>
            {isReconnecting
              ? "Reconnecting GPS…"
              : "📡 Recording in background — collection continues when app is minimised"}
          </span>
        </div>

        {statusMsg && (
          <p style={{ fontSize: "11px", color: "var(--accent-emerald)", margin: 0, textAlign: "center" }}>
            {statusMsg}
          </p>
        )}

        {/* Action Buttons */}
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={manualAdd}
              disabled={!currentPos}
              className="mobile-btn mobile-btn-outline"
              style={{ flex: 1, height: "42px", fontSize: "12px", gap: "6px" }}
            >
              <Plus size={14} />
              Add Point Now
            </button>
            <button
              type="button"
              onClick={endSegment}
              disabled={points.length < 2}
              className="mobile-btn"
              style={{
                flex: 1, height: "42px", fontSize: "12px", gap: "6px",
                background: points.length >= 2 ? "#dc2626" : undefined,
                borderColor: points.length >= 2 ? "#dc2626" : undefined,
              }}
            >
              <Square size={14} />
              End Segment
            </button>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <button
              type="button"
              onClick={() => pauseSegment(false)}
              disabled={points.length < 1}
              className="mobile-btn mobile-btn-outline"
              style={{ flex: 1, height: "40px", fontSize: "11px", gap: "6px" }}
            >
              <Pause size={14} />
              Pause
            </button>
            <button
              type="button"
              onClick={() => pauseSegment(true)}
              disabled={points.length < 1}
              className="mobile-btn"
              style={{
                flex: 1.4, height: "40px", fontSize: "11px", gap: "6px",
                background: "#b45309",
                borderColor: "#b45309",
              }}
            >
              <MapPinned size={14} />
              Pause &amp; Collect Point
            </button>
          </div>
        </div>

        <p style={{ fontSize: "9px", color: "var(--text-muted)", textAlign: "center", margin: 0 }}>
          Pause keeps this line so you can survey a bus stop / bridge, then resume the same segment
        </p>
      </div>
    );
  }

  // ── Phase: PAUSED ───────────────────────────────────────────────────────────
  if (phase === "paused") {
    const pausedDist = totalDistance(points);
    return (
      <div
        style={{
          display: "flex", flexDirection: "column", gap: "12px",
          padding: "14px",
          background: "var(--bg-card)",
          border: "2px solid #b45309",
          borderRadius: "var(--radius-md)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "rgba(180,83,9,0.12)",
              display: "flex", alignItems: "center", justifyContent: "center",
            }}
          >
            <Pause size={18} color="#b45309" />
          </div>
          <div>
            <p style={{ margin: 0, fontSize: "13px", fontWeight: 800, color: "#b45309" }}>
              Segment Paused
            </p>
            <p style={{ margin: "2px 0 0", fontSize: "10px", color: "var(--text-muted)" }}>
              {roadLabel} — GPS line kept safely. Collect a point asset, then resume.
            </p>
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "8px" }}>
          {[
            { label: "Points", value: points.length },
            { label: "Distance", value: fmtDist(pausedDist) },
            { label: "Elapsed", value: fmtElapsed(elapsed) },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--bg-app)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                padding: "8px",
                textAlign: "center",
              }}
            >
              <div style={{ fontSize: "13px", fontWeight: 700 }}>{s.value}</div>
              <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase" }}>{s.label}</div>
            </div>
          ))}
        </div>

        <button
          type="button"
          onClick={resumeSegment}
          className="mobile-btn"
          style={{ width: "100%", height: "44px", fontSize: "13px", gap: "8px" }}
        >
          <Play size={16} />
          Resume Line Recording
        </button>

        {onCollectPointAlongRoute && (
          <button
            type="button"
            onClick={() => onCollectPointAlongRoute()}
            className="mobile-btn mobile-btn-outline"
            style={{ width: "100%", height: "42px", fontSize: "12px", gap: "8px", color: "#b45309", borderColor: "#b45309" }}
          >
            <MapPinned size={15} />
            Collect Point Asset (bus stop, bridge…)
          </button>
        )}

        <button
          type="button"
          onClick={endSegment}
          disabled={points.length < 2}
          className="mobile-btn"
          style={{
            width: "100%", height: "40px", fontSize: "12px", gap: "6px",
            background: points.length >= 2 ? "#dc2626" : undefined,
            borderColor: points.length >= 2 ? "#dc2626" : undefined,
            opacity: points.length < 2 ? 0.5 : 1,
          }}
        >
          <Square size={14} />
          End Segment Instead
        </button>

        {statusMsg && (
          <p style={{ fontSize: "11px", color: "#b45309", margin: 0, textAlign: "center" }}>{statusMsg}</p>
        )}
      </div>
    );
  }

  // ── Phase: COMPLETED ────────────────────────────────────────────────────────
  const durationSec =
    completedGeo
      ? Math.round(
          (new Date(completedGeo.end_time).getTime() -
            new Date(completedGeo.start_time).getTime()) /
            1000
        )
      : 0;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
      {/* Success Banner */}
      <div
        style={{
          background: "rgba(34,197,94,0.08)",
          border: "1px solid #22c55e",
          borderRadius: "var(--radius-md)",
          padding: "12px 14px",
          display: "flex",
          alignItems: "center",
          gap: "12px",
        }}
      >
        <CheckCircle2 size={22} color="#22c55e" />
        <div>
          <p style={{ fontSize: "13px", fontWeight: 700, color: "#22c55e", margin: 0 }}>
            Segment Recorded
          </p>
          <p style={{ fontSize: "10px", color: "var(--text-muted)", margin: "2px 0 0" }}>
            Scroll down to fill in road attributes, then save.
          </p>
        </div>
      </div>

      {/* Summary Stats */}
      {completedGeo && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {[
            { label: "Distance", value: fmtDist(completedGeo.length_m) },
            { label: "GPS Points", value: completedGeo.point_count },
            { label: "Avg Accuracy", value: `±${completedGeo.avg_accuracy_m} m` },
            { label: "Duration", value: fmtElapsed(durationSec) },
          ].map((s) => (
            <div
              key={s.label}
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-color)",
                borderRadius: "var(--radius-sm)",
                padding: "10px 12px",
              }}
            >
              <div style={{ fontSize: "14px", fontWeight: 700, color: "var(--text-primary)" }}>
                {s.value}
              </div>
              <div style={{ fontSize: "9px", color: "var(--text-muted)", textTransform: "uppercase", marginTop: "2px" }}>
                {s.label}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Re-record button */}
      <button
        type="button"
        onClick={() => {
          clearSession(); // Remove persisted session when intentionally re-recording
          setPhase("idle");
          setPoints([]);
          pointsRef.current = [];
          setCompletedGeo(null);
          setCurrentPos(null);
          setCurrentAcc(null);
          setElapsed(0);
          onReset();
        }}
        className="mobile-btn mobile-btn-outline"
        style={{ width: "100%", height: "36px", fontSize: "11px", gap: "6px" }}
      >
        <Navigation size={12} />
        Re-record Segment
      </button>
    </div>
  );
}
