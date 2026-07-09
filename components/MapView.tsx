"use client";
import { useEffect, useState, Fragment } from "react";
import { MapContainer, TileLayer, Marker, Popup, useMap, ZoomControl, Polyline } from "react-leaflet";
import L from "leaflet";
import { getRecordStatus, getAssetType, getAssetName, getCategoryKey } from "@/components/helpers";
import { Layers, ChevronLeft, ChevronRight } from "lucide-react";

const parseLineCoordinates = (record: any): [number, number][] | null => {
  const geojsonStr = record.road_segment_geojson || record.segment_geojson || record.raw_data?.road_segment_geojson || record.raw_data?.segment_geojson;
  
  if (geojsonStr) {
    try {
      const geojson = typeof geojsonStr === "string" ? JSON.parse(geojsonStr) : geojsonStr;
      if (geojson) {
        // Case 1: Root is a Feature containing a LineString geometry
        if (geojson.type === "Feature" && geojson.geometry && geojson.geometry.type === "LineString" && Array.isArray(geojson.geometry.coordinates)) {
          return geojson.geometry.coordinates.map((coord: any) => [Number(coord[1]), Number(coord[0])]); // Swap [lng, lat] to [lat, lng]
        }
        
        // Case 2: Root is directly a LineString
        if (geojson.type === "LineString" && Array.isArray(geojson.coordinates)) {
          return geojson.coordinates.map((coord: any) => [Number(coord[1]), Number(coord[0])]); // Swap [lng, lat] to [lat, lng]
        }
      }
    } catch (e) {
      console.error("Error parsing road segment geojson:", e);
    }
  }

  // Fallback: Check for trace coordinate strings (e.g. from Kobo or other forms)
  // in both the main record object and nested raw_data object
  const searchObjects = [record, record.raw_data].filter(Boolean);
  for (const obj of searchObjects) {
    for (const key of Object.keys(obj)) {
      if (key.toLowerCase().endsWith("_trace") || key.toLowerCase().includes("trace")) {
        const traceStr = obj[key];
        if (typeof traceStr === "string" && traceStr.trim().length > 0) {
          try {
            const points: [number, number][] = [];
            const parts = traceStr.split(";");
            for (const part of parts) {
              if (!part.trim()) continue;
              const coords = part.trim().split(" ");
              if (coords.length >= 2) {
                const lat = Number(coords[0]);
                const lng = Number(coords[1]);
                if (!isNaN(lat) && !isNaN(lng)) {
                  points.push([lat, lng]);
                }
              }
            }
            if (points.length > 0) {
              return points;
            }
          } catch (e) {
            console.error(`Error parsing trace string in key ${key}:`, e);
          }
        }
      }
    }
  }

  return null;
};

function ChangeMapCenter({ lat, lng }: { lat: number; lng: number }) {
  const map = useMap();
  useEffect(() => {
    const currentZoom = map.getZoom();
    // Keep current zoom if we are already zoomed in (zoom >= 12), otherwise zoom in to 14
    const targetZoom = currentZoom < 12 ? 14 : currentZoom;
    map.setView([lat, lng], targetZoom);
  }, [lat, lng, map]);
  return null;
}

const createCustomIcon = (condition: "good" | "fair" | "poor") =>
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

const hasValidGeo = (r: any) =>
  Array.isArray(r?._geolocation) &&
  r._geolocation.length >= 2 &&
  typeof r._geolocation[0] === "number" &&
  typeof r._geolocation[1] === "number";

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
  traffic_lights: true,
  streetlight: true
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
      { key: "shelvet", label: "Shelvets", emoji: "🧱" },
      { key: "grid", label: "Cattle Grids", emoji: "🐄" }
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
      { key: "traffic_lights", label: "Traffic Lights", emoji: "🚦" },
      { key: "streetlight", label: "Streetlights", emoji: "💡" }
    ]
  }
];



interface MapViewProps {
  records: any[];
  selectedRecord: any | null;
  onSelectRecord: (record: any) => void;
}

