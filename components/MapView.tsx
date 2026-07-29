"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, Polyline } from "react-leaflet";
import L from "leaflet";
import {
  getRecordStatus,
  getAssetType,
  getAssetName,
  getCategoryKey,
  getStatusColor,
  formatStatusLabel,
  resolveAssetLocation,
  MAP_GOTO_EVENT,
  type MapGotoDetail,
} from "@/components/helpers";
import { Layers, ChevronLeft, ChevronRight } from "lucide-react";

const parseLineCoordinates = (record: any): [number, number][] | null => {
  const loc = resolveAssetLocation(record);
  if (loc?.kind === "line") return loc.coords;
  return null;
};

const selectedPinIcon = L.divIcon({
  className: "custom-div-icon",
  html: `<div class="map-pin-selected"><span></span></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

/** Always-mounted controller: per-record go-to (direct + event, survives overlay close). */
function MapGoToController({ focus }: { focus: MapGotoDetail | null }) {
  const map = useMap();
  const appliedNonceRef = useRef<number>(0);

  useEffect(() => {
    (window as any).__motidMap = map;
    return () => {
      if ((window as any).__motidMap === map) (window as any).__motidMap = null;
    };
  }, [map]);

  const apply = (detail: MapGotoDetail | null | undefined) => {
    if (!detail || !Number.isFinite(detail.lat) || !Number.isFinite(detail.lng)) return;
    if (detail.nonce && detail.nonce < appliedNonceRef.current) return;
    if (detail.nonce) appliedNonceRef.current = detail.nonce;
    try {
      map.invalidateSize({ animate: false });
      const zoom = detail.zoom ?? 17;
      if (detail.usePointCamera === false && detail.line && detail.line.length >= 2) {
        const bounds = L.latLngBounds(detail.line.map(([la, ln]) => L.latLng(la, ln)));
        if (bounds.isValid()) {
          map.flyToBounds(bounds, { padding: [56, 56], maxZoom: 17, duration: 0.6 });
          (window as any).__motidLastGoto = {
            surveyId: detail.surveyId,
            lat: detail.lat,
            lng: detail.lng,
            nonce: detail.nonce,
            mode: "fitBounds",
            t: Date.now(),
          };
          return;
        }
      }
      map.flyTo([detail.lat, detail.lng], zoom, { duration: 0.6 });
      (window as any).__motidLastGoto = {
        surveyId: detail.surveyId,
        lat: detail.lat,
        lng: detail.lng,
        nonce: detail.nonce,
        mode: "flyTo",
        t: Date.now(),
      };
    } catch (err) {
      console.warn("Map go-to failed:", err);
    }
  };

  useEffect(() => {
    (window as any).__motidApplyGoto = apply;
    return () => {
      if ((window as any).__motidApplyGoto === apply) (window as any).__motidApplyGoto = undefined;
    };
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const onEvent = (e: Event) => {
      apply((e as CustomEvent<MapGotoDetail>).detail);
    };
    window.addEventListener(MAP_GOTO_EVENT, onEvent as EventListener);
    return () => window.removeEventListener(MAP_GOTO_EVENT, onEvent as EventListener);
  }, [map]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focus) return;
    apply(focus);
    const timers = [100, 300, 700, 1200, 2000].map((ms) => window.setTimeout(() => apply(focus), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [focus?.nonce, focus?.surveyId, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function SelectedAssetMarker({ focus }: { focus: MapGotoDetail | null }) {
  const markerRef = useRef<any>(null);

  useEffect(() => {
    if (!focus) return;
    const open = () => {
      try {
        markerRef.current?.openPopup?.();
      } catch {
        /* ignore */
      }
    };
    const t0 = window.setTimeout(open, 300);
    const t1 = window.setTimeout(open, 650);
    return () => {
      window.clearTimeout(t0);
      window.clearTimeout(t1);
    };
  }, [focus?.nonce]);

  if (!focus || !Number.isFinite(focus.lat) || !Number.isFinite(focus.lng)) return null;

  return (
    <Marker
      position={[focus.lat, focus.lng]}
      icon={selectedPinIcon}
      zIndexOffset={2000}
      ref={markerRef}
    >
      <Popup>
        <div style={{ color: "#1a2b22", fontSize: 11.5, fontFamily: "var(--font-body)", minWidth: 170 }}>
          <div style={{ fontFamily: "var(--font-title)", fontWeight: 700, color: "#006633", fontSize: 13, marginBottom: 6 }}>
            {focus.label || "Selected asset"}
          </div>
          <div style={{ fontSize: 11, color: "#6b8072" }}>
            {focus.lat.toFixed(5)}, {focus.lng.toFixed(5)}
          </div>
        </div>
      </Popup>
    </Marker>
  );
}

const createCustomIcon = (condition: string) =>
  L.divIcon({
    className: "custom-div-icon",
    html: `<div class="map-pin ${condition}"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

const TILE_LAYERS: Record<string, { label: string; emoji: string; url: string; attribution: string }> = {
  hybrid:    { label: "Hybrid",       emoji: "🌍", url: "https://mt1.google.com/vt/lyrs=y&x={x}&y={y}&z={z}",  attribution: "&copy; Google Maps" },
  roadmap:   { label: "Road Map",     emoji: "🗺️", url: "https://mt1.google.com/vt/lyrs=m&x={x}&y={y}&z={z}",  attribution: "&copy; Google Maps" },
  satellite: { label: "Satellite",    emoji: "🛰️", url: "https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}",  attribution: "&copy; Google Maps" },
  terrain:   { label: "Terrain",      emoji: "⛰️", url: "https://mt1.google.com/vt/lyrs=p&x={x}&y={y}&z={z}",  attribution: "&copy; Google Maps" },
  osm:       { label: "OpenStreetMap",emoji: "🗾", url: "https://tile.openstreetmap.org/{z}/{x}/{y}.png",       attribution: "&copy; OpenStreetMap contributors" },
};

const hasValidGeo = (r: any) => {
  if (!Array.isArray(r?._geolocation) || r._geolocation.length < 2) return false;
  const lat = Number(r._geolocation[0]);
  const lng = Number(r._geolocation[1]);
  return Number.isFinite(lat) && Number.isFinite(lng);
};

const INITIAL_VISIBLE_PARAMS: Record<string, boolean> = {
  sealed: true,
  gravel: true,
  earth: true,
  bridge: true,
  footbridge: true,
  rail_crossing: true,
  tollgate: true,
  layby: true,
  busstop: true,
  junction: true,
  sign: true,
  shelvet: true,
  culvert: true,
  piped_causeway: true,
  drift: true,
  grid: true,
  catchpit: true,
  traffic_calming: true,
  traffic_lights: true,
  streetlight: true,
  unknown: true,
};

const PARAMETER_GROUPS = [
  {
    label: "Roads",
    items: [
      { key: "sealed", label: "Sealed Roads", emoji: "🛣️" },
      { key: "gravel", label: "Gravel Roads", emoji: "🪨" },
      { key: "earth", label: "Earth Roads", emoji: "🚜" }
    ]
  },
  {
    label: "Structures",
    items: [
      { key: "bridge", label: "Bridges", emoji: "🌉" },
      { key: "footbridge", label: "Foot Bridges", emoji: "🚶" },
      { key: "rail_crossing", label: "Rail Crossings", emoji: "🛤️" },
      { key: "tollgate", label: "Tollgates", emoji: "🪙" },
      { key: "drift", label: "Drifts", emoji: "🌊" }
    ]
  },
  {
    label: "Drainage",
    items: [
      { key: "culvert", label: "Culverts", emoji: "🕳️" },
      { key: "piped_causeway", label: "Piped Causeways", emoji: "🌁" },
      { key: "shelvet", label: "Shelverts", emoji: "🧱" },
      { key: "grid", label: "Cattle Grids", emoji: "🐄" },
      { key: "catchpit", label: "Catchpits", emoji: "🕳️" }
    ]
  },
  {
    label: "Amenities",
    items: [
      { key: "layby", label: "Lay-bys", emoji: "🅿️" },
      { key: "busstop", label: "Bus Stops", emoji: "🚌" },
      { key: "junction", label: "Junctions", emoji: "🔀" }
    ]
  },
  {
    label: "Traffic & Lighting",
    items: [
      { key: "sign", label: "Road Signs", emoji: "⚠️" },
      { key: "traffic_calming", label: "Traffic Calming", emoji: "🛑" },
      { key: "traffic_lights", label: "Traffic Lights", emoji: "🚦" },
      { key: "streetlight", label: "Streetlights", emoji: "💡" }
    ]
  }
];

function recordKey(record: any, prefix: string, index: number) {
  const id = record?._id ?? record?.id ?? record?.survey_id;
  return id != null && String(id).length > 0 ? `${prefix}-${id}-${index}` : `${prefix}-${index}`;
}

interface MapViewProps {
  records: any[];
  selectedRecord: any | null;
  mapFocus?: MapGotoDetail | null;
  onSelectRecord: (record: any) => void;
}

export default function MapView({ records, selectedRecord, mapFocus = null, onSelectRecord }: MapViewProps) {
  // Client-only mount — never manually touch Leaflet's _leaflet_id (that causes
  // "Map container is being reused by another instance" during remove).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultCenter: [number, number] = [-19.0154, 29.1549];
  const [activeLayer, setActiveLayer] = useState("hybrid");
  const [basemapOpen, setBasemapOpen] = useState(false);
  const [legendOpen, setLegendOpen] = useState(false);
  const [layersOpen, setLayersOpen] = useState(false);
  const [visibleParameters, setVisibleParameters] = useState<Record<string, boolean>>(INITIAL_VISIBLE_PARAMS);

  useEffect(() => {
    if (!selectedRecord) return;
    const cat = getCategoryKey(selectedRecord);
    setVisibleParameters(prev => (prev[cat] === false ? { ...prev, [cat]: true } : prev));
  }, [selectedRecord]);

  const layer = TILE_LAYERS[activeLayer];

  const lineLayers = useMemo(() => {
    return records.map((record, index) => {
      const lineCoords = parseLineCoordinates(record);
      if (!lineCoords || lineCoords.length === 0) return null;
      const catKey = getCategoryKey(record);
      if (visibleParameters[catKey] === false) return null;
      const condition = getRecordStatus(record);
      return (
        <Polyline
          key={recordKey(record, "line", index)}
          positions={lineCoords}
          pathOptions={{
            color: getStatusColor(condition),
            weight: selectedRecord && selectedRecord._id === record._id ? 7 : 4,
            opacity: selectedRecord && selectedRecord._id === record._id ? 1.0 : 0.7,
          }}
          eventHandlers={{ click: () => onSelectRecord(record) }}
        />
      );
    });
  }, [records, visibleParameters, selectedRecord, onSelectRecord]);

  const markerLayers = useMemo(() => {
    return records.map((record, index) => {
      if (!hasValidGeo(record)) return null;
      const catKey = getCategoryKey(record);
      if (visibleParameters[catKey] === false) return null;
      const condition = getRecordStatus(record);
      const assetType = getAssetType(record);
      const name = getAssetName(record);
      const lat = Number(record._geolocation[0]);
      const lng = Number(record._geolocation[1]);

      return (
        <Marker
          key={recordKey(record, "marker", index)}
          position={[lat, lng]}
          icon={createCustomIcon(condition)}
          eventHandlers={{ click: () => onSelectRecord(record) }}
        >
          <Popup>
            <div style={{ color: "#1a2b22", fontSize: 11.5, fontFamily: "var(--font-body)", minWidth: 175 }}>
              <div style={{ fontFamily: "var(--font-title)", fontWeight: 700, color: "#006633", fontSize: 13, marginBottom: 6 }}>
                {name}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {[
                  { label: "Type",      val: assetType },
                  { label: "Road",      val: (record.road_name ?? "—").split(" (")[0] },
                  { label: "Section",   val: record.section_name ?? "—" },
                  { label: "Condition", val: formatStatusLabel(condition).toUpperCase(), color: getStatusColor(condition) },
                  { label: "Surveyor",  val: record.surveyor_name ?? "N/A" },
                  { label: "Date",      val: record.survey_date ?? "N/A" },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", justifyContent: "space-between", gap: 8, borderBottom: "1px solid rgba(0,102,51,0.07)", paddingBottom: 2 }}>
                    <span style={{ color: "#6b8072" }}>{row.label}:</span>
                    <span style={{ fontWeight: 600, color: (row as any).color ?? "#1a2b22", textAlign: "right" }}>{row.val}</span>
                  </div>
                ))}
              </div>
            </div>
          </Popup>
        </Marker>
      );
    });
  }, [records, visibleParameters, onSelectRecord]);

  if (!mounted) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f1" }}>
        <div style={{ fontSize: 11, color: "#6b8072" }}>Loading map…</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div style={{
        position: "absolute",
        top: 12,
        left: 12,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        pointerEvents: "none",
      }}>
        <button
          onClick={() => setBasemapOpen(o => !o)}
          title={basemapOpen ? "Collapse basemap panel" : "Expand basemap panel"}
          style={{
            pointerEvents: "all",
            background: "#006633",
            border: "none",
            borderRadius: "8px",
            color: "#ffffff",
            padding: "6px 10px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap",
            letterSpacing: "0.3px",
            fontFamily: "var(--font-body)",
          }}
        >
          <Layers size={13} />
          Base Maps
          {basemapOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
        </button>

        <div style={{
          pointerEvents: basemapOpen ? "all" : "none",
          opacity: basemapOpen ? 1 : 0,
          maxHeight: basemapOpen ? 300 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s",
          background: "#ffffff",
          border: "1px solid rgba(0,102,51,0.18)",
          borderRadius: "10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          padding: basemapOpen ? "8px" : "0 8px",
          display: "flex",
          flexDirection: "column",
          gap: 4,
          minWidth: 148,
        }}>
          {Object.entries(TILE_LAYERS).map(([key, info]) => (
            <button
              key={key}
              onClick={() => setActiveLayer(key)}
              style={{
                background: activeLayer === key ? "#006633" : "#f4f6f5",
                border: `1px solid ${activeLayer === key ? "#006633" : "rgba(0,102,51,0.14)"}`,
                borderRadius: "6px",
                padding: "6px 10px",
                fontSize: 11,
                fontWeight: 600,
                color: activeLayer === key ? "#ffffff" : "#3d5a48",
                cursor: "pointer",
                textAlign: "left",
                display: "flex",
                alignItems: "center",
                gap: 6,
                transition: "all 0.13s",
                fontFamily: "var(--font-body)",
              }}
            >
              <span>{info.emoji}</span>
              <span>{info.label}</span>
              {activeLayer === key && (
                <span style={{ marginLeft: "auto", fontSize: 9, background: "#FFD100", color: "#004d26", borderRadius: 3, padding: "1px 5px", fontWeight: 800 }}>
                  ACTIVE
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <div style={{
        position: "absolute",
        top: 12,
        right: 12,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        pointerEvents: "none",
        alignItems: "flex-end",
      }}>
        <button
          onClick={() => setLayersOpen(o => !o)}
          title={layersOpen ? "Collapse layers panel" : "Expand layers panel"}
          style={{
            pointerEvents: "all",
            background: "#006633",
            border: "none",
            borderRadius: "8px",
            color: "#ffffff",
            padding: "6px 12px",
            fontSize: 11,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 2px 8px rgba(0,0,0,0.25)",
            whiteSpace: "nowrap",
            letterSpacing: "0.3px",
            fontFamily: "var(--font-body)",
          }}
        >
          Layers
          {layersOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        <div style={{
          pointerEvents: layersOpen ? "all" : "none",
          opacity: layersOpen ? 1 : 0,
          maxHeight: layersOpen ? 420 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s",
          background: "#ffffff",
          border: "1px solid rgba(0,102,51,0.18)",
          borderRadius: "10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          padding: layersOpen ? "10px 12px" : "0 12px",
          minWidth: 180,
          maxWidth: 220,
        }}>
          {PARAMETER_GROUPS.map(group => (
            <div key={group.label} style={{ marginBottom: 8 }}>
              <div style={{ fontSize: 9, fontWeight: 800, textTransform: "uppercase", letterSpacing: "0.6px", color: "#6b8072", marginBottom: 4 }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {group.items.map(item => {
                  const isChecked = visibleParameters[item.key] !== false;
                  return (
                    <label
                      key={item.key}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        gap: 8,
                        fontSize: 11,
                        cursor: "pointer",
                        color: isChecked ? "var(--text-primary)" : "var(--text-muted)",
                        fontWeight: isChecked ? 600 : 400,
                        padding: "2px 0"
                      }}
                    >
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => setVisibleParameters(prev => ({ ...prev, [item.key]: !prev[item.key] }))}
                        style={{ accentColor: "var(--green)" }}
                      />
                      <span>{item.emoji} {item.label}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div style={{
        position: "absolute",
        bottom: 28,
        left: 12,
        zIndex: 1000,
        display: "flex",
        flexDirection: "column",
        gap: 5,
        pointerEvents: "none",
      }}>
        <div style={{
          pointerEvents: legendOpen ? "all" : "none",
          opacity: legendOpen ? 1 : 0,
          maxHeight: legendOpen ? 220 : 0,
          overflow: "hidden",
          transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s",
          background: "rgba(255,255,255,0.96)",
          border: "1px solid rgba(0,102,51,0.16)",
          borderRadius: "8px",
          padding: legendOpen ? "9px 12px" : "0 12px",
          boxShadow: "0 2px 8px rgba(0,0,0,0.12)",
          fontSize: 10.5,
        }}>
          <div className="map-legend-title">Condition</div>
          {[
            { label: "Good Condition", color: "#006633" },
            { label: "Fair Condition", color: "#f59e0b" },
            { label: "Poor Condition", color: "#dc2626" },
            { label: "Mixed", color: "#7c3aed" },
            { label: "Under construction", color: "#2563eb" },
          ].map(item => (
            <div key={item.label} className="legend-row">
              <div className="legend-dot" style={{ background: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={() => setLegendOpen(o => !o)}
          title={legendOpen ? "Collapse legend" : "Expand legend"}
          style={{
            pointerEvents: "all",
            background: "#006633",
            border: "none",
            borderRadius: "8px",
            color: "#ffffff",
            padding: "5px 10px",
            fontSize: 10.5,
            fontWeight: 700,
            cursor: "pointer",
            display: "flex",
            alignItems: "center",
            gap: 5,
            boxShadow: "0 2px 8px rgba(0,0,0,0.22)",
            letterSpacing: "0.3px",
            fontFamily: "var(--font-body)",
            alignSelf: "flex-start",
          }}
        >
          <span>📋</span>
          Legend
          <span style={{ fontSize: 10 }}>{legendOpen ? "▾" : "▴"}</span>
        </button>
      </div>

      <MapContainer
        center={defaultCenter}
        zoom={6.5}
        scrollWheelZoom
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        <ZoomControl position="bottomright" />
        <TileLayer key={activeLayer} attribution={layer.attribution} url={layer.url} maxZoom={20} />
        {lineLayers}
        {markerLayers}
        <MapGoToController focus={mapFocus} />
        <SelectedAssetMarker focus={mapFocus} />
      </MapContainer>
    </div>
  );
}
