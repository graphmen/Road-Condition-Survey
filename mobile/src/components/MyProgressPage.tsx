import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { MapPin, RefreshCw, User, Layers, Route } from "lucide-react";
import type { SurveyDraft } from "../lib/db";
import type { MobileUserProfile } from "../lib/auth";
import { mobileAuthFetch, MOBILE_ROLE_LABELS } from "../lib/auth";
import {
  localDraftsForUser,
  mergeProgressSurveys,
  serverRecordsForUser,
  summarizeProgress,
  type ProgressSurveyItem,
} from "../lib/mySurveys";

const SOURCE_COLORS: Record<string, string> = {
  local_draft: "#f59e0b",
  local_queued: "#3b82f6",
  server: "#006633",
};

type Props = {
  user: MobileUserProfile;
  drafts: SurveyDraft[];
  apiBase: string;
  isOnline: boolean;
};

export function MyProgressPage({ user, drafts, apiBase, isOnline }: Props) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const layerRef = useRef<L.LayerGroup | null>(null);

  const [serverRecords, setServerRecords] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showList, setShowList] = useState(true);

  const localItems = useMemo(() => localDraftsForUser(drafts, user), [drafts, user]);
  const serverItems = useMemo(() => serverRecordsForUser(serverRecords, user), [serverRecords, user]);
  const items = useMemo(() => mergeProgressSurveys(localItems, serverItems), [localItems, serverItems]);
  const summary = useMemo(() => summarizeProgress(items), [items]);

  const fetchServer = useCallback(async () => {
    if (!apiBase) return;
    setLoading(true);
    setLoadError(null);
    try {
      const res = await mobileAuthFetch(apiBase, "/api/roads?refresh=1");
      if (!res.ok) throw new Error(`Server returned ${res.status}`);
      const data = await res.json();
      setServerRecords(Array.isArray(data.records) ? data.records : []);
    } catch (e: unknown) {
      setLoadError(e instanceof Error ? e.message : "Could not load synced surveys");
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    if (isOnline) fetchServer();
  }, [isOnline, fetchServer]);

  // Init map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      center: [-19.0, 29.5],
      zoom: 7,
      zoomControl: false,
      attributionControl: false,
    });

    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      maxNativeZoom: 19,
    }).addTo(map);

    L.control.zoom({ position: "topright" }).addTo(map);
    layerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
      layerRef.current = null;
    };
  }, []);

  // Draw features
  useEffect(() => {
    const map = mapRef.current;
    const group = layerRef.current;
    if (!map || !group) return;

    group.clearLayers();
    const bounds: L.LatLngExpression[] = [];

    for (const item of items) {
      const loc = item.location;
      if (!loc) continue;
      const color = SOURCE_COLORS[item.source] || "#006633";
      const isSelected = selectedId === item.id;

      if (loc.kind === "line" && loc.coords.length >= 2) {
        const latlngs = loc.coords.map(([lat, lng]) => L.latLng(lat, lng));
        latlngs.forEach((ll) => bounds.push(ll));
        L.polyline(latlngs, {
          color,
          weight: isSelected ? 6 : 4,
          opacity: isSelected ? 1 : 0.85,
        })
          .bindPopup(buildPopup(item))
          .on("click", () => setSelectedId(item.id))
          .addTo(group);
      } else {
        bounds.push([loc.lat, loc.lng]);
        L.circleMarker([loc.lat, loc.lng], {
          radius: isSelected ? 9 : 7,
          color: "#fff",
          weight: 2,
          fillColor: color,
          fillOpacity: 0.95,
        })
          .bindPopup(buildPopup(item))
          .on("click", () => setSelectedId(item.id))
          .addTo(group);
      }
    }

    if (bounds.length > 0) {
      try {
        map.fitBounds(L.latLngBounds(bounds), { padding: [24, 24], maxZoom: 14 });
      } catch {
        /* ignore */
      }
    }
  }, [items, selectedId]);

  // Fix map size when tab becomes visible
  useEffect(() => {
    const t = setTimeout(() => mapRef.current?.invalidateSize(), 200);
    return () => clearTimeout(t);
  }, [items.length]);

  const categoryRows = Object.entries(summary.byCategory).sort((a, b) => b[1] - a[1]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "10px", height: "100%", minHeight: 0 }}>
      {/* User header */}
      <div
        style={{
          background: "linear-gradient(135deg, var(--bg-sidebar), #002210)",
          borderRadius: "var(--radius-md)",
          padding: "12px 14px",
          color: "#fff",
          border: "1px solid var(--border-color)",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div
            style={{
              width: 36,
              height: 36,
              borderRadius: "50%",
              background: "rgba(255,255,255,0.12)",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            <User size={18} color="#FFD100" />
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontWeight: 800, fontSize: "13px", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {user.full_name}
            </div>
            <div style={{ fontSize: "10px", opacity: 0.85 }}>
              {MOBILE_ROLE_LABELS[user.role]}
              {user.province ? ` · ${user.province}` : ""}
            </div>
          </div>
          <button
            type="button"
            onClick={fetchServer}
            disabled={loading || !isOnline}
            className="mobile-btn mobile-btn-outline"
            style={{
              height: 32,
              padding: "0 10px",
              fontSize: "10px",
              borderColor: "rgba(255,255,255,0.35)",
              color: "#fff",
              opacity: isOnline ? 1 : 0.5,
            }}
            title="Refresh synced surveys from server"
          >
            <RefreshCw size={14} style={{ animation: loading ? "spin 1s linear infinite" : undefined }} />
          </button>
        </div>
      </div>

      {/* Stats strip */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "6px" }}>
        {[
          { label: "Total", value: summary.total, icon: Layers },
          { label: "On map", value: summary.withLocation, icon: MapPin },
          { label: "Road km", value: summary.totalLengthKm.toFixed(1), icon: Route },
          { label: "Synced", value: summary.synced, icon: RefreshCw },
        ].map(({ label, value, icon: Icon }) => (
          <div
            key={label}
            style={{
              background: "var(--bg-card)",
              border: "1px solid var(--border-color)",
              borderRadius: "var(--radius-sm)",
              padding: "8px 6px",
              textAlign: "center",
            }}
          >
            <Icon size={12} color="var(--accent-emerald)" style={{ marginBottom: 2 }} />
            <div style={{ fontSize: "14px", fontWeight: 800, color: "var(--text-primary)" }}>{value}</div>
            <div style={{ fontSize: "8px", fontWeight: 700, textTransform: "uppercase", color: "var(--text-muted)" }}>{label}</div>
          </div>
        ))}
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap", fontSize: "9px", color: "var(--text-muted)" }}>
        <span><span style={{ color: SOURCE_COLORS.server }}>●</span> Synced</span>
        <span><span style={{ color: SOURCE_COLORS.local_queued }}>●</span> Queued</span>
        <span><span style={{ color: SOURCE_COLORS.local_draft }}>●</span> Draft</span>
        {!isOnline && <span style={{ color: "var(--accent-rose)" }}>Offline — showing local surveys only</span>}
        {loadError && <span style={{ color: "var(--accent-rose)" }}>{loadError}</span>}
      </div>

      {/* Map */}
      <div
        ref={mapContainerRef}
        style={{
          flex: "1 1 220px",
          minHeight: 220,
          borderRadius: "var(--radius-md)",
          border: "1px solid var(--border-color)",
          overflow: "hidden",
          background: "#e8ece9",
        }}
      />

      {/* Toggle list */}
      <button
        type="button"
        onClick={() => setShowList((v) => !v)}
        className="mobile-btn mobile-btn-outline"
        style={{ height: 34, fontSize: "11px" }}
      >
        {showList ? "Hide" : "Show"} survey list ({items.length})
      </button>

      {showList && (
        <div
          style={{
            maxHeight: 180,
            overflowY: "auto",
            display: "flex",
            flexDirection: "column",
            gap: "6px",
            paddingBottom: 4,
          }}
        >
          {items.length === 0 ? (
            <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)", textAlign: "center", padding: 12 }}>
              No surveys linked to your account yet. Complete a survey with your name as surveyor, then return here.
            </p>
          ) : (
            items.map((item) => (
              <button
                key={`${item.source}-${item.id}`}
                type="button"
                onClick={() => setSelectedId(item.id)}
                style={{
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: "var(--radius-sm)",
                  border: selectedId === item.id ? "2px solid var(--accent-emerald)" : "1px solid var(--border-color)",
                  background: "var(--bg-card)",
                  cursor: "pointer",
                }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", gap: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: "11px", color: "var(--text-primary)" }}>
                    {(item.road_name || "Unnamed route").slice(0, 40)}
                  </span>
                  <span
                    style={{
                      fontSize: "9px",
                      fontWeight: 700,
                      color: SOURCE_COLORS[item.source],
                      whiteSpace: "nowrap",
                    }}
                  >
                    {item.status_label}
                  </span>
                </div>
                <div style={{ fontSize: "10px", color: "var(--text-muted)", marginTop: 2 }}>
                  {item.asset_category.replace(/_/g, " ")}
                  {item.section_name ? ` · ${item.section_name}` : ""}
                  {item.survey_date ? ` · ${item.survey_date}` : ""}
                  {!item.location && " · no GPS"}
                </div>
              </button>
            ))
          )}
        </div>
      )}

      {categoryRows.length > 0 && (
        <div style={{ fontSize: "9px", color: "var(--text-muted)", paddingBottom: 4 }}>
          By type: {categoryRows.map(([cat, n]) => `${cat.replace(/_/g, " ")} (${n})`).join(" · ")}
        </div>
      )}
    </div>
  );
}

function buildPopup(item: ProgressSurveyItem): string {
  const lines = [
    `<strong>${escapeHtml(item.road_name || "Survey")}</strong>`,
    item.section_name ? escapeHtml(item.section_name) : "",
    `${item.asset_category.replace(/_/g, " ")} · ${item.status_label}`,
    item.survey_date ? `Date: ${escapeHtml(item.survey_date)}` : "",
    item.length_m ? `Length: ${(item.length_m / 1000).toFixed(2)} km` : "",
  ].filter(Boolean);
  return lines.join("<br/>");
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