export default function MapView({ records, selectedRecord, onSelectRecord }: MapViewProps) {
  // Fix for Next.js HMR/Fast Refresh "Map container is already initialized" error
  if (typeof window !== "undefined") {
    const container = document.getElementById("map-container");
    if (container) {
      (container as any)._leaflet_id = null;
    }
  }

  const defaultCenter: [number, number] = [-19.0154, 29.1549];
  // Default to Google Hybrid
  const [activeLayer, setActiveLayer] = useState("hybrid");
  // Basemap panel open/collapsed
  const [basemapOpen, setBasemapOpen] = useState(false);
  // Legend open/collapsed
  const [legendOpen, setLegendOpen] = useState(false);
  // Parameter Layers checklist open/collapsed
  const [layersOpen, setLayersOpen] = useState(false);
  // Layer visibility state
  const [visibleParameters, setVisibleParameters] = useState<Record<string, boolean>>(INITIAL_VISIBLE_PARAMS);

  const layer = TILE_LAYERS[activeLayer];

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>


      {/* ── Basemap switcher — left side, collapsible ────────────────── */}
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
        {/* Toggle button */}
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

        {/* Panel */}
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

      {/* ── Parameter Layers switcher — right side, collapsible ───────── */}
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
        {/* Toggle button */}
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
          <span>📂</span>
          Parameter Layers
          {layersOpen ? <ChevronRight size={12} style={{ transform: "rotate(90deg)" }} /> : <ChevronLeft size={12} style={{ transform: "rotate(-90deg)" }} />}
        </button>

        {/* Panel */}
        <div style={{
          pointerEvents: layersOpen ? "all" : "none",
          opacity: layersOpen ? 1 : 0,
          maxHeight: layersOpen ? 460 : 0,
          overflowY: "auto",
          transition: "max-height 0.25s cubic-bezier(0.4,0,0.2,1), opacity 0.2s",
          background: "#ffffff",
          border: "1px solid rgba(0,102,51,0.18)",
          borderRadius: "10px",
          boxShadow: "0 4px 14px rgba(0,0,0,0.12)",
          padding: layersOpen ? "12px" : "0 12px",
          display: "flex",
          flexDirection: "column",
          gap: 10,
          minWidth: 220,
          maxWidth: 260,
        }}>
          {/* Shortcuts */}
          <div style={{ display: "flex", justifyContent: "space-between", borderBottom: "1px solid var(--border)", paddingBottom: 6 }}>
            <button
              onClick={() => setVisibleParameters(INITIAL_VISIBLE_PARAMS)}
              style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", fontSize: 10.5, fontWeight: 700, padding: 0 }}
            >
              Select All
            </button>
            <button
              onClick={() => {
                const cleared = { ...INITIAL_VISIBLE_PARAMS };
                Object.keys(cleared).forEach(k => cleared[k] = false);
                setVisibleParameters(cleared);
              }}
              style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 10.5, fontWeight: 700, padding: 0 }}
            >
              Clear All
            </button>
          </div>

          {/* Grouped list */}
          <div style={{ display: "flex", flexDirection: "column", gap: 10, maxHeight: 320, overflowY: "auto", paddingRight: 4 }}>
            {PARAMETER_GROUPS.map(g => (
              <div key={g.label} style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", borderBottom: "1px solid rgba(0,102,51,0.08)", paddingBottom: 2 }}>
                  {g.label}
                </div>
                {g.items.map(item => {
                  const isChecked = !!visibleParameters[item.key];
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
            ))}
          </div>
        </div>
      </div>

      {/* ── Condition legend — bottom-left, collapsible ─────────────── */}
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
        {/* Collapsed content (slides up) */}
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
          ].map(item => (
            <div key={item.label} className="legend-row">
              <div className="legend-dot" style={{ background: item.color }} />
              <span>{item.label}</span>
            </div>
          ))}
          <div style={{ marginTop: 5, borderTop: "1px solid rgba(0,102,51,0.1)", paddingTop: 5 }}>
            <div className="map-legend-title" style={{ marginBottom: 3 }}>Assets</div>
            {[
              { label: "Bridge / Culvert" },
              { label: "Junction / Sign" },
              { label: "Road Segment" },
              { label: "Bus Stop / Light" },
            ].map(item => (
              <div key={item.label} className="legend-row">
                <span style={{ fontSize: 9, color: "#6b8072" }}>●</span>
                <span>{item.label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Toggle button — sits below the content */}
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

      {/* ── Map ─────────────────────────────────────────────────────── */}
      <MapContainer
        id="map-container"
        center={defaultCenter}
        zoom={6.5}
        scrollWheelZoom
        zoomControl={false}
        style={{ width: "100%", height: "100%" }}
      >
        {/* Zoom control moved to bottom-right, away from basemap panel */}
        <ZoomControl position="bottomright" />

        <TileLayer key={activeLayer} attribution={layer.attribution} url={layer.url} maxZoom={20} />

        {records.map(record => {
          const lineCoords = parseLineCoordinates(record);
          if (!lineCoords || lineCoords.length === 0) return null;
          const catKey = getCategoryKey(record);
          if (!visibleParameters[catKey]) return null;
          const condition = getRecordStatus(record);

          return (
            <Polyline
              key={`line-${record._id}`}
              positions={lineCoords}
              pathOptions={{
                color: condition === "good" ? "#006633" : condition === "fair" ? "#f59e0b" : "#dc2626",
                weight: selectedRecord && selectedRecord._id === record._id ? 7 : 4,
                opacity: selectedRecord && selectedRecord._id === record._id ? 1.0 : 0.7,
              }}
              eventHandlers={{ click: () => onSelectRecord(record) }}
            />
          );
        })}

        {records.map(record => {
          if (!hasValidGeo(record)) return null;
          const catKey = getCategoryKey(record);
          if (!visibleParameters[catKey]) return null;
          const condition = getRecordStatus(record);
          const assetType = getAssetType(record);
          const name = getAssetName(record);

          return (
            <Marker
              key={`marker-${record._id}`}
              position={[record._geolocation[0], record._geolocation[1]]}
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
                      { label: "Condition", val: condition.toUpperCase(), color: condition === "good" ? "#006633" : condition === "fair" ? "#b45309" : "#b91c1c" },
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
        })}

        {selectedRecord && hasValidGeo(selectedRecord) && (
          <ChangeMapCenter lat={selectedRecord._geolocation[0]} lng={selectedRecord._geolocation[1]} />
        )}
      </MapContainer>
    </div>
  );
}
