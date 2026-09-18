"use client";
import { useEffect, useMemo, useRef, useState } from "react";
import { MapContainer, TileLayer, Marker, useMap, ZoomControl, Polyline } from "react-leaflet";
import L from "leaflet";
import {
  getRecordStatus,
  getCategoryKey,
  getStatusColor,
  resolveAssetLocation,
  MAP_GOTO_EVENT,
  type MapGotoDetail,
} from "@/components/helpers";
import { Layers, ChevronDown } from "lucide-react";
import { BASEMAPS, type BasemapId } from "@/lib/mapLayers";

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

      // Keep the user's zoom — only pan so the asset stays in view
      if (detail.preserveZoom) {
        map.panTo([detail.lat, detail.lng], { animate: true, duration: 0.35 });
        (window as any).__motidLastGoto = {
          surveyId: detail.surveyId,
          lat: detail.lat,
          lng: detail.lng,
          nonce: detail.nonce,
          mode: "panTo",
          t: Date.now(),
        };
        return;
      }

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
    // Retry only when auto-zooming (layout races); preserveZoom needs a single pan
    if (focus.preserveZoom) return;
    const timers = [100, 300, 700, 1200, 2000].map((ms) => window.setTimeout(() => apply(focus), ms));
    return () => timers.forEach((t) => window.clearTimeout(t));
  }, [focus?.nonce, focus?.surveyId, map]); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

function SelectedAssetMarker({ focus }: { focus: MapGotoDetail | null }) {
  if (!focus || !Number.isFinite(focus.lat) || !Number.isFinite(focus.lng)) return null;

  return (
    <Marker
      position={[focus.lat, focus.lng]}
      icon={selectedPinIcon}
      zIndexOffset={2000}
    />
  );
}

const createCustomIcon = (condition: string) =>
  L.divIcon({
    className: "custom-div-icon",
    html: `<div class="map-pin ${condition}"></div>`,
    iconSize: [12, 12],
    iconAnchor: [6, 6],
  });

const hasValidGeo = (r: any) => {
  if (!Array.isArray(r?._geolocation) || r._geolocation.length < 2) return false;
  const lat = Number(r._geolocation[0]);
  const lng = Number(r._geolocation[1]);
  return Number.isFinite(lat) && Number.isFinite(lng);
};

function recordKey(record: any, prefix: string, index: number) {
  const id = record?._id ?? record?.id ?? record?.survey_id;
  return id != null && String(id).length > 0 ? `${prefix}-${id}-${index}` : `${prefix}-${index}`;
}

interface MapViewProps {
  records: any[];
  selectedRecord: any | null;
  mapFocus?: MapGotoDetail | null;
  onSelectRecord: (record: any) => void;
  visibleLayers?: Record<string, boolean>;
}

export default function MapView({
  records,
  selectedRecord,
  mapFocus = null,
  onSelectRecord,
  visibleLayers = {},
}: MapViewProps) {
  // Client-only mount — never manually touch Leaflet's _leaflet_id (that causes
  // "Map container is being reused by another instance" during remove).
  const [mounted, setMounted] = useState(false);
  useEffect(() => {
    setMounted(true);
  }, []);

  const defaultCenter: [number, number] = [-19.0154, 29.1549];
  const [legendOpen, setLegendOpen] = useState(false);
  const [basemap, setBasemap] = useState<BasemapId>("hybrid");
  const [basemapOpen, setBasemapOpen] = useState(false);
  const layer = BASEMAPS[basemap] ?? BASEMAPS.hybrid;

  const lineLayers = useMemo(() => {
    return records.map((record, index) => {
      const lineCoords = parseLineCoordinates(record);
      if (!lineCoords || lineCoords.length === 0) return null;
      const catKey = getCategoryKey(record);
      if (visibleLayers[catKey] === false) return null;
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
  }, [records, visibleLayers, selectedRecord, onSelectRecord]);

  const markerLayers = useMemo(() => {
    return records.map((record, index) => {
      if (!hasValidGeo(record)) return null;
      const catKey = getCategoryKey(record);
      if (visibleLayers[catKey] === false) return null;
      const condition = getRecordStatus(record);
      const lat = Number(record._geolocation[0]);
      const lng = Number(record._geolocation[1]);

      return (
        <Marker
          key={recordKey(record, "marker", index)}
          position={[lat, lng]}
          icon={createCustomIcon(condition)}
          eventHandlers={{ click: () => onSelectRecord(record) }}
        />
      );
    });
  }, [records, visibleLayers, onSelectRecord]);

  if (!mounted) {
    return (
      <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f1" }}>
        <div style={{ fontSize: 11, color: "#6b8072" }}>Loading map…</div>
      </div>
    );
  }

  return (
    <div style={{ width: "100%", height: "100%", position: "relative" }}>
      <div className="map-basemap">
        <button
          type="button"
          className="map-basemap-btn"
          onClick={() => setBasemapOpen((open) => !open)}
          aria-expanded={basemapOpen}
          title={basemapOpen ? "Hide base maps" : "Choose base map"}
        >
          <Layers size={13} />
          Base Map
          <ChevronDown size={13} className={basemapOpen ? "map-basemap-chevron open" : "map-basemap-chevron"} />
        </button>
        {basemapOpen && (
          <div className="map-basemap-menu" role="listbox" aria-label="Base maps">
            {(Object.values(BASEMAPS) as typeof BASEMAPS[BasemapId][]).map((item) => {
              const active = basemap === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  role="option"
                  aria-selected={active}
                  className={`map-basemap-option${active ? " active" : ""}`}
                  onClick={() => {
                    setBasemap(item.id);
                    setBasemapOpen(false);
                  }}
                >
                  <span>{item.emoji}</span>
                  <span>{item.label}</span>
                  {active && <span className="map-basemap-active">ACTIVE</span>}
                </button>
              );
            })}
          </div>
        )}
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
        <TileLayer key={basemap} attribution={layer.attribution} url={layer.url} maxZoom={20} />
        {lineLayers}
        {markerLayers}
        <MapGoToController focus={mapFocus} />
        <SelectedAssetMarker focus={mapFocus} />
      </MapContainer>
    </div>
  );
}
