"use client";
import { useState, useEffect, useMemo, memo } from "react";
import { LayoutDashboard, Route, BarChart2, ClipboardCheck, Download, ArrowUpDown, Search, X, ChevronDown, ChevronUp, Camera, FileText, BookOpen, Trash2, Compass, Users, ShieldAlert, ChevronLeft, ChevronRight, LayoutGrid, Table2, Settings } from "lucide-react";
import {
  getRecordStatus, getAssetType, getAssetName, formatStatusLabel, getStatusColor, normalizePhotos, mergePhotoLists, getSadcValue,
  AUTHORITY_OPTIONS, CONDITION_WITH_CONSTRUCTION_OPTIONS,
  formatGpsLabel,
} from "@/components/helpers";
import { OVERLAY_GROUPS } from "@/lib/mapLayers";
import { ZIM_PROVINCES_DISTRICTS } from "@/lib/zimbabwe";
import type { NavModule } from "./LeftNav";
import GalleryPage from "./GalleryPage";
import AnalyticsPage from "./AnalyticsPage";
import HighwaysPage from "./HighwaysPage";
import ExportPage from "./ExportPage";
import ReportsPage from "./ReportsPage";
import DashboardPage from "./DashboardPage";
import SettingsPage from "./SettingsPage";
import { useCategoryBrowse } from "@/hooks/useCategoryBrowse";
import {
  SEALED_ROAD_CLASS_OPTIONS,
  SEALED_ROAD_TYPE_OPTIONS,
  SURFACE_TYPE_OPTIONS,
  POTHOLE_DENSITY_OPTIONS,
  POTHOLE_PATCHES_OPTIONS,
  DRAINAGE_TYPE_OPTIONS,
  DRAINAGE_LINING_OPTIONS,
  MEDIAN_TYPE_OPTIONS,
  YES_NO_OPTIONS,
  DEFECT_SEVERITY_OPTIONS,
  TRAFFIC_CALMING_TYPES,
  isDualCarriageway,
  mapLegacyPotholePatches,
} from "../sealedRoadConfig";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const EXCLUDED_KEYS = new Set([
  "_id",
  "_geolocation",
  "gps",
  "raw_data",
  "geom_point",
  "geom_segment",
  "road_segment_geojson",
  "segment_geojson",
  "road_segment_points",
  "created_at",
  "geom",
  "geometry",
  "type",
  "coordinates",
  "features",
  "properties",
  "geom_point_wkt",
  "geom_segment_wkt",
  "id",
  "uuid"
]);

const formatKey = (key: string): string => {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
};

const formatValue = (val: any): string => {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "YES" : "NO";
  const s = String(val);
  if (s.toLowerCase() === "yes" || s.toLowerCase() === "no") return s.toUpperCase();
  return s.replace(/_/g, " ").toUpperCase();
};


/* Dashboard page lives in ./DashboardPage.tsx */

/* Highways page lives in ./HighwaysPage.tsx */

/* Analytics page lives in ./AnalyticsPage.tsx */

/* ═══════════════════════════════════════════════════════════════════════════
   SURVEY RECORDS
════════════════════════════════════════════════════════════════════════════ */
const SURVEY_PAGE_SIZE = 24;

const SURVEY_DETAIL_EXCLUDED = new Set([
  "_id", "_geolocation", "gps", "raw_data", "geom_point", "geom_segment",
  "road_segment_geojson", "segment_geojson", "road_segment_points", "created_at",
  "geom", "geometry", "type", "coordinates", "features", "properties",
  "geom_point_wkt", "geom_segment_wkt", "id", "uuid", "photo", "photos", "_allPhotos",
]);

const SURVEY_DETAIL_CORE = new Set([
  "road_name", "section_name", "surveyor_name", "survey_date", "province", "district",
  "asset_category", "section", "road_condition", "source",
  "image_SADC_compliant", "image_sadc_compliant", "sadc_compliant", "sign_sadc_compliant",
]);

function surveyFormatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function surveyFormatValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "YES" : "NO";
  const s = String(val);
  if (s.toLowerCase() === "yes" || s.toLowerCase() === "no") return s.toUpperCase();
  return s.replace(/_/g, " ").toUpperCase();
}

const SurveyAssetCard = memo(function SurveyAssetCard({
  record,
  selected,
  onOpen,
  onShowOnMap,
}: {
  record: any;
  selected?: boolean;
  onOpen: (r: any) => void;
  onShowOnMap: (r: any) => void;
}) {
  const status = getRecordStatus(record);
  const poorBorder = status === "poor" ? "rgba(220,38,38,0.25)" : "var(--border)";
  const gpsLabel = formatGpsLabel(record);

  return (
    <div
      onClick={() => onOpen(record)}
      style={{
        background: selected ? "var(--bg-active)" : "#fff",
        borderRadius: 10,
        border: `1.5px solid ${selected ? "var(--green)" : poorBorder}`,
        padding: "13px 15px",
        cursor: "pointer",
        transition: "border-color 0.15s, background 0.15s",
        boxShadow: "var(--shadow-sm)",
      }}
      onMouseOver={(e) => {
        if (!selected) e.currentTarget.style.borderColor = "var(--green)";
      }}
      onMouseOut={(e) => {
        if (!selected) e.currentTarget.style.borderColor = poorBorder;
      }}
    >
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
        <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{getAssetName(record)}</div>
        <span className={`badge ${status}`}>{status}</span>
      </div>
      <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 8 }}>
        {(record.road_name ?? "—").split(" (")[0]} · {record.section_name ?? "—"}
      </div>
      <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
        <span style={{ color: "var(--green)", fontWeight: 700, textTransform: "uppercase", fontSize: 9.5 }}>
          {getAssetType(record)}
        </span>
        <span style={{ color: "var(--text-muted)" }}>{record.survey_date ?? "—"}</span>
      </div>
      <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--text-secondary)", fontFamily: "ui-monospace, monospace" }}>
        GPS: {gpsLabel ?? "—"}
      </div>
      {record.surveyor_name && (
        <div style={{ marginTop: 5, fontSize: 10, color: "var(--text-muted)" }}>👤 {record.surveyor_name}</div>
      )}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onShowOnMap(record);
        }}
        style={{
          marginTop: 8,
          fontSize: 10,
          fontWeight: 700,
          color: "var(--green)",
          background: "none",
          border: "none",
          padding: 0,
          cursor: "pointer",
          fontFamily: "var(--font-body)",
        }}
      >
        🗺 Show on map
      </button>
    </div>
  );
});

function SurveyDetailDrawer({
  record,
  onClose,
  onShowOnMap,
}: {
  record: any;
  onClose: () => void;
  onShowOnMap: (r: any) => void;
}) {
  const [fetchedPhotos, setFetchedPhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const status = getRecordStatus(record);
  const photos = useMemo(
    () => mergePhotoLists(normalizePhotos(record), fetchedPhotos),
    [record, fetchedPhotos]
  );

  useEffect(() => {
    setFetchedPhotos([]);
    const id = record.id || record._id || record.survey_id;
    if (!id) return;
    const embedded = normalizePhotos(record);
    if (embedded.length > 0) {
      setFetchedPhotos(embedded);
      return;
    }
    let alive = true;
    setLoadingPhotos(true);
    fetch(`/api/roads?photoFor=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (!alive) return;
        const remote =
          Array.isArray(data.photos) && data.photos.length > 0
            ? data.photos
            : data.photo
              ? [data.photo]
              : [];
        if (remote.length > 0) setFetchedPhotos(remote);
      })
      .catch(() => {})
      .finally(() => {
        if (alive) setLoadingPhotos(false);
      });
    return () => {
      alive = false;
    };
  }, [record]);

  const dynamicRows = Object.entries(record)
    .filter(([key, val]) => {
      if (SURVEY_DETAIL_EXCLUDED.has(key)) return false;
      if (SURVEY_DETAIL_CORE.has(key)) return false;
      if (val === null || val === undefined || val === "") return false;
      if (typeof val === "object") return false;
      return true;
    })
    .map(([key, val]) => ({
      key,
      label: surveyFormatKey(key),
      value: surveyFormatValue(val),
    }));

  const gpsLabel = formatGpsLabel(record);

  return (
    <>
      <div
        onClick={onClose}
        style={{
          position: "absolute",
          inset: 0,
          background: "rgba(15, 23, 42, 0.35)",
          zIndex: 40,
        }}
      />
      <aside
        style={{
          position: "absolute",
          top: 0,
          right: 0,
          bottom: 0,
          width: "min(380px, 92vw)",
          background: "#fff",
          borderLeft: "1px solid var(--border)",
          boxShadow: "-8px 0 28px rgba(0,0,0,0.12)",
          zIndex: 50,
          display: "flex",
          flexDirection: "column",
          animation: "surveyDrawerIn 0.2s ease-out",
        }}
      >
        <div style={{
          padding: "14px 16px",
          borderBottom: "1px solid var(--border)",
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "space-between",
          gap: 10,
          flexShrink: 0,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 4 }}>
              Asset Inspector
            </div>
            <div style={{ fontWeight: 800, fontSize: 15, color: "var(--text-primary)", lineHeight: 1.25 }}>
              {getAssetName(record)}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", marginTop: 2 }}>{getAssetType(record)}</div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexShrink: 0 }}>
            <span className={`badge ${status}`}>{formatStatusLabel(status)}</span>
            <button
              type="button"
              onClick={onClose}
              style={{
                width: 30, height: 30, borderRadius: 8, border: "1px solid var(--border)",
                background: "var(--bg-app)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center",
              }}
              title="Close"
            >
              <X size={14} />
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: 16 }}>
          <div style={{ marginBottom: 14 }}>
            <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
              <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)" }}>
                Photos Collected
              </span>
              <span style={{ fontSize: 10, fontWeight: 600, color: photos.length ? "var(--green)" : "var(--text-muted)" }}>
                {loadingPhotos ? "…" : `${photos.length} photo${photos.length !== 1 ? "s" : ""}`}
              </span>
            </div>
            {loadingPhotos ? (
              <div style={{ textAlign: "center", padding: 14, color: "var(--text-muted)", fontSize: 11, background: "rgba(0,0,0,0.03)", borderRadius: 8 }}>
                Loading photos…
              </div>
            ) : photos.length === 0 ? (
              <div style={{ textAlign: "center", padding: 14, color: "var(--text-muted)", fontSize: 11, background: "rgba(0,0,0,0.03)", borderRadius: 8, border: "1px dashed rgba(0,0,0,0.1)" }}>
                No photos captured for this asset
              </div>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: photos.length === 1 ? "1fr" : "1fr 1fr", gap: 6 }}>
                {photos.slice(0, 6).map((src, idx) => (
                  <div key={idx} style={{ borderRadius: 8, overflow: "hidden", border: "1px solid rgba(0,102,51,0.15)", aspectRatio: "4/3" }}>
                    <img src={src} alt={`Photo ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
            {[
              ["Road Route", (record.road_name ?? "—").split(" (")[0]],
              ["Section", record.section_name ?? "—"],
              ["Province", record.province],
              ["District", record.district],
              ["Surveyor", record.surveyor_name ?? "—"],
              ["Date", record.survey_date ?? "—"],
              ["GPS", gpsLabel ?? "—"],
              ["SADC Compliant", (getSadcValue(record) || "").toUpperCase() || null],
            ]
              .filter(([, v]) => v != null && v !== "")
              .map(([label, value]) => (
                <div key={String(label)} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(0,102,51,0.06)" }}>
                  <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600 }}>{label}</span>
                  <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600, textAlign: "right" }}>{value}</span>
                </div>
              ))}

            {dynamicRows.length > 0 && (
              <>
                <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--green)", borderTop: "1px solid var(--border)", paddingTop: 10, marginTop: 8, marginBottom: 4 }}>
                  Telemetry Attributes
                </div>
                {dynamicRows.map((row) => (
                  <div key={row.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, padding: "7px 0", borderBottom: "1px solid rgba(0,102,51,0.06)" }}>
                    <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 600 }}>{row.label}</span>
                    <span style={{ fontSize: 11, color: "var(--text-primary)", fontWeight: 600, textAlign: "right", maxWidth: "55%" }}>{row.value}</span>
                  </div>
                ))}
              </>
            )}
          </div>
        </div>

        <div style={{ padding: 14, borderTop: "1px solid var(--border)", flexShrink: 0 }}>
          <button
            type="button"
            onClick={() => onShowOnMap(record)}
            style={{
              width: "100%",
              padding: "10px 14px",
              borderRadius: 8,
              border: "none",
              background: "var(--green)",
              color: "#fff",
              fontSize: 12,
              fontWeight: 700,
              cursor: "pointer",
              fontFamily: "var(--font-body)",
            }}
          >
            🗺 Show on map
          </button>
        </div>
      </aside>
    </>
  );
}

function SurveyPage({ onSelectRecord }: { records?: any[]; onSelectRecord: (r: any) => void }) {
  const [category, setCategory] = useState("sealed");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [cond, setCond] = useState("all");
  const [road, setRoad] = useState("all");
  const [page, setPage] = useState(0);
  const [drawerRecord, setDrawerRecord] = useState<any | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const {
    records: pageRecords,
    total,
    counts,
    stats: categoryStats,
    roads,
    loading,
    error,
  } = useCategoryBrowse({
    category,
    page,
    pageSize: SURVEY_PAGE_SIZE,
    search: searchDebounced,
    condition: cond,
    road,
  });

  const pages = Math.max(1, Math.ceil(total / SURVEY_PAGE_SIZE));
  const pageSafe = Math.min(page, pages - 1);

  useEffect(() => {
    if (page > pages - 1) setPage(Math.max(0, pages - 1));
  }, [page, pages]);

  const activeLabel =
    OVERLAY_GROUPS.flatMap((g) => g.items).find((i) => i.key === category)?.label ?? category;

  const selectCategory = (key: string) => {
    setCategory(key);
    setRoad("all");
    setPage(0);
    setDrawerRecord(null);
  };

  const drawerId = drawerRecord
    ? String(drawerRecord.id || drawerRecord._id || drawerRecord.survey_id || "")
    : "";

  return (
    <div style={{ height: "100%", display: "flex", background: "var(--bg-app)", position: "relative", overflow: "hidden" }}>
      {/* Left: asset type panel */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "#fff",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            Asset Type
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
            Select one category to browse
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 12px" }}>
          {OVERLAY_GROUPS.map((group) => (
            <div key={group.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "4px 8px 6px" }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {group.items.map((item) => {
                  const count = counts[item.key] || 0;
                  const active = category === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => selectCategory(item.key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: active ? "1.5px solid var(--green)" : "1px solid transparent",
                        background: active ? "var(--bg-active)" : "transparent",
                        color: active ? "var(--green)" : "var(--text-secondary)",
                        fontSize: 11.5,
                        fontWeight: active ? 800 : 600,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span aria-hidden>{item.emoji}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: active ? "rgba(0,102,51,0.12)" : "rgba(0,0,0,0.05)",
                        borderRadius: 10,
                        padding: "1px 7px",
                        flexShrink: 0,
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Per-asset stats (moved from right panel) */}
        <div style={{
          background: "var(--green)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexShrink: 0,
          flexWrap: "wrap",
        }}>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700 }}>
            {activeLabel} · condition snapshot
          </div>
          <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
            {[
              { label: "Total", value: categoryStats.total, color: "#fff" },
              { label: "Good", value: categoryStats.good, color: "#fff" },
              { label: "Fair", value: categoryStats.fair, color: "#fff" },
              { label: "Poor", value: categoryStats.poor, color: categoryStats.poor > 0 ? "#FFD100" : "#fff" },
            ].map((stat, i) => (
              <div key={stat.label} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)", margin: "0 14px" }} />}
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontFamily: "var(--font-title)", fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Filter bar */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "#fafcfb", display: "flex", gap: 10, alignItems: "center", flexShrink: 0, flexWrap: "wrap" }}>
          <div style={{ position: "relative", flex: "2 1 200px", minWidth: 180 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              placeholder={`Search ${activeLabel.toLowerCase()}…`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ width: "100%", padding: "8px 10px 8px 30px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-primary)" }}
            />
          </div>
          <select
            value={cond}
            onChange={(e) => { setCond(e.target.value); setPage(0); }}
            style={{ padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)", background: "#fff" }}
          >
            <option value="all">All Conditions</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="mixed">Mixed</option>
            <option value="under_construction">Under construction</option>
          </select>
          <select
            value={road}
            onChange={(e) => { setRoad(e.target.value); setPage(0); }}
            style={{ padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)", background: "#fff", flex: "1 1 160px" }}
          >
            <option value="all">All Highways</option>
            {roads.map((r) => (
              <option key={r} value={r}>{(r ?? "").split(" (")[0]}</option>
            ))}
          </select>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {loading ? "Loading…" : `${total} records`}
          </span>
        </div>

        {/* Cards grid */}
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          {error ? (
            <div style={{ textAlign: "center", color: "#dc2626", padding: 40, fontSize: 13 }}>{error}</div>
          ) : loading && pageRecords.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 13 }}>Loading {activeLabel.toLowerCase()}…</div>
          ) : pageRecords.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 13 }}>
              No {activeLabel.toLowerCase()} match your filters.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, opacity: loading ? 0.6 : 1 }}>
              {pageRecords.map((r, i) => {
                const id = String(r.id || r._id || r.survey_id || "");
                return (
                  <SurveyAssetCard
                    key={id || `${category}-${pageSafe}-${i}`}
                    record={r}
                    selected={!!drawerId && id === drawerId}
                    onOpen={setDrawerRecord}
                    onShowOnMap={onSelectRecord}
                  />
                );
              })}
            </div>
          )}
        </div>

        {/* Pagination */}
        <div style={{
          padding: "10px 20px",
          borderTop: "1px solid var(--border)",
          background: "#fff",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          flexShrink: 0,
          gap: 12,
        }}>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Showing {total === 0 ? 0 : pageSafe * SURVEY_PAGE_SIZE + 1}–
            {Math.min((pageSafe + 1) * SURVEY_PAGE_SIZE, total)} of {total}
          </span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <button
              type="button"
              disabled={pageSafe <= 0 || loading}
              onClick={() => setPage((p) => Math.max(0, p - 1))}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                border: "1px solid var(--border)", background: pageSafe <= 0 ? "#f3f4f6" : "#fff",
                color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: pageSafe <= 0 ? "not-allowed" : "pointer",
              }}
            >
              <ChevronLeft size={14} /> Prev
            </button>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>
              Page {pageSafe + 1} / {pages}
            </span>
            <button
              type="button"
              disabled={pageSafe >= pages - 1 || loading}
              onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
              style={{
                display: "flex", alignItems: "center", gap: 4, padding: "6px 10px", borderRadius: 8,
                border: "1px solid var(--border)", background: pageSafe >= pages - 1 ? "#f3f4f6" : "#fff",
                color: "var(--text-secondary)", fontSize: 11, fontWeight: 700, cursor: pageSafe >= pages - 1 ? "not-allowed" : "pointer",
              }}
            >
              Next <ChevronRight size={14} />
            </button>
          </div>
        </div>
      </div>

      {drawerRecord && (
        <SurveyDetailDrawer
          record={drawerRecord}
          onClose={() => setDrawerRecord(null)}
          onShowOnMap={onSelectRecord}
        />
      )}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DATABASE EXPLORER
════════════════════════════════════════════════════════════════════════════ */
const PAGE_SIZE = 25;
type SortDir = "asc" | "desc";

interface SurveyFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  record: any | null;
  onSave: (record: any) => Promise<void>;
  onToast?: (msg: string, type: "success" | "error" | "info") => void;
}

// Category definitions for visual picker
const CATEGORY_GROUPS = [
  {
    groupLabel: "Roads",
    color: "#006633",
    emoji: "🛣️",
    items: [
      { key: "sealed",      label: "Sealed Road",     emoji: "🔲" },
      { key: "gravel",      label: "Gravel Road",    emoji: "🪨" },
      { key: "earth",       label: "Earth Road",     emoji: "🌿" },
    ]
  },
  {
    groupLabel: "Structures",
    color: "#1d6fa4",
    emoji: "🏗️",
    items: [
      { key: "bridge",       label: "Bridge",         emoji: "🌉" },
      { key: "footbridge",   label: "Foot Bridge",    emoji: "🚶" },
      { key: "rail_crossing",label: "Rail Crossing",  emoji: "🚂" },
      { key: "tollgate",     label: "Tollgate",       emoji: "🏁" },
      { key: "drift",        label: "Drift",          emoji: "💧" },
    ]
  },
  {
    groupLabel: "Drainage",
    color: "#0891b2",
    emoji: "🌊",
    items: [
      { key: "culvert",       label: "Culvert",        emoji: "🔩" },
      { key: "piped_causeway",label: "Piped Causeway", emoji: "📡" },
      { key: "shelvet",       label: "Shelvert",        emoji: "🛡️" },
      { key: "grid",          label: "Grid",           emoji: "#️⃣" },
      { key: "catchpit",      label: "Catchpit",       emoji: "🕳️" },
    ]
  },
  {
    groupLabel: "Amenities",
    color: "#7c3aed",
    emoji: "🏢",
    items: [
      { key: "layby",   label: "Lay By",   emoji: "🅿️" },
      { key: "busstop", label: "Bus Stop", emoji: "🚌" },
      { key: "junction",label: "Junction", emoji: "✖️" },
      { key: "road_rupture", label: "Road Rupture", emoji: "⚠️" },
    ]
  },
  {
    groupLabel: "Traffic & Lighting",
    color: "#d97706",
    emoji: "🚦",
    items: [
      { key: "sign",           label: "Road Sign",      emoji: "⚠️" },
      { key: "traffic_lights", label: "Traffic Lights", emoji: "🚦" },
      { key: "streetlight",    label: "Streetlight",    emoji: "💡" },
      { key: "traffic_calming", label: "Traffic Calming", emoji: "🛑" },
    ]
  },
];

function recordField(record: any, ...keys: string[]): any {
  const sources = [record, record?.raw_data].filter(Boolean);
  for (const key of keys) {
    for (const src of sources) {
      const v = src[key];
      if (v !== undefined && v !== null && v !== "") return v;
    }
  }
  return undefined;
}

function SurveyFormModal({ isOpen, onClose, record, onSave, onToast }: SurveyFormModalProps) {
  const [section, setSection] = useState<string>("sealed");
  const [isSaving, setIsSaving] = useState(false);
  const [roadName, setRoadName] = useState("A4 Highway (Harare - Masvingo - Beitbridge)");
  const [sectionName, setSectionName] = useState("");
  const [chainageFrom, setChainageFrom] = useState("");
  const [chainageTo, setChainageTo] = useState("");
  const [surveyorName, setSurveyorName] = useState("");
  const [surveyDate, setSurveyDate] = useState(new Date().toISOString().split("T")[0]);
  const [vegetation, setVegetation] = useState("none");
  const [gps, setGps] = useState("");
  const [imageSadcCompliant, setImageSadcCompliant] = useState<"yes" | "no" | "mixed">("yes");

  // Sealed Roads Fields
  const [pavedRoadName, setPavedRoadName] = useState("");
  const [pavedRoadClass, setPavedRoadClass] = useState("secondary");
  const [pavedRoadType, setPavedRoadType] = useState("wide_mat_ss");
  const [pavedRoadCondition, setPavedRoadCondition] = useState("good");
  const [potholePatches, setPotholePatches] = useState("none");
  const [narrowCracks, setNarrowCracks] = useState("no_cracks");
  const [wideCracks, setWideCracks] = useState("no_cracks");
  const [potholePatchesDegree, setPotholePatchesDegree] = useState("no_potholes");
  const [ruttingDegree, setRuttingDegree] = useState("no_rutting__5mm");
  const [edgeBreaksDegree, setEdgeBreaksDegree] = useState("no_edge_break");
  const [edgeDropDegree, setEdgeDropDegree] = useState("no_edge_break");
  const [drainage001, setDrainage001] = useState("good");
  const [ravellingDegree, setRavellingDegree] = useState("none");
  const [ridingQuality001, setRidingQuality001] = useState("good");
  const [roadMarkings, setRoadMarkings] = useState("yes");
  const [roadStuds, setRoadStuds] = useState("yes");
  const [passability002, setPassability002] = useState("all_year_round");
  const [yearConstructedToSealedStandard, setYearConstructedToSealedStandard] = useState("");
  const [lastSurfaceYear, setLastSurfaceYear] = useState("");
  const [sealedSurfaceType, setSealedSurfaceType] = useState("asphalt");
  const [sealedPotholeDensity, setSealedPotholeDensity] = useState("low");
  const [sealedCycleTrack, setSealedCycleTrack] = useState("no");
  const [sealedLanesPerCarriage, setSealedLanesPerCarriage] = useState("");
  const [sealedShoulderWidth, setSealedShoulderWidth] = useState("");
  const [sealedMedianType, setSealedMedianType] = useState("none");
  const [sealedDrainageType, setSealedDrainageType] = useState("v_drain");
  const [sealedDrainageLining, setSealedDrainageLining] = useState("not_lined");
  const [sealedClimate, setSealedClimate] = useState("moderate");
  const [sealedTerrain, setSealedTerrain] = useState("flat");
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

  // Gravel Roads Fields
  const [gravelRoadName, setGravelRoadName] = useState("");
  const [gravelRoadClass, setGravelRoadClass] = useState("urban_collector");
  const [gravelThickness, setGravelThickness] = useState("_100");
  const [gravelCondition, setGravelCondition] = useState("good");
  const [gravelDrainageCondition, setGravelDrainageCondition] = useState("good");
  const [gravelCorrugations, setGravelCorrugations] = useState("none");
  const [gravelRidingQuality, setGravelRidingQuality] = useState("good");
  const [gravelPotholesDegree, setGravelPotholesDegree] = useState("none");
  const [gravelPassability, setGravelPassability] = useState("all_year_round");
  const [gravelYearOfConstruction, setGravelYearOfConstruction] = useState("");
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
  const [earthRoadName, setEarthRoadName] = useState("");
  const [earthRoadClass, setEarthRoadClass] = useState("tertiary_feeder");
  const [earthRoadWidth, setEarthRoadWidth] = useState("");
  const [earthRoadLength, setEarthRoadLength] = useState("");
  const [earthRoadCondition, setEarthRoadCondition] = useState("good");
  const [earthRoadPassability, setEarthRoadPassability] = useState("dry_season_only");
  const [earthDrainageType, setEarthDrainageType] = useState("v_drain");
  const [earthDrainageCondition, setEarthDrainageCondition] = useState("good");
  const [earthTerrain, setEarthTerrain] = useState("flat");
  const [earthClimate, setEarthClimate] = useState("moderate");
  const [earthAuthority, setEarthAuthority] = useState("rdc");
  const [earthYearConstructed, setEarthYearConstructed] = useState("");

  // Bridge Fields
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

  // Layby Fields
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
  const [junctionRoadMarkings, setJunctionRoadMarkings] = useState("yes");
  const [junctionSignage, setJunctionSignage] = useState("yes");
  const [ruptureKind, setRuptureKind] = useState("rupture");
  const [ruptureCause, setRuptureCause] = useState("washaway");
  const [ruptureDetour, setRuptureDetour] = useState("no");
  const [ruptureCondition, setRuptureCondition] = useState("poor");

  // Road Sign Fields
  const [signName, setSignName] = useState("SADC Sign");
  const [signCondition, setSignCondition] = useState("good");
  const [sadcCompliant, setSadcCompliant] = useState("yes");
  const [signType, setSignType] = useState("warning");
  const [signVisibility, setSignVisibility] = useState("good");

  // Shelvert Fields
  const [shelvetType, setShelvertType] = useState("armco");
  const [shelvetCondition, setShelvertCondition] = useState("good");

  // Culvert Fields
  const [culvertClass, setCulvertClass] = useState("pipe_culvert");
  const [culvertType, setCulvertType] = useState("concrete");
  const [culvertServiceability, setCulvertServiceability] = useState("good");

  // Piped Causeway Fields
  const [causewayName, setCausewayName] = useState("");
  const [causewayCondition, setCausewayCondition] = useState("good");
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

  const [province, setProvince] = useState("Harare");
  const [district, setDistrict] = useState("Harare");
  const [photo, setPhoto] = useState<string | null>(null);
  const [photos, setPhotos] = useState<string[]>([]);
  const [sealedAuthority, setSealedAuthority] = useState("rdc");
  const [gravelAuthority, setGravelAuthority] = useState("rdc");

  const handleProvinceChange = (p: string) => {
    setProvince(p);
    const districts = ZIM_PROVINCES_DISTRICTS[p] || [];
    setDistrict(districts[0] || "");
  };

  useEffect(() => {
    if (record) {
      const cat = record.asset_category || (record.section === "rsign" ? "sign" : record.section === "culvet" ? "culvert" : record.section) || "sealed";
      setSection(cat);
      setRoadName(record.road_name || "A4 Highway (Harare - Masvingo - Beitbridge)");
      setSectionName(record.section_name || "");
      setChainageFrom(
        recordField(record, "Chainage_from_km_002", "Chainage_From_km", "chainage_from_km") != null
          ? String(recordField(record, "Chainage_from_km_002", "Chainage_From_km", "chainage_from_km"))
          : ""
      );
      setChainageTo(
        recordField(record, "Chainage_to_km_002", "Chainage_To_km", "chainage_to_km") != null
          ? String(recordField(record, "Chainage_to_km_002", "Chainage_To_km", "chainage_to_km"))
          : ""
      );
      setSurveyorName(record.surveyor_name || "");
      setSurveyDate(record.survey_date || new Date().toISOString().split("T")[0]);
      setVegetation(record.vegetation || "none");
      setGps(record.gps || "");
      setImageSadcCompliant(record.image_SADC_compliant || "yes");
      setProvince(record.province || "Harare");
      setDistrict(record.district || "Harare");
      setPhoto(record.photo || normalizePhotos(record)[0] || null);
      setPhotos(normalizePhotos(record));

      setPavedRoadName(recordField(record, "paved_road_name", "Road_Name_002") || "");
      setPavedRoadClass(recordField(record, "paved_road_class", "Road_Class_002") || "secondary");
      setPavedRoadType(recordField(record, "paved_road_type", "Road_Type") || "wide_mat_ss");
      setPavedRoadCondition(recordField(record, "paved_road_condition", "Riding_quality_degree_001") || "good");
      setPotholePatches(record.pothole_patches || "none");
      setNarrowCracks(recordField(record, "narrow_cracks_degree", "Narrow_cracks_degree") || "no_cracks");
      setWideCracks(recordField(record, "wide_cracks_degree", "Wide_cracks_degree") || "no_cracks");
      setPotholePatchesDegree(mapLegacyPotholePatches(recordField(record, "pothole_patches_degree", "Pothole_patches_degree")));
      setRuttingDegree(recordField(record, "rutting_degree", "Rutting_degree") || "no_rutting__5mm");
      setEdgeBreaksDegree(recordField(record, "edge_breaks_degree", "Edge_breaks_Degree") || "no_edge_break");
      setEdgeDropDegree(recordField(record, "edge_drop_degree", "Edge_Drop_Degree") || "no_edge_break");
      setDrainage001(recordField(record, "drainage_001", "Drainage_001") || "good");
      setRavellingDegree(recordField(record, "ravelling_degree", "Ravelling_Degree") || "none");
      setRidingQuality001(recordField(record, "riding_quality_degree_001", "Riding_quality_degree_001") || "good");
      setRoadMarkings(recordField(record, "road_markings", "Road_markings") || "yes");
      setRoadStuds(recordField(record, "road_studs", "Road_studs") || "yes");
      setPassability002(recordField(record, "passability_002", "Passability_002") || "all_year_round");
      setYearConstructedToSealedStandard(recordField(record, "year_constructed_to_sealed_standard", "Year_constructed_to_sealed_standard") != null ? String(recordField(record, "year_constructed_to_sealed_standard", "Year_constructed_to_sealed_standard")) : "");
      setLastSurfaceYear(record.last_surface_year != null ? String(record.last_surface_year) : "");
      setSealedSurfaceType(recordField(record, "Surface_type", "surface_type") || "asphalt");
      setSealedPotholeDensity(recordField(record, "Pothole_density", "pothole_density") || "low");
      setSealedCycleTrack(recordField(record, "Cycle_track", "cycle_track") || "no");
      setSealedLanesPerCarriage(recordField(record, "Number_of_Lanes_per_carriageway", "number_of_lanes_per_carriageway") != null ? String(recordField(record, "Number_of_Lanes_per_carriageway", "number_of_lanes_per_carriageway")) : "");
      setSealedShoulderWidth(recordField(record, "Shoulder_Width_m", "shoulder_width_m") != null ? String(recordField(record, "Shoulder_Width_m", "shoulder_width_m")) : "");
      setSealedMedianType(recordField(record, "Median_type", "median_type") || "none");
      setSealedDrainageType(recordField(record, "Drainage_Type_002_001", "drainage_type_002_001") || "v_drain");
      setSealedDrainageLining(recordField(record, "Drainage_lining", "drainage_lining") || "not_lined");
      setSealedClimate(recordField(record, "Climate_Region_001", "climate_region_001") || "moderate");
      setSealedTerrain(recordField(record, "Terrain_Type_002", "terrain_type_002") || "flat");
      setSealedRoadMarkingsVisible(recordField(record, "Road_markings_visible", "road_markings_visible") || "yes");
      setSealedC1NarrowCracks(recordField(record, "Carriage1_Narrow_cracks", "carriage1_narrow_cracks") || "no_cracks");
      setSealedC1WideCracks(recordField(record, "Carriage1_Wide_cracks", "carriage1_wide_cracks") || "no_cracks");
      setSealedC1Potholes(mapLegacyPotholePatches(recordField(record, "Carriage1_Pothole_patches", "carriage1_pothole_patches")));
      setSealedC1Rutting(recordField(record, "Carriage1_Rutting", "carriage1_rutting") || "no_rutting__5mm");
      setSealedC1EdgeBreaks(recordField(record, "Carriage1_Edge_breaks", "carriage1_edge_breaks") || "no_edge_break");
      setSealedC1EdgeDrop(recordField(record, "Carriage1_Edge_drop", "carriage1_edge_drop") || "no_edge_break");
      setSealedC1Ravelling(recordField(record, "Carriage1_Ravelling", "carriage1_ravelling") || "none");
      setSealedC1RidingQuality(recordField(record, "Carriage1_Riding_quality", "carriage1_riding_quality") || "good");
      setSealedC2NarrowCracks(recordField(record, "Carriage2_Narrow_cracks", "carriage2_narrow_cracks") || "no_cracks");
      setSealedC2WideCracks(recordField(record, "Carriage2_Wide_cracks", "carriage2_wide_cracks") || "no_cracks");
      setSealedC2Potholes(mapLegacyPotholePatches(recordField(record, "Carriage2_Pothole_patches", "carriage2_pothole_patches")));
      setSealedC2Rutting(recordField(record, "Carriage2_Rutting", "carriage2_rutting") || "no_rutting__5mm");
      setSealedC2EdgeBreaks(recordField(record, "Carriage2_Edge_breaks", "carriage2_edge_breaks") || "no_edge_break");
      setSealedC2EdgeDrop(recordField(record, "Carriage2_Edge_drop", "carriage2_edge_drop") || "no_edge_break");
      setSealedC2Ravelling(recordField(record, "Carriage2_Ravelling", "carriage2_ravelling") || "none");
      setSealedC2RidingQuality(recordField(record, "Carriage2_Riding_quality", "carriage2_riding_quality") || "good");
      {
        const auth = recordField(record, "Authority_Name_002", "authority_name_002") || "rdc";
        setSealedAuthority(auth === "ddf" ? "rida" : auth);
      }

      setGravelRoadName(record.gravel_road_name || record.Road_Name || "");
      setGravelRoadClass(record.gravel_road_class || record.Road_Class || "urban_collector");
      setGravelThickness(record.gravel_thickness || record.Gravel_Thickness_mm || "_100");
      setGravelCondition(record.gravel_condition || record.Riding_Quality_degree || "good");
      setGravelDrainageCondition(record.drainage_condition || record.Drainage_condition || "good");
      setGravelCorrugations(record.corrugations || "none");
      setGravelRidingQuality(record.riding_quality_degree || "good");
      setGravelPotholesDegree(record.potholes_degree || record.Potholes_Degree || "none");
      setGravelPassability(recordField(record, "passability", "Passability") || "all_year_round");
      setGravelYearOfConstruction(recordField(record, "year_of_construction", "Year_of_Counstruction") != null ? String(recordField(record, "year_of_construction", "Year_of_Counstruction")) : "");
      setGravelCorrugationsSeverity(recordField(record, "gravel_corrugations_severity") || "none");
      setGravelCrossSectionSeverity(recordField(record, "gravel_cross_section_severity") || "none");
      setGravelDrainageSeverity(recordField(record, "gravel_drainage_severity") || "none");
      setGravelPotholesSeverity(recordField(record, "gravel_potholes_severity") || "none");
      setGravelRidingSeverity(recordField(record, "gravel_riding_severity") || "none");
      {
        const gAuth = record.Authority_Name || record.authority_name || "rdc";
        setGravelAuthority(gAuth === "ddf" ? "rida" : gAuth);
      }

      setEarthRoadName(record.earth_road_name || "");
      setEarthRoadClass(record.earth_road_class || "tertiary_feeder");
      setEarthRoadWidth(record.earth_road_width || "");
      setEarthRoadLength(record.earth_road_length || "");
      setEarthRoadCondition(record.earth_road_condition || "good");
      setEarthRoadPassability(record.earth_road_passability || "dry_season_only");
      setEarthDrainageType(record.earth_drainage_type || "v_drain");
      setEarthDrainageCondition(record.earth_drainage_condition || "good");
      setEarthTerrain(record.earth_terrain || "flat");
      setEarthClimate(record.earth_climate || "moderate");
      setEarthAuthority(record.earth_authority || "rdc");
      setEarthYearConstructed(record.earth_year_constructed || "");

      setBridgeName(record.bridge || "");
      setBridgeCrossing(record.crossing || record.bridge_crossing || "river");
      setBridgeType(record.btype || record.bridge_type || "hldc");
      setBridgeBearing(record.bridge_bearing || "elastometric");
      setBridgeJoints(record.bridge_joints || "good");
      setBearingsState(record.bearings_state || "good");
      setParapet(record.parapet || "undamaged");
      setChemicalEffect(record.chemical_effect || "none");
      setVegetationGrowth(record.vegetation_growth || "no");
      setDrainage(record.drainage || "good");
      setBridgeCondition(record.bridge_condition || "good");

      setFootbridgeName(record.footbridge_name || "");
      setFootbridgeType(record.footbridge_type || "suspension");
      setFootbridgeCondition(record.footbridge_condition || "good");
      setFootbridgeWidth(record.footbridge_width || "");
      setFootbridgeSpan(record.footbridge_span || "");
      setFootbridgeMaterial(record.footbridge_material || "steel");
      setFootbridgeCrossing(record.footbridge_crossing || "river");

      setRailCrossingName(record.rail_crossing_name || "");
      setRailCrossingType(record.rail_crossing_type || "at_grade");
      setRailCrossingCondition(record.rail_crossing_condition || "good");
      setRailCrossingControl(record.rail_crossing_control || "gates");
      setRailCrossingRoadClass(record.rail_crossing_road_class || "secondary");

      setTollgateName(record.tollgate_name || "");
      setTollgateType(record.tollgate_type || "manual");
      setTollgateCondition(record.tollgate_condition || "good");
      setTollgateLanes(record.tollgate_lanes || "2");
      setTollgateOperational(record.tollgate_operational || "yes");

      setLaybyCondition(record.layby_condition || "good");
      setLaybySurface(record.layby_surface || "gravel");
      setLaybyLength(record.layby_length || "");
      setLaybyDrainage(record.layby_drainage || "good");

      setBusstopType(record.busstop_type || "bay_type");
      setBusstopCondition(record.busstop_condition || record.bus_stop_condition || "good");
      setBusstopShelter(record.busstop_shelter || "yes");
      setBusstopDrainage(record.busstop_drainage || "good");

      setJunctionType(record.junction_type || "t_junction");
      setJunctionCondition(record.junction_condition || "good");
      setJunctionControl(record.junction_control || "signs");
      setJunctionRoadMarkings(record.junction_road_markings || record.Kerbs || "yes");
      setJunctionSignage(record.junction_signage || "yes");
      setRuptureKind(recordField(record, "rupture_kind") || "rupture");
      setRuptureCause(recordField(record, "rupture_cause") || "washaway");
      setRuptureDetour(recordField(record, "rupture_detour") || "no");
      setRuptureCondition(recordField(record, "rupture_condition") || "poor");

      setSignName(record.Signage_Name || record.sign_name || "SADC Sign");
      setSignCondition(record.Condition || record.sign_condition || "good");
      setSignType(record.sign_type || "warning");
      setSadcCompliant(record.sadc_compliant || record.image_SADC_compliant || "yes");
      setSignVisibility(record.sign_visibility || "good");

      setShelvertType(record.shelvets_type || "armco");
      setShelvertCondition(record.shelvet_condition || "good");

      setCulvertClass(record.culvet_class || "pipe_culvert");
      setCulvertType(record.culvet_type || "concrete");
      setCulvertServiceability(record.culvet_serviceability || "good");

      setCausewayName(record.causeway_name || "");
      setCausewayCondition(record.causeway_condition || "good");
      setCausewayPipeMaterial(record.causeway_pipe_material || "concrete");
      setCausewayPipeDiameter(record.causeway_pipe_diameter || "600_900");
      setCausewayDrainage(record.causeway_drainage || "good");
      setCausewayServiceability(record.causeway_serviceability || "good");

      setDriftName(record.drift_name || "");
      setDriftCondition(record.drift_condition || "good");
      setDriftSurface(record.drift_surface || "concrete");
      setDriftPassability(record.drift_passability || "dry_season_only");
      setDriftWidth(record.drift_width || "");

      setGridName(record.grid_name || "");
      setGridCondition(record.grid_condition || "good");
      setGridMaterial(record.grid_material || "steel");
      setGridOperational(record.grid_operational || "yes");

      setTrafficLightsLocation(record.traffic_lights_location || "");
      setTrafficLightsCondition(record.traffic_lights_condition || "good");
      setTrafficLightsOperational(record.traffic_lights_operational || "yes");
      setTrafficLightsType(record.traffic_lights_type || "standard");
      setTrafficLightsPhases(record.traffic_lights_phases || "3");

      setStreetlightType(record.streetlight_type || "led");
      setStreetlightCondition(record.streetlight_condition || "good");
      setStreetlightPowerSource(record.streetlight_power_source || "grid");
      setStreetlightOperational(record.streetlight_operational || "yes");
      setStreetlightCount(record.streetlight_count || "");

      setCatchpitCondition(recordField(record, "catchpit_condition") || "good");
      setTrafficCalmingType(recordField(record, "traffic_calming_type") || "speed_hump");
      setTrafficCalmingCondition(recordField(record, "traffic_calming_condition") || "good");
    } else {
      setSection("sealed");
      setRoadName("A4 Highway (Harare - Masvingo - Beitbridge)");
      setSectionName("");
      setChainageFrom("");
      setChainageTo("");
      setSurveyorName("");
      setSurveyDate(new Date().toISOString().split("T")[0]);
      setVegetation("none");
      setGps("");
      setImageSadcCompliant("yes");
      setProvince("Harare");
      setDistrict("Harare");
      setPhoto(null);
      setPhotos([]);
      setSealedAuthority("rdc");
      setGravelAuthority("rdc");
      
      setPavedRoadName("");
      setPavedRoadClass("secondary");
      setPavedRoadType("wide_mat_ss");
      setPavedRoadCondition("good");
      setPotholePatches("none");
      setNarrowCracks("no_cracks");
      setWideCracks("no_cracks");
      setPotholePatchesDegree("no_potholes");
      setRuttingDegree("no_rutting__5mm");
      setEdgeBreaksDegree("no_edge_break");
      setEdgeDropDegree("no_edge_break");
      setDrainage001("good");
      setRavellingDegree("none");
      setRidingQuality001("good");
      setRoadMarkings("yes");
      setRoadStuds("yes");
      setPassability002("all_year_round");
      setYearConstructedToSealedStandard("");
      setLastSurfaceYear("");
      setSealedSurfaceType("asphalt");
      setSealedPotholeDensity("low");
      setSealedCycleTrack("no");
      setSealedLanesPerCarriage("");
      setSealedShoulderWidth("");
      setSealedMedianType("none");
      setSealedDrainageType("v_drain");
      setSealedDrainageLining("not_lined");
      setSealedClimate("moderate");
      setSealedTerrain("flat");
      setSealedRoadMarkingsVisible("yes");
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

      setGravelRoadName("");
      setGravelRoadClass("urban_collector");
      setGravelThickness("_100");
      setGravelCondition("good");
      setGravelDrainageCondition("good");
      setGravelCorrugations("none");
      setGravelRidingQuality("good");
      setGravelPotholesDegree("none");
      setGravelPassability("all_year_round");
      setGravelYearOfConstruction("");
      setGravelCorrugationsSeverity("none");
      setGravelCrossSectionSeverity("none");
      setGravelDrainageSeverity("none");
      setGravelPotholesSeverity("none");
      setGravelRidingSeverity("none");

      setCatchpitCondition("good");
      setTrafficCalmingType("speed_hump");
      setTrafficCalmingCondition("good");

      setEarthRoadName("");
      setEarthRoadClass("tertiary_feeder");
      setEarthRoadWidth("");
      setEarthRoadLength("");
      setEarthRoadCondition("good");
      setEarthRoadPassability("dry_season_only");
      setEarthDrainageType("v_drain");
      setEarthDrainageCondition("good");
      setEarthTerrain("flat");
      setEarthClimate("moderate");
      setEarthAuthority("rdc");
      setEarthYearConstructed("");

      setBridgeName("");
      setBridgeCrossing("river");
      setBridgeType("hldc");
      setBridgeBearing("elastometric");
      setBridgeJoints("good");
      setBearingsState("good");
      setParapet("undamaged");
      setChemicalEffect("none");
      setVegetationGrowth("no");
      setDrainage("good");
      setBridgeCondition("good");

      setFootbridgeName("");
      setFootbridgeType("suspension");
      setFootbridgeCondition("good");
      setFootbridgeWidth("");
      setFootbridgeSpan("");
      setFootbridgeMaterial("steel");
      setFootbridgeCrossing("river");

      setRailCrossingName("");
      setRailCrossingType("at_grade");
      setRailCrossingCondition("good");
      setRailCrossingControl("gates");
      setRailCrossingRoadClass("secondary");

      setTollgateName("");
      setTollgateType("manual");
      setTollgateCondition("good");
      setTollgateLanes("2");
      setTollgateOperational("yes");

      setLaybyCondition("good");
      setLaybySurface("gravel");
      setLaybyLength("");
      setLaybyDrainage("good");

      setBusstopType("bay_type");
      setBusstopCondition("good");
      setBusstopShelter("yes");
      setBusstopDrainage("good");

      setJunctionType("t_junction");
      setJunctionCondition("good");
      setJunctionControl("signs");
      setJunctionRoadMarkings("yes");
      setJunctionSignage("yes");
      setRuptureKind("rupture");
      setRuptureCause("washaway");
      setRuptureDetour("no");
      setRuptureCondition("poor");

      setSignName("SADC Sign");
      setSignCondition("good");
      setSignType("warning");
      setSadcCompliant("yes");
      setSignVisibility("good");

      setShelvertType("armco");
      setShelvertCondition("good");

      setCulvertClass("pipe_culvert");
      setCulvertType("concrete");
      setCulvertServiceability("good");

      setCausewayName("");
      setCausewayCondition("good");
      setCausewayPipeMaterial("concrete");
      setCausewayPipeDiameter("600_900");
      setCausewayDrainage("good");
      setCausewayServiceability("good");

      setDriftName("");
      setDriftCondition("good");
      setDriftSurface("concrete");
      setDriftPassability("dry_season_only");
      setDriftWidth("");

      setGridName("");
      setGridCondition("good");
      setGridMaterial("steel");
      setGridOperational("yes");

      setTrafficLightsLocation("");
      setTrafficLightsCondition("good");
      setTrafficLightsOperational("yes");
      setTrafficLightsType("standard");
      setTrafficLightsPhases("3");

      setStreetlightType("led");
      setStreetlightCondition("good");
      setStreetlightPowerSource("grid");
      setStreetlightOperational("yes");
      setStreetlightCount("");
    }
  }, [record, isOpen]);

  const [isCapturingGps, setIsCapturingGps] = useState(false);
  const handleCaptureGps = () => {
    setIsCapturingGps(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const { latitude, longitude, altitude, accuracy } = position.coords;
          const alt = altitude ? Math.round(altitude) : 1200;
          const acc = accuracy ? Math.round(accuracy) : 5;
          setGps(`${latitude.toFixed(6)} ${longitude.toFixed(6)} ${alt} ${acc}`);
          setIsCapturingGps(false);
        },
        () => {
          simulateZimbabweGps();
        },
        { enableHighAccuracy: true, timeout: 5000 }
      );
    } else {
      simulateZimbabweGps();
    }
  };

  const handleFormSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    let finalGps = gps.trim();
    const gpsParts = finalGps.split(/\s+/);
    if (gpsParts.length < 2 || isNaN(parseFloat(gpsParts[0])) || isNaN(parseFloat(gpsParts[1]))) {
      if (onToast) onToast("Please enter valid GPS coordinates (at least Latitude and Longitude). E.g. -17.8292 31.0522", "error");
      return;
    }
    if (gpsParts.length === 2) {
      finalGps = `${gpsParts[0]} ${gpsParts[1]} 1200 5`;
    } else if (gpsParts.length === 3) {
      finalGps = `${gpsParts[0]} ${gpsParts[1]} ${gpsParts[2]} 5`;
    }

    const data: any = {
      asset_category: section,
      section: section,
      source: "dashboard",
      road_name: roadName,
      section_name: sectionName,
      surveyor_name: surveyorName,
      survey_date: surveyDate,
      vegetation,
      gps: finalGps,
      image_SADC_compliant: imageSadcCompliant,
      image_sadc_compliant: imageSadcCompliant,
      province,
      district,
      photo: photos[0] || photo || null,
      photos: photos.length > 0 ? photos : (photo ? [photo] : undefined),
    };
    if (section === "sealed") {
      const finalSealedName = roadName.split(" (")[0] || roadName;
      const chainFrom = chainageFrom.trim() ? parseFloat(chainageFrom) : undefined;
      const chainTo = chainageTo.trim() ? parseFloat(chainageTo) : undefined;
      data.paved_road_name = finalSealedName;
      data.paved_road_class = pavedRoadClass;
      data.paved_road_type = pavedRoadType;
      data.paved_road_condition = ridingQuality001;
      data.pothole_patches = potholePatchesDegree;
      data.narrow_cracks_degree = narrowCracks;
      data.wide_cracks_degree = wideCracks;
      data.pothole_patches_degree = potholePatchesDegree;
      data.rutting_degree = ruttingDegree;
      data.edge_breaks_degree = edgeBreaksDegree;
      data.edge_drop_degree = edgeDropDegree;
      data.drainage_001 = drainage001;
      data.ravelling_degree = ravellingDegree;
      data.riding_quality_degree_001 = ridingQuality001;
      data.road_markings = roadMarkings;
      data.road_studs = roadStuds;
      data.passability_002 = passability002;
      data.Authority_Name_002 = sealedAuthority;
      data.authority_name_002 = sealedAuthority;
      data.chainage_from_km = chainFrom;
      data.chainage_to_km = chainTo;
      data.Road_Name_002 = finalSealedName;
      data.Road_Class_002 = pavedRoadClass;
      data.Road_Type = pavedRoadType;
      data.Climate_Region_001 = sealedClimate;
      data.Terrain_Type_002 = sealedTerrain;
      data.Drainage_Type_002_001 = sealedDrainageType;
      data.Narrow_cracks_degree = narrowCracks;
      data.Wide_cracks_degree = wideCracks;
      data.Pothole_patches_degree = potholePatchesDegree;
      data.Rutting_degree = ruttingDegree;
      data.Edge_breaks_Degree = edgeBreaksDegree;
      data.Edge_Drop_Degree = edgeDropDegree;
      data.Drainage_001 = drainage001;
      data.Ravelling_Degree = ravellingDegree;
      data.Riding_quality_degree_001 = ridingQuality001;
      data.Road_markings = roadMarkings;
      data.Road_studs = roadStuds;
      data.Passability_002 = passability002;
      data.Surface_type = sealedSurfaceType;
      data.Pothole_density = sealedPotholeDensity;
      data.Cycle_track = sealedCycleTrack;
      if (sealedLanesPerCarriage) data.Number_of_Lanes_per_carriageway = parseInt(sealedLanesPerCarriage);
      if (sealedShoulderWidth) data.Shoulder_Width_m = parseFloat(sealedShoulderWidth);
      data.Median_type = sealedMedianType;
      data.Drainage_lining = sealedDrainageLining;
      data.Road_markings_visible = sealedRoadMarkingsVisible;
      data.Chainage_from_km_002 = chainFrom;
      data.Chainage_to_km_002 = chainTo;
      data.Carriage1_Narrow_cracks = sealedC1NarrowCracks;
      data.Carriage1_Wide_cracks = sealedC1WideCracks;
      data.Carriage1_Pothole_patches = sealedC1Potholes;
      data.Carriage1_Rutting = sealedC1Rutting;
      data.Carriage1_Edge_breaks = sealedC1EdgeBreaks;
      data.Carriage1_Edge_drop = sealedC1EdgeDrop;
      data.Carriage1_Ravelling = sealedC1Ravelling;
      data.Carriage1_Riding_quality = sealedC1RidingQuality;
      data.Carriage2_Narrow_cracks = sealedC2NarrowCracks;
      data.Carriage2_Wide_cracks = sealedC2WideCracks;
      data.Carriage2_Pothole_patches = sealedC2Potholes;
      data.Carriage2_Rutting = sealedC2Rutting;
      data.Carriage2_Edge_breaks = sealedC2EdgeBreaks;
      data.Carriage2_Edge_drop = sealedC2EdgeDrop;
      data.Carriage2_Ravelling = sealedC2Ravelling;
      data.Carriage2_Riding_quality = sealedC2RidingQuality;
      if (yearConstructedToSealedStandard) {
        data.year_constructed_to_sealed_standard = Number(yearConstructedToSealedStandard);
        data.Year_constructed_to_sealed_standard = Number(yearConstructedToSealedStandard);
      }
      if (lastSurfaceYear) data.last_surface_year = Number(lastSurfaceYear);
    } else if (section === "gravel") {
      const finalGravelName = roadName.split(" (")[0] || roadName;
      const chainFrom = chainageFrom.trim() ? parseFloat(chainageFrom) : undefined;
      const chainTo = chainageTo.trim() ? parseFloat(chainageTo) : undefined;
      data.gravel_road_name = finalGravelName;
      data.gravel_road_class = gravelRoadClass;
      data.gravel_thickness = gravelThickness;
      data.gravel_condition = gravelCondition;
      data.drainage_condition = gravelDrainageCondition;
      data.corrugations = gravelCorrugations;
      data.riding_quality_degree = gravelRidingQuality;
      data.potholes_degree = gravelPotholesDegree;
      data.passability = gravelPassability;
      data.Authority_Name = gravelAuthority;
      data.authority_name = gravelAuthority;
      data.chainage_from_km = chainFrom;
      data.chainage_to_km = chainTo;
      data.Chainage_From_km = chainFrom;
      data.Chainage_To_km = chainTo;
      data.gravel_corrugations_severity = gravelCorrugationsSeverity;
      data.gravel_cross_section_severity = gravelCrossSectionSeverity;
      data.gravel_drainage_severity = gravelDrainageSeverity;
      data.gravel_potholes_severity = gravelPotholesSeverity;
      data.gravel_riding_severity = gravelRidingSeverity;
      if (gravelYearOfConstruction) data.year_of_construction = Number(gravelYearOfConstruction);
    } else if (section === "earth") {
      const chainFrom = chainageFrom.trim() ? parseFloat(chainageFrom) : undefined;
      const chainTo = chainageTo.trim() ? parseFloat(chainageTo) : undefined;
      data.earth_road_name = roadName.split(" (")[0] || roadName;
      data.earth_road_class = earthRoadClass;
      if (earthRoadWidth) data.earth_road_width = Number(earthRoadWidth);
      if (earthRoadLength) data.earth_road_length = Number(earthRoadLength);
      data.earth_road_condition = earthRoadCondition;
      data.earth_road_passability = earthRoadPassability;
      data.earth_drainage_type = earthDrainageType;
      data.earth_drainage_condition = earthDrainageCondition;
      data.earth_terrain = earthTerrain;
      data.earth_climate = earthClimate;
      data.earth_authority = earthAuthority;
      data.chainage_from_km = chainFrom;
      data.chainage_to_km = chainTo;
      if (earthYearConstructed) data.earth_year_constructed = Number(earthYearConstructed);
    } else if (section === "bridge") {
      data.bridge = bridgeName;
      data.crossing = bridgeCrossing;
      data.bridge_crossing = bridgeCrossing;
      data.btype = bridgeType;
      data.bridge_type = bridgeType;
      data.bridge_bearing = bridgeBearing;
      data.bridge_joints = bridgeJoints;
      data.bearings_state = bearingsState;
      data.parapet = parapet;
      data.chemical_effect = chemicalEffect;
      data.vegetation_growth = vegetationGrowth;
      data.drainage = drainage;
      data.bridge_condition = bridgeCondition;
    } else if (section === "footbridge") {
      data.footbridge_name = footbridgeName;
      data.footbridge_type = footbridgeType;
      data.footbridge_condition = footbridgeCondition;
      if (footbridgeWidth) data.footbridge_width = Number(footbridgeWidth);
      if (footbridgeSpan) data.footbridge_span = Number(footbridgeSpan);
      data.footbridge_material = footbridgeMaterial;
      data.footbridge_crossing = footbridgeCrossing;
    } else if (section === "rail_crossing") {
      data.rail_crossing_name = railCrossingName;
      data.rail_crossing_type = railCrossingType;
      data.rail_crossing_condition = railCrossingCondition;
      data.rail_crossing_control = railCrossingControl;
      data.rail_crossing_road_class = railCrossingRoadClass;
    } else if (section === "tollgate") {
      data.tollgate_name = tollgateName;
      data.tollgate_type = tollgateType;
      data.tollgate_condition = tollgateCondition;
      if (tollgateLanes) data.tollgate_lanes = Number(tollgateLanes);
      data.tollgate_operational = tollgateOperational;
    } else if (section === "layby") {
      data.layby_condition = laybyCondition;
      data.layby_surface = laybySurface;
      if (laybyLength) data.layby_length = Number(laybyLength);
      data.layby_drainage = laybyDrainage;
    } else if (section === "busstop") {
      data.busstop_type = busstopType;
      data.busstop_condition = busstopCondition;
      data.bus_stop_condition = busstopCondition;
      data.busstop_shelter = busstopShelter;
      data.busstop_drainage = busstopDrainage;
    } else if (section === "junction") {
      data.junction_type = junctionType;
      data.junction_condition = junctionCondition;
      data.junction_control = junctionControl;
      data.junction_road_markings = junctionRoadMarkings;
      data.junction_signage = junctionSignage;
    } else if (section === "road_rupture") {
      data.rupture_kind = ruptureKind;
      if (ruptureKind === "rupture") data.rupture_cause = ruptureCause;
      data.rupture_detour = ruptureDetour;
      data.rupture_condition = ruptureKind === "under_construction" ? "under_construction" : ruptureCondition;
    } else if (section === "sign") {
      data.sign_name = signName;
      data.Signage_Name = signName;
      data.sign_condition = signCondition;
      data.Condition = signCondition;
      data.sign_type = signType;
      data.sign_sadc_compliant = sadcCompliant;
      data.sadc_compliant = sadcCompliant;
      data.sign_visibility = signVisibility;
    } else if (section === "shelvet") {
      data.shelvets_type = shelvetType;
      data.shelvet_condition = shelvetCondition;
    } else if (section === "culvert") {
      data.culvet_class = culvertClass;
      data.culvet_type = culvertType;
      data.culvet_serviceability = culvertServiceability;
    } else if (section === "piped_causeway") {
      data.causeway_name = causewayName;
      data.causeway_condition = causewayCondition;
      data.causeway_pipe_material = causewayPipeMaterial;
      data.causeway_pipe_diameter = causewayPipeDiameter;
      data.causeway_drainage = causewayDrainage;
      data.causeway_serviceability = causewayServiceability;
    } else if (section === "drift") {
      data.drift_name = driftName;
      data.drift_condition = driftCondition;
      data.drift_surface = driftSurface;
      data.drift_passability = driftPassability;
      if (driftWidth) data.drift_width = Number(driftWidth);
    } else if (section === "grid") {
      data.grid_name = gridName;
      data.grid_condition = gridCondition;
      data.grid_material = gridMaterial;
      data.grid_operational = gridOperational;
    } else if (section === "catchpit") {
      data.catchpit_condition = catchpitCondition;
    } else if (section === "traffic_calming") {
      data.traffic_calming_type = trafficCalmingType;
      data.traffic_calming_condition = trafficCalmingCondition;
    } else if (section === "traffic_lights") {
      data.traffic_lights_location = trafficLightsLocation;
      data.traffic_lights_condition = trafficLightsCondition;
      data.traffic_lights_operational = trafficLightsOperational;
      data.traffic_lights_type = trafficLightsType;
      if (trafficLightsPhases) data.traffic_lights_phases = Number(trafficLightsPhases);
    } else if (section === "streetlight") {
      data.streetlight_type = streetlightType;
      data.streetlight_condition = streetlightCondition;
      data.streetlight_power_source = streetlightPowerSource;
      data.streetlight_operational = streetlightOperational;
      if (streetlightCount) data.streetlight_count = Number(streetlightCount);
    }

    let derivedCond = "good";
    if (section === "sealed") derivedCond = ridingQuality001;
    else if (section === "gravel") derivedCond = gravelCondition;
    else if (section === "earth") derivedCond = earthRoadCondition;
    else if (section === "bridge") derivedCond = bridgeCondition;
    else if (section === "footbridge") derivedCond = footbridgeCondition;
    else if (section === "rail_crossing") derivedCond = railCrossingCondition;
    else if (section === "tollgate") derivedCond = tollgateCondition;
    else if (section === "layby") derivedCond = laybyCondition;
    else if (section === "busstop") derivedCond = busstopCondition;
    else if (section === "junction") derivedCond = junctionCondition;
    else if (section === "road_rupture") derivedCond = ruptureKind === "under_construction" ? "under_construction" : ruptureCondition;
    else if (section === "sign") derivedCond = signCondition;
    else if (section === "shelvet") derivedCond = shelvetCondition;
    else if (section === "culvert") derivedCond = culvertServiceability;
    else if (section === "piped_causeway") derivedCond = causewayCondition;
    else if (section === "drift") derivedCond = driftCondition;
    else if (section === "grid") derivedCond = gridCondition;
    else if (section === "catchpit") derivedCond = catchpitCondition;
    else if (section === "traffic_calming") derivedCond = trafficCalmingCondition;
    else if (section === "traffic_lights") derivedCond = trafficLightsCondition;
    else if (section === "streetlight") derivedCond = streetlightCondition;

    data.road_condition = derivedCond;

    setIsSaving(true);
    try {
      await onSave(data);
    } finally {
      setIsSaving(false);
    }
  };

  const simulateZimbabweGps = () => {
    const lat = (-17.5 - Math.random() * 4.5).toFixed(6);
    const lng = (29.0 + Math.random() * 3.5).toFixed(6);
    const alt = Math.floor(400 + Math.random() * 1200);
    const acc = Math.floor(3 + Math.random() * 4);
    setGps(`${lat} ${lng} ${alt} ${acc}`);
    setIsCapturingGps(false);
  };

  if (!isOpen) return null;

  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1100, padding: 20 }}>
      <div style={{ background: "#ffffff", borderRadius: 16, width: "100%", maxWidth: 680, maxHeight: "92vh", display: "flex", flexDirection: "column", boxShadow: "0 20px 60px rgba(0,0,0,0.25)", overflow: "hidden" }}>
        {/* Header */}
        <div style={{ padding: "16px 20px", borderBottom: "2px solid var(--gold)", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0, background: "var(--green)" }}>
          <h3 style={{ fontSize: 15, fontWeight: 800, color: "#fff", fontFamily: "var(--font-title)" }}>
            {record ? "✏️ Edit Survey Record" : "➕ Add New Survey Record"}
          </h3>
          <button type="button" onClick={onClose} style={{ background: "rgba(255,255,255,0.15)", border: "1px solid rgba(255,255,255,0.25)", borderRadius: 6, padding: "4px 8px", cursor: "pointer", color: "#fff", display: "flex", alignItems: "center" }}>
            <X size={16} />
          </button>
        </div>
        
        {/* Scrollable Form Body */}
        <form onSubmit={handleFormSubmit} className="survey-edit-form" style={{ flex: 1, overflowY: "auto", padding: 20, display: "flex", flexDirection: "column", gap: 14 }}>
          {/* Section picker — Visual card grid */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 8, letterSpacing: "0.6px" }}>Asset Category</label>
            {record ? (
              <div style={{ padding: "8px 14px", background: "var(--bg-active)", borderRadius: 8, border: "1px solid var(--border)", fontSize: 12, fontWeight: 700, color: "var(--green)" }}>
                {CATEGORY_GROUPS.flatMap(g => g.items).find(i => i.key === section)?.label ?? section}
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {CATEGORY_GROUPS.map(group => (
                  <div key={group.groupLabel}>
                    <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 4 }}>{group.emoji} {group.groupLabel}</div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {group.items.map(item => (
                        <button
                          key={item.key}
                          type="button"
                          onClick={() => setSection(item.key)}
                          style={{
                            padding: "6px 12px",
                            borderRadius: 20,
                            border: `1.5px solid ${section === item.key ? group.color : "var(--border)"}`,
                            background: section === item.key ? group.color : "#fff",
                            color: section === item.key ? "#fff" : "var(--text-secondary)",
                            fontSize: 11,
                            fontWeight: section === item.key ? 700 : 500,
                            cursor: "pointer",
                            transition: "all 0.15s",
                            fontFamily: "var(--font-body)",
                            display: "flex",
                            alignItems: "center",
                            gap: 4,
                          }}
                        >
                          {item.emoji} {item.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Surveyor & Date */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Surveyor Name</label>
              <input type="text" placeholder="e.g. Eng. Rondozai" value={surveyorName} onChange={e => setSurveyorName(e.target.value)} required style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)" }} />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Survey Date</label>
              <input type="date" value={surveyDate} onChange={e => setSurveyDate(e.target.value)} required style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)" }} />
            </div>
          </div>

          {/* Highway & Section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Highway Route</label>
              <input
                type="text"
                list="highway-route-suggestions"
                value={roadName}
                onChange={e => setRoadName(e.target.value)}
                placeholder="e.g. A1 Highway (Harare - Chirundu)"
                style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", background: "#fff" }}
              />
              <datalist id="highway-route-suggestions">
                <option value="A1 Highway (Harare - Chirundu)" />
                <option value="A2 Highway (Harare - Nyamapanda)" />
                <option value="A3 Highway (Harare - Bulawayo)" />
                <option value="A4 Highway (Harare - Masvingo - Beitbridge)" />
                <option value="A5 Highway (Harare - Mutare)" />
              </datalist>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Section Name</label>
              <input type="text" placeholder="e.g. Masvingo – Chivhu Section" value={sectionName} onChange={e => setSectionName(e.target.value)} required style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)" }} />
            </div>
          </div>

          {(section === "sealed" || section === "gravel" || section === "earth") && (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Chainage From (km)</label>
                <input type="number" step="any" placeholder="e.g. 12.5" value={chainageFrom} onChange={e => setChainageFrom(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)" }} />
              </div>
              <div>
                <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Chainage To (km)</label>
                <input type="number" step="any" placeholder="e.g. 15.0" value={chainageTo} onChange={e => setChainageTo(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)" }} />
              </div>
            </div>
          )}

          {/* Province & District */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Province</label>
              <select value={province} onChange={e => handleProvinceChange(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", background: "#fff" }}>
                {Object.keys(ZIM_PROVINCES_DISTRICTS).map(p => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>District</label>
              <select value={district} onChange={e => setDistrict(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", background: "#fff" }}>
                {(ZIM_PROVINCES_DISTRICTS[province] || []).map(d => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
          </div>

          {/* GPS Coordinates */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>GPS Coordinates (Lat Lng Alt Acc)</label>
            <div style={{ display: "flex", gap: 8 }}>
              <input type="text" placeholder="e.g. -17.8292 31.0522" value={gps} onChange={e => setGps(e.target.value)} required style={{ flex: 1, padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, background: "#ffffff", outline: "none", fontFamily: "var(--font-body)" }} />
              <button type="button" onClick={handleCaptureGps} disabled={isCapturingGps} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 16px", fontSize: 12, cursor: "pointer", fontWeight: 700, fontFamily: "var(--font-body)" }}>
                {isCapturingGps ? "Capturing…" : "🎯 Capture GPS"}
              </button>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 4 }}>
              Format: <strong>Latitude Longitude [Altitude] [Accuracy]</strong> (space-separated). E.g. <code>-17.7834 31.0512 1500 5</code>. 
              Or click the button to capture current coordinates.
            </div>
          </div>

          {/* Vegetation & Compliance */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Vegetation Status</label>
              <select value={vegetation} onChange={e => setVegetation(e.target.value)} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)" }}>
                <option value="none">None</option>
                <option value="light">Light</option>
                <option value="medium">Medium</option>
                <option value="dense">Dense</option>
              </select>
            </div>
            <div>
              <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>SADC Sign Compliant</label>
              <select value={imageSadcCompliant} onChange={e => setImageSadcCompliant(e.target.value as any)} style={{ width: "100%", padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)" }}>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="mixed">Mixed</option>
              </select>
            </div>
          </div>

          {/* Multi-photo upload (matches mobile photos[]) */}
          <div>
            <label style={{ display: "block", fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>
              Photos (Optional) — {photos.length}/12
            </label>
            {photos.length > 0 && (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8, marginBottom: 10 }}>
                {photos.map((src, idx) => (
                  <div key={idx} style={{ position: "relative", aspectRatio: "1", borderRadius: 8, overflow: "hidden", border: "1px solid rgba(0,102,51,0.2)" }}>
                    <img src={src} alt={`Photo ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    <button
                      type="button"
                      onClick={() => {
                        const next = photos.filter((_, i) => i !== idx);
                        setPhotos(next);
                        setPhoto(next[0] || null);
                      }}
                      style={{ position: "absolute", top: 4, right: 4, background: "rgba(220,38,38,0.95)", border: "none", borderRadius: "50%", width: 24, height: 24, color: "#fff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {photos.length < 12 && (
              <label
                style={{
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  justifyContent: "center",
                  height: 90,
                  border: "2px dashed rgba(0,102,51,0.25)",
                  borderRadius: 10,
                  background: "rgba(0,102,51,0.02)",
                  cursor: "pointer",
                  gap: 6,
                  fontFamily: "var(--font-body)",
                }}
              >
                <Camera size={18} color="var(--text-secondary)" />
                <span style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>
                  {photos.length === 0 ? "Add photo(s)" : "Add another photo"}
                </span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  capture="environment"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []).slice(0, 12 - photos.length);
                    if (!files.length) return;
                    Promise.all(
                      files.map(
                        (file) =>
                          new Promise<string>((resolve) => {
                            const reader = new FileReader();
                            reader.onloadend = () => resolve(String(reader.result || ""));
                            reader.readAsDataURL(file);
                          })
                      )
                    ).then((urls) => {
                      const next = [...photos, ...urls.filter(Boolean)].slice(0, 12);
                      setPhotos(next);
                      setPhoto(next[0] || null);
                    });
                    e.target.value = "";
                  }}
                  style={{ display: "none" }}
                />
              </label>
            )}
          </div>

          {/* Conditional Sub-forms */}
          {section === "sealed" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Sealed Road Details</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Class</label>
                  <select value={pavedRoadClass} onChange={e => setPavedRoadClass(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {SEALED_ROAD_CLASS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Type</label>
                  <select value={pavedRoadType} onChange={e => setPavedRoadType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {SEALED_ROAD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Surface Type</label>
                  <select value={sealedSurfaceType} onChange={e => setSealedSurfaceType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {SURFACE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Pothole Density</label>
                  <select value={sealedPotholeDensity} onChange={e => setSealedPotholeDensity(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {POTHOLE_DENSITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Climate</label>
                  <select value={sealedClimate} onChange={e => setSealedClimate(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="dry">Dry</option>
                    <option value="moderate">Moderate</option>
                    <option value="wet">Wet</option>
                    <option value="very_wet">Very Wet</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Terrain</label>
                  <select value={sealedTerrain} onChange={e => setSealedTerrain(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="flat">Flat</option>
                    <option value="undulating">Undulating</option>
                    <option value="mountainous">Mountainous</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Authority</label>
                  <select value={sealedAuthority} onChange={e => setSealedAuthority(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {AUTHORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Cycle Track</label>
                  <select value={sealedCycleTrack} onChange={e => setSealedCycleTrack(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {YES_NO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Lanes / Carriage</label>
                  <input type="number" min="1" placeholder="e.g. 2" value={sealedLanesPerCarriage} onChange={e => setSealedLanesPerCarriage(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Shoulder Width (m)</label>
                  <input type="number" step="any" placeholder="e.g. 1.5" value={sealedShoulderWidth} onChange={e => setSealedShoulderWidth(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Median Type</label>
                  <select value={sealedMedianType} onChange={e => setSealedMedianType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {MEDIAN_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage Status</label>
                  <select value={drainage001} onChange={e => setDrainage001(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="eroded">Eroded</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage Type</label>
                  <select value={sealedDrainageType} onChange={e => setSealedDrainageType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {DRAINAGE_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage Lining</label>
                  <select value={sealedDrainageLining} onChange={e => setSealedDrainageLining(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {DRAINAGE_LINING_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              {!isDualCarriageway(pavedRoadType) && (
                <>
                  <div style={{ fontSize: 9, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", marginTop: 4 }}>Pavement Defects</div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Narrow Cracks</label>
                      <select value={narrowCracks} onChange={e => setNarrowCracks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                        <option value="no_cracks">No cracks</option>
                        <option value="faint_cracks">Faint cracks</option>
                        <option value="distinct_cracks_up_to_1mm">Distinct cracks up to 1mm</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Wide Cracks</label>
                      <select value={wideCracks} onChange={e => setWideCracks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                        <option value="no_cracks">No cracks</option>
                        <option value="cracks_3_5mm">Cracks 3-5mm</option>
                        <option value="cracks_5_10mm">Cracks 5-10mm</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Pothole / Patches</label>
                      <select value={potholePatchesDegree} onChange={e => setPotholePatchesDegree(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                        {POTHOLE_PATCHES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Rutting</label>
                      <select value={ruttingDegree} onChange={e => setRuttingDegree(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                        <option value="no_rutting__5mm">No rutting &lt;5mm</option>
                        <option value="discernible_5_15mm">Discernible 5-15mm</option>
                        <option value="large_15_25mm">Large 15-25mm</option>
                        <option value="mixed">Mixed</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Edge Breaks</label>
                      <select value={edgeBreaksDegree} onChange={e => setEdgeBreaksDegree(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                        <option value="no_edge_break">No edge break</option>
                        <option value="up_to_50mm">Up to 50mm</option>
                        <option value="50_100mm_break">50-100mm break</option>
                        <option value="__100mm">&gt; 100mm</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Edge Drop</label>
                      <select value={edgeDropDegree} onChange={e => setEdgeDropDegree(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                        <option value="no_edge_break">No edge drop</option>
                        <option value="up_to_50mm">Up to 50mm</option>
                        <option value="50_100mm_break">50-100mm drop</option>
                        <option value="__100mm">&gt; 100mm</option>
                      </select>
                    </div>
                  </div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                    <div>
                      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Ravelling</label>
                      <select value={ravellingDegree} onChange={e => setRavellingDegree(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                        <option value="none">None</option>
                        <option value="minor">Minor</option>
                        <option value="major">Major</option>
                      </select>
                    </div>
                    <div>
                      <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Riding Quality</label>
                      <select value={ridingQuality001} onChange={e => setRidingQuality001(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                        {CONDITION_WITH_CONSTRUCTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </div>
                </>
              )}

              {isDualCarriageway(pavedRoadType) && (
                <>
                  <fieldset style={{ border: "1px dashed rgba(0,102,51,0.25)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <legend style={{ fontSize: 9, fontWeight: 700, color: "var(--green)", padding: "0 4px" }}>Carriage 1</legend>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Narrow Cracks</label>
                        <select value={sealedC1NarrowCracks} onChange={e => setSealedC1NarrowCracks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_cracks">No cracks</option>
                          <option value="faint_cracks">Faint cracks</option>
                          <option value="distinct_cracks_up_to_1mm">Distinct up to 1mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Wide Cracks</label>
                        <select value={sealedC1WideCracks} onChange={e => setSealedC1WideCracks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_cracks">No cracks</option>
                          <option value="cracks_3_5mm">Cracks 3-5mm</option>
                          <option value="cracks_5_10mm">Cracks 5-10mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Pothole / Patches</label>
                        <select value={sealedC1Potholes} onChange={e => setSealedC1Potholes(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          {POTHOLE_PATCHES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Rutting</label>
                        <select value={sealedC1Rutting} onChange={e => setSealedC1Rutting(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_rutting__5mm">No rutting &lt;5mm</option>
                          <option value="discernible_5_15mm">Discernible 5-15mm</option>
                          <option value="large_15_25mm">Large 15-25mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Edge Breaks</label>
                        <select value={sealedC1EdgeBreaks} onChange={e => setSealedC1EdgeBreaks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_edge_break">No edge break</option>
                          <option value="up_to_50mm">Up to 50mm</option>
                          <option value="50_100mm_break">50-100mm break</option>
                          <option value="__100mm">&gt; 100mm</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Edge Drop</label>
                        <select value={sealedC1EdgeDrop} onChange={e => setSealedC1EdgeDrop(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_edge_break">No edge drop</option>
                          <option value="up_to_50mm">Up to 50mm</option>
                          <option value="50_100mm_break">50-100mm drop</option>
                          <option value="__100mm">&gt; 100mm</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Ravelling</label>
                        <select value={sealedC1Ravelling} onChange={e => setSealedC1Ravelling(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="none">None</option>
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Riding Quality</label>
                        <select value={sealedC1RidingQuality} onChange={e => setSealedC1RidingQuality(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          {CONDITION_WITH_CONSTRUCTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </fieldset>
                  <fieldset style={{ border: "1px dashed rgba(0,102,51,0.25)", borderRadius: 8, padding: 10, display: "flex", flexDirection: "column", gap: 8 }}>
                    <legend style={{ fontSize: 9, fontWeight: 700, color: "var(--green)", padding: "0 4px" }}>Carriage 2</legend>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Narrow Cracks</label>
                        <select value={sealedC2NarrowCracks} onChange={e => setSealedC2NarrowCracks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_cracks">No cracks</option>
                          <option value="faint_cracks">Faint cracks</option>
                          <option value="distinct_cracks_up_to_1mm">Distinct up to 1mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Wide Cracks</label>
                        <select value={sealedC2WideCracks} onChange={e => setSealedC2WideCracks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_cracks">No cracks</option>
                          <option value="cracks_3_5mm">Cracks 3-5mm</option>
                          <option value="cracks_5_10mm">Cracks 5-10mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Pothole / Patches</label>
                        <select value={sealedC2Potholes} onChange={e => setSealedC2Potholes(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          {POTHOLE_PATCHES_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Rutting</label>
                        <select value={sealedC2Rutting} onChange={e => setSealedC2Rutting(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_rutting__5mm">No rutting &lt;5mm</option>
                          <option value="discernible_5_15mm">Discernible 5-15mm</option>
                          <option value="large_15_25mm">Large 15-25mm</option>
                          <option value="mixed">Mixed</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Edge Breaks</label>
                        <select value={sealedC2EdgeBreaks} onChange={e => setSealedC2EdgeBreaks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_edge_break">No edge break</option>
                          <option value="up_to_50mm">Up to 50mm</option>
                          <option value="50_100mm_break">50-100mm break</option>
                          <option value="__100mm">&gt; 100mm</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Edge Drop</label>
                        <select value={sealedC2EdgeDrop} onChange={e => setSealedC2EdgeDrop(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="no_edge_break">No edge drop</option>
                          <option value="up_to_50mm">Up to 50mm</option>
                          <option value="50_100mm_break">50-100mm drop</option>
                          <option value="__100mm">&gt; 100mm</option>
                        </select>
                      </div>
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Ravelling</label>
                        <select value={sealedC2Ravelling} onChange={e => setSealedC2Ravelling(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          <option value="none">None</option>
                          <option value="minor">Minor</option>
                          <option value="major">Major</option>
                        </select>
                      </div>
                      <div>
                        <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Riding Quality</label>
                        <select value={sealedC2RidingQuality} onChange={e => setSealedC2RidingQuality(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                          {CONDITION_WITH_CONSTRUCTION_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>
                  </fieldset>
                </>
              )}

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Markings</label>
                  <select value={roadMarkings} onChange={e => setRoadMarkings(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {YES_NO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                {roadMarkings === "yes" && (
                  <div>
                    <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Markings Visible</label>
                    <select value={sealedRoadMarkingsVisible} onChange={e => setSealedRoadMarkingsVisible(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                      {YES_NO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </div>
                )}
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Studs</label>
                  <select value={roadStuds} onChange={e => setRoadStuds(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {YES_NO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Passability</label>
                  <select value={passability002} onChange={e => setPassability002(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="all_year_round">All year round</option>
                    <option value="dry_season_only">Dry season</option>
                    <option value="rupture">Rupture</option>
                    <option value="under_construction">Under construction / rehabilitation (detour)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Year Sealed</label>
                  <input type="number" placeholder="e.g. 2018" value={yearConstructedToSealedStandard} onChange={e => setYearConstructedToSealedStandard(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
              </div>
            </div>
          )}

          {section === "gravel" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Gravel Road Details</div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Class</label>
                  <select value={gravelRoadClass} onChange={e => setGravelRoadClass(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {SEALED_ROAD_CLASS_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Gravel Thickness</label>
                  <select value={gravelThickness} onChange={e => setGravelThickness(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="less_than_50">&lt; 50 mm</option>
                    <option value="_100">50-100 mm</option>
                    <option value="_150">100-150 mm</option>
                    <option value="_200">&gt; 150 mm</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={gravelCondition} onChange={e => setGravelCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {CONDITION_WITH_CONSTRUCTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Corrugations</label>
                  <select value={gravelCorrugations} onChange={e => setGravelCorrugations(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="none">None</option>
                    <option value="minor">Minor</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Potholes</label>
                  <select value={gravelPotholesDegree} onChange={e => setGravelPotholesDegree(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="none">None</option>
                    <option value="minor">Minor</option>
                    <option value="severe">Severe</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage Cond.</label>
                  <select value={gravelDrainageCondition} onChange={e => setGravelDrainageCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                    <option value="mixed">Mixed</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Year Constructed</label>
                  <input type="number" placeholder="e.g. 2012" value={gravelYearOfConstruction} onChange={e => setGravelYearOfConstruction(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Corrugations Severity</label>
                  <select value={gravelCorrugationsSeverity} onChange={e => setGravelCorrugationsSeverity(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {DEFECT_SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Cross Section Severity</label>
                  <select value={gravelCrossSectionSeverity} onChange={e => setGravelCrossSectionSeverity(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {DEFECT_SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage Severity</label>
                  <select value={gravelDrainageSeverity} onChange={e => setGravelDrainageSeverity(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {DEFECT_SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Potholes Severity</label>
                  <select value={gravelPotholesSeverity} onChange={e => setGravelPotholesSeverity(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {DEFECT_SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Riding Quality Severity</label>
                <select value={gravelRidingSeverity} onChange={e => setGravelRidingSeverity(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  {DEFECT_SEVERITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Authority</label>
                  <select value={gravelAuthority} onChange={e => setGravelAuthority(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {AUTHORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Passability</label>
                  <select value={gravelPassability} onChange={e => setGravelPassability(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="all_year_round">All year round</option>
                    <option value="dry_season_only">Dry season</option>
                    <option value="rupture">Rupture</option>
                    <option value="under_construction">Under construction / rehabilitation (detour)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "earth" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Earth Road Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Name</label>
                <input type="text" placeholder="e.g. Sabi Valley Track" value={earthRoadName} onChange={e => setEarthRoadName(e.target.value)} required={section === "earth"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Class</label>
                  <select value={earthRoadClass} onChange={e => setEarthRoadClass(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="tertiary_feeder">Tertiary Feeder</option>
                    <option value="access_road">Access Road</option>
                    <option value="urban_cbd">CBD</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={earthRoadCondition} onChange={e => setEarthRoadCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {CONDITION_WITH_CONSTRUCTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Width (m)</label>
                  <input type="number" placeholder="e.g. 6" value={earthRoadWidth} onChange={e => setEarthRoadWidth(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Length (km)</label>
                  <input type="number" placeholder="e.g. 15" value={earthRoadLength} onChange={e => setEarthRoadLength(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Passability</label>
                  <select value={earthRoadPassability} onChange={e => setEarthRoadPassability(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="all_year_round">All Year Round</option>
                    <option value="dry_season_only">Dry Season Only</option>
                    <option value="impassable">Impassable</option>
                    <option value="rupture">Rupture</option>
                    <option value="under_construction">Under construction / rehabilitation (detour)</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Authority</label>
                <select value={earthAuthority} onChange={e => setEarthAuthority(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  {AUTHORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
            </div>
          )}

          {section === "bridge" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Bridge Structure Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Bridge Name</label>
                <input type="text" placeholder="e.g. Save River Bridge" value={bridgeName} onChange={e => setBridgeName(e.target.value)} required={section === "bridge"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Crossing Type</label>
                  <select value={bridgeCrossing} onChange={e => setBridgeCrossing(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="river">River Crossing</option>
                    <option value="road">Road flyover</option>
                    <option value="rail">Railway flyover</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Deck Type</label>
                  <select value={bridgeType} onChange={e => setBridgeType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="hldc">HLDC Deck</option>
                    <option value="sldc">SLDC Deck</option>
                    <option value="slc">SLC Deck</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Bearing Type</label>
                  <select value={bridgeBearing} onChange={e => setBridgeBearing(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="elastometric">Elastometric</option>
                    <option value="sliding">Sliding</option>
                    <option value="roller">Roller</option>
                    <option value="disk">Disk</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Bearings State</label>
                  <select value={bearingsState} onChange={e => setBearingsState(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Expansion Joints</label>
                  <select value={bridgeJoints} onChange={e => setBridgeJoints(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Parapet State</label>
                  <select value={parapet} onChange={e => setParapet(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="undamaged">Undamaged</option>
                    <option value="damaged">Damaged</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Chemical Reaction</label>
                  <select value={chemicalEffect} onChange={e => setChemicalEffect(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="none">None</option>
                    <option value="mild">Mild</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Joint Vegetation</label>
                  <select value={vegetationGrowth} onChange={e => setVegetationGrowth(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="no">No growth</option>
                    <option value="yes">Yes (Invasive)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage</label>
                  <select value={drainage} onChange={e => setDrainage(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="clogged">Clogged</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", marginBottom: 4 }}>Overall Condition</label>
                  <select value={bridgeCondition} onChange={e => setBridgeCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "2px solid var(--green)", borderRadius: 6, fontSize: 11.5, background: "#fff", fontWeight: 700, outline: "none", fontFamily: "var(--font-body)" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "footbridge" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Foot Bridge Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Footbridge Name</label>
                <input type="text" placeholder="e.g. Mbare Pedestrian Bridge" value={footbridgeName} onChange={e => setFootbridgeName(e.target.value)} required={section === "footbridge"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Footbridge Type</label>
                  <select value={footbridgeType} onChange={e => setFootbridgeType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="suspension">Suspension</option>
                    <option value="concrete_slab">Concrete Slab</option>
                    <option value="timber">Timber Deck</option>
                    <option value="truss">Steel Truss</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Material</label>
                  <select value={footbridgeMaterial} onChange={e => setFootbridgeMaterial(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="steel">Steel</option>
                    <option value="concrete">Concrete</option>
                    <option value="wood">Wood/Timber</option>
                    <option value="masonry">Masonry</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Width (m)</label>
                  <input type="number" placeholder="e.g. 2.5" value={footbridgeWidth} onChange={e => setFootbridgeWidth(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Span (m)</label>
                  <input type="number" placeholder="e.g. 15" value={footbridgeSpan} onChange={e => setFootbridgeSpan(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={footbridgeCondition} onChange={e => setFootbridgeCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "rail_crossing" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Rail Crossing Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Crossing Name</label>
                <input type="text" placeholder="e.g. Harare Rd Level Crossing" value={railCrossingName} onChange={e => setRailCrossingName(e.target.value)} required={section === "rail_crossing"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Crossing Type</label>
                  <select value={railCrossingType} onChange={e => setRailCrossingType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="at_grade">At Grade Level Crossing</option>
                    <option value="grade_separated">Grade Separated Flyover</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Control Type</label>
                  <select value={railCrossingControl} onChange={e => setRailCrossingControl(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="gates">Gates</option>
                    <option value="signals">Signals</option>
                    <option value="boom_barrier">Boom Barrier</option>
                    <option value="signs_only">Signs Only</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Class</label>
                  <select value={railCrossingRoadClass} onChange={e => setRailCrossingRoadClass(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="primary">Primary</option>
                    <option value="secondary">Secondary</option>
                    <option value="tertiary">Tertiary</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={railCrossingCondition} onChange={e => setRailCrossingCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "tollgate" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Tollgate Plaza Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Tollgate Name</label>
                <input type="text" placeholder="e.g. Skyline Tollgate" value={tollgateName} onChange={e => setTollgateName(e.target.value)} required={section === "tollgate"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Tollgate Type</label>
                  <select value={tollgateType} onChange={e => setTollgateType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="manual">Manual Cashier</option>
                    <option value="e_toll">E-Toll Electronic</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Lanes Count</label>
                  <input type="number" placeholder="e.g. 4" value={tollgateLanes} onChange={e => setTollgateLanes(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Operational</label>
                  <select value={tollgateOperational} onChange={e => setTollgateOperational(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={tollgateCondition} onChange={e => setTollgateCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "layby" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Lay By Details</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Surface Type</label>
                  <select value={laybySurface} onChange={e => setLaybySurface(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="gravel">Gravel</option>
                    <option value="asphalt">Asphalt/Paved</option>
                    <option value="concrete">Concrete</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Length (m)</label>
                  <input type="number" placeholder="e.g. 50" value={laybyLength} onChange={e => setLaybyLength(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage</label>
                  <select value={laybyDrainage} onChange={e => setLaybyDrainage(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good (Drained)</option>
                    <option value="poor">Poor (Puddles)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={laybyCondition} onChange={e => setLaybyCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "busstop" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Bus Stop Details</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Bus Stop Type</label>
                  <select value={busstopType} onChange={e => setBusstopType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="bay_type">Bus Bay (Recessed)</option>
                    <option value="shelter_only">Shelter on Curb</option>
                    <option value="sign_only">Signpost Only</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Shelter Present</label>
                  <select value={busstopShelter} onChange={e => setBusstopShelter(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage</label>
                  <select value={busstopDrainage} onChange={e => setBusstopDrainage(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={busstopCondition} onChange={e => setBusstopCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "junction" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Junction Details</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Junction Type</label>
                  <select value={junctionType} onChange={e => setJunctionType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="t_junction">T Junction</option>
                    <option value="crossroads">Crossroads</option>
                    <option value="roundabout">Roundabout</option>
                    <option value="y_junction">Y Junction</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Control Type</label>
                  <select value={junctionControl} onChange={e => setJunctionControl(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="signs">Give Way/Stop Signs</option>
                    <option value="signals">Traffic Lights</option>
                    <option value="roundabout">Roundabout rules</option>
                    <option value="priority">Priority road</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Markings</label>
                  <select value={junctionRoadMarkings} onChange={e => setJunctionRoadMarkings(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Signage</label>
                  <select value={junctionSignage} onChange={e => setJunctionSignage(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={junctionCondition} onChange={e => setJunctionCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "road_rupture" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Road Rupture</div>
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>What is at this point?</label>
                <select value={ruptureKind} onChange={e => setRuptureKind(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="rupture">Road rupture (break / washaway)</option>
                  <option value="under_construction">Under construction / rehabilitation</option>
                </select>
              </div>
              {ruptureKind === "rupture" && (
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Cause</label>
                  <select value={ruptureCause} onChange={e => setRuptureCause(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="washaway">Washaway</option>
                    <option value="collapse">Collapse</option>
                    <option value="missing_pavement">Missing pavement</option>
                    <option value="cut_off">Road cut off</option>
                    <option value="other">Other</option>
                  </select>
                </div>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Detour available</label>
                  <select value={ruptureDetour} onChange={e => setRuptureDetour(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                {ruptureKind === "rupture" && (
                  <div>
                    <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Severity</label>
                    <select value={ruptureCondition} onChange={e => setRuptureCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                      <option value="fair">Partial / passable</option>
                      <option value="poor">Impassable</option>
                    </select>
                  </div>
                )}
              </div>
            </div>
          )}

          {section === "sign" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Road Sign Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Signage Name</label>
                <input type="text" placeholder="e.g. speed_limit_80" value={signName} onChange={e => setSignName(e.target.value)} required={section === "sign"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Sign Type</label>
                  <select value={signType} onChange={e => setSignType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="warning">Warning Sign</option>
                    <option value="regulatory">Regulatory Sign</option>
                    <option value="guidance">Guidance Sign</option>
                    <option value="information">Information Sign</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Visibility</label>
                  <select value={signVisibility} onChange={e => setSignVisibility(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good (Clear)</option>
                    <option value="fair">Fair (Slightly Blocked)</option>
                    <option value="obscured">Obscured / Damaged</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>SADC Compliant</label>
                  <select value={sadcCompliant} onChange={e => setSadcCompliant(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={signCondition} onChange={e => setSignCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "shelvet" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Shelvert Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Material / Type</label>
                <select value={shelvetType} onChange={e => setShelvertType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="armco">Armco steel pipe</option>
                  <option value="shelvets">Masonry shelvets</option>
                  <option value="concrete">Concrete shelvets</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition State</label>
                <select value={shelvetCondition} onChange={e => setShelvertCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="good">Good (Dry/Solid)</option>
                  <option value="corroded">Corroded / Rusty</option>
                  <option value="collapsed">Collapsed frame</option>
                </select>
              </div>
            </div>
          )}

          {section === "culvert" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Culvert Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Culvert Class</label>
                <select value={culvertClass} onChange={e => setCulvertClass(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="pipe_culvert">Pipe Culvert</option>
                  <option value="box_culvert">Box Culvert</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Material Type</label>
                <select value={culvertType} onChange={e => setCulvertType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="concrete">Concrete</option>
                  <option value="steel">Steel</option>
                  <option value="masonry">Masonry</option>
                  <option value="corrugated_metal">Corrugated Metal</option>
                </select>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Serviceability State</label>
                <select value={culvertServiceability} onChange={e => setCulvertServiceability(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="good">Good (Operational)</option>
                  <option value="partially_blocked">Partially Blocked</option>
                  <option value="fully_blocked">Fully Blocked</option>
                  <option value="damaged">Damaged walls</option>
                </select>
              </div>
            </div>
          )}

          {section === "piped_causeway" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Piped Causeway Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Causeway Name</label>
                <input type="text" placeholder="e.g. Runde Piped Causeway" value={causewayName} onChange={e => setCausewayName(e.target.value)} required={section === "piped_causeway"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Pipe Material</label>
                  <select value={causewayPipeMaterial} onChange={e => setCausewayPipeMaterial(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="concrete">Concrete</option>
                    <option value="steel">Steel</option>
                    <option value="corrugated_metal">Corrugated Metal</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Pipe Diameter</label>
                  <select value={causewayPipeDiameter} onChange={e => setCausewayPipeDiameter(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="600_900">600mm - 900mm</option>
                    <option value="less_than_600">&lt; 600mm</option>
                    <option value="more_than_900">&gt; 900mm</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage</label>
                  <select value={causewayDrainage} onChange={e => setCausewayDrainage(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Serviceability</label>
                  <select value={causewayServiceability} onChange={e => setCausewayServiceability(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="partially_blocked">Partially Blocked</option>
                    <option value="fully_blocked">Fully Blocked</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={causewayCondition} onChange={e => setCausewayCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "drift" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Drift Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drift Name</label>
                <input type="text" placeholder="e.g. Tokwe Drift" value={driftName} onChange={e => setDriftName(e.target.value)} required={section === "drift"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Surface Material</label>
                  <select value={driftSurface} onChange={e => setDriftSurface(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="concrete">Concrete Slab</option>
                    <option value="masonry">Stone Pitching</option>
                    <option value="gravel">Gravel / Rock</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Width (m)</label>
                  <input type="number" placeholder="e.g. 7" value={driftWidth} onChange={e => setDriftWidth(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Passability</label>
                  <select value={driftPassability} onChange={e => setDriftPassability(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="all_year_round">All Year Round</option>
                    <option value="dry_season_only">Dry Season Only</option>
                    <option value="impassable">Impassable</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={driftCondition} onChange={e => setDriftCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "grid" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Cattle Grid Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Grid Name</label>
                <input type="text" placeholder="e.g. boundary gate grid" value={gridName} onChange={e => setGridName(e.target.value)} required={section === "grid"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Material</label>
                  <select value={gridMaterial} onChange={e => setGridMaterial(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="steel">Steel Bars</option>
                    <option value="iron">Cast Iron</option>
                    <option value="concrete">Concrete Frame</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Operational</label>
                  <select value={gridOperational} onChange={e => setGridOperational(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </div>
              </div>

              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                <select value={gridCondition} onChange={e => setGridCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </div>
          )}

          {section === "catchpit" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Catchpit Details</div>
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                <select value={catchpitCondition} onChange={e => setCatchpitCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
            </div>
          )}

          {section === "traffic_calming" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Traffic Calming Details</div>
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Type</label>
                <select value={trafficCalmingType} onChange={e => setTrafficCalmingType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  {TRAFFIC_CALMING_TYPES.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                </select>
              </div>
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                <select value={trafficCalmingCondition} onChange={e => setTrafficCalmingCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                  <option value="good">Good</option>
                  <option value="fair">Fair</option>
                  <option value="poor">Poor</option>
                </select>
              </div>
            </div>
          )}

          {section === "traffic_lights" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Traffic Lights Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Location Description</label>
                <input type="text" placeholder="e.g. Samora Machel Ave junction" value={trafficLightsLocation} onChange={e => setTrafficLightsLocation(e.target.value)} required={section === "traffic_lights"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Signal Type</label>
                  <select value={trafficLightsType} onChange={e => setTrafficLightsType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="standard">Standard Vehicular</option>
                    <option value="pedestrian_only">Pedestrian Signal Only</option>
                    <option value="countdown">Vehicular with Countdown</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Phases Count</label>
                  <input type="number" placeholder="e.g. 3" value={trafficLightsPhases} onChange={e => setTrafficLightsPhases(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Operational</label>
                  <select value={trafficLightsOperational} onChange={e => setTrafficLightsOperational(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes (Fully)</option>
                    <option value="no">No (Dark)</option>
                    <option value="flashing">Flashing Amber</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={trafficLightsCondition} onChange={e => setTrafficLightsCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "streetlight" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Streetlight Details</div>
              
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Lamp Type</label>
                  <select value={streetlightType} onChange={e => setStreetlightType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="led">LED</option>
                    <option value="sodium">High-Pressure Sodium</option>
                    <option value="halogen">Halogen</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Power Source</label>
                  <select value={streetlightPowerSource} onChange={e => setStreetlightPowerSource(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="grid">Grid AC</option>
                    <option value="solar">Solar PV / Battery</option>
                    <option value="generator">Local Generator</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Lamps Count</label>
                  <input type="number" placeholder="e.g. 12" value={streetlightCount} onChange={e => setStreetlightCount(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Operational</label>
                  <select value={streetlightOperational} onChange={e => setStreetlightOperational(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 11.5, background: "#fff" }}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                    <option value="partially">Partially</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Condition</label>
                  <select value={streetlightCondition} onChange={e => setStreetlightCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* Action Row */}
          <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", borderTop: "1px solid var(--border)", paddingTop: 14, flexShrink: 0 }}>
            <button type="button" onClick={onClose} disabled={isSaving} style={{ background: "#f4f6f5", border: "1px solid var(--border)", borderRadius: 8, padding: "8px 16px", fontSize: 12, fontWeight: 700, color: "var(--text-secondary)", cursor: isSaving ? "not-allowed" : "pointer", fontFamily: "var(--font-body)", opacity: isSaving ? 0.5 : 1 }}>
              Cancel
            </button>
            <button type="submit" disabled={isSaving} style={{ background: isSaving ? "var(--green-light)" : "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 22px", fontSize: 12, fontWeight: 700, cursor: isSaving ? "not-allowed" : "pointer", fontFamily: "var(--font-body)", display: "flex", alignItems: "center", gap: 7, minWidth: 120, justifyContent: "center", transition: "all 0.15s" }}>
              {isSaving ? (
                <>
                  <div style={{ width: 13, height: 13, border: "2px solid rgba(255,255,255,0.35)", borderTop: "2px solid #fff", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                  Saving…
                </>
              ) : (
                record ? "✓ Update Record" : "💾 Save Record"
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}


function DatabasePage({ onSelectRecord, onRefresh, onToast }: { records?: any[]; onSelectRecord: (r: any) => void; onRefresh?: () => void; onToast?: (msg: string, type: "success" | "error" | "info") => void }) {
  const [category, setCategory] = useState("sealed");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string>("survey_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  const [highwayFilter, setHighwayFilter] = useState("all");
  const [condFilter, setCondFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [surveyorFilter, setSurveyorFilter] = useState("all");

  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [drawerRecord, setDrawerRecord] = useState<any | null>(null);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");

  useEffect(() => {
    const t = window.setTimeout(() => setSearchDebounced(search.trim()), 300);
    return () => window.clearTimeout(t);
  }, [search]);

  const {
    records: pageRecords,
    total,
    counts,
    stats: categoryStats,
    roads,
    surveyors,
    loading,
    error,
    reload,
  } = useCategoryBrowse({
    category,
    page,
    pageSize: PAGE_SIZE,
    search: searchDebounced,
    condition: condFilter,
    road: highwayFilter,
    surveyor: surveyorFilter,
    province: provinceFilter,
    district: districtFilter,
    sort: sortCol,
    dir: sortDir,
  });

  const workingTotal = total;
  const pages = Math.max(1, Math.ceil(workingTotal / PAGE_SIZE));
  const pageSafe = Math.min(page, pages - 1);
  const slice = pageRecords;

  useEffect(() => {
    if (page > pages - 1) setPage(Math.max(0, pages - 1));
  }, [page, pages]);

  const activeLabel =
    OVERLAY_GROUPS.flatMap((g) => g.items).find((i) => i.key === category)?.label ?? category;

  const surveyorsList = surveyors;
  const highwayOptions = roads;

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortCol(col);
      setSortDir("asc");
    }
    setPage(0);
  };

  const selectCategory = (key: string) => {
    setCategory(key);
    setHighwayFilter("all");
    setPage(0);
    setDrawerRecord(null);
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (!window.confirm("Are you sure you want to delete this survey record? This action cannot be undone.")) {
      return;
    }
    try {
      const res = await fetch(`/api/roads?id=${id}`, { method: "DELETE" });
      const data = await res.json();
      if (res.ok && data.success) {
        if (onToast) onToast(data.message || "Record deleted successfully.", "success");
        setDrawerRecord(null);
        reload();
        if (onRefresh) onRefresh();
      } else {
        throw new Error(data.error || "Delete failed");
      }
    } catch (err: any) {
      if (onToast) onToast("Delete failed: " + err.message, "error");
    }
  };

  const handleSave = async (formData: any) => {
    try {
      const isEdit = !!editRecord;
      const url = "/api/roads";
      const method = isEdit ? "PUT" : "POST";

      const record: any = { ...formData };

      if (isEdit) {
        record._id = editRecord._id;
        if (editRecord.id) record.id = editRecord.id;
        if (editRecord.survey_id) record.survey_id = editRecord.survey_id;
        record.source = editRecord.source || "dashboard";
      } else {
        record.source = "dashboard";
      }

      const res = await fetch(url, {
        method: method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ record }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        if (onToast) onToast(isEdit ? "✓ Survey record updated successfully!" : "✓ Survey record saved to Supabase!", "success");
        setIsFormOpen(false);
        reload();
        if (onRefresh) onRefresh();
      } else {
        throw new Error(data.error || "Saving survey record failed");
      }
    } catch (err: any) {
      if (onToast) onToast("Save failed: " + err.message, "error");
    }
  };

  const headers: { col: string; label: string }[] = [
    { col: "asset_name", label: "Asset Name" },
    { col: "road_name", label: "Road / Highway" },
    { col: "section_name", label: "Section" },
    { col: "province", label: "Province" },
    { col: "district", label: "District" },
    { col: "condition", label: "Condition" },
    { col: "survey_date", label: "Survey Date" },
    { col: "surveyor_name", label: "Surveyor" },
    { col: "gps", label: "GPS" },
  ];

  const Th = ({ col, label }: { col: string; label: string }) => (
    <th
      onClick={() => handleSort(col)}
      style={{
        cursor: "pointer",
        userSelect: "none",
        background: "#f0f7f3",
        borderBottom: "2px solid var(--border)",
        padding: "9px 12px",
        textAlign: "left",
        fontSize: 10,
        fontWeight: 700,
        textTransform: "uppercase",
        letterSpacing: "0.6px",
        color: sortCol === col ? "var(--green)" : "var(--text-muted)",
        whiteSpace: "nowrap",
      }}
    >
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>
        {label}
        <ArrowUpDown size={10} />
      </span>
    </th>
  );

  const drawerId = drawerRecord
    ? String(drawerRecord.id || drawerRecord._id || drawerRecord.survey_id || "")
    : "";

  return (
    <div style={{ height: "100%", display: "flex", background: "var(--bg-app)", position: "relative", overflow: "hidden" }}>
      {/* Left: asset type panel */}
      <aside style={{
        width: 220,
        flexShrink: 0,
        background: "#fff",
        borderRight: "1px solid var(--border)",
        display: "flex",
        flexDirection: "column",
        overflow: "hidden",
      }}>
        <div style={{ padding: "14px 14px 10px", borderBottom: "1px solid var(--border)", flexShrink: 0 }}>
          <div style={{ fontSize: 10, fontWeight: 800, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.7px" }}>
            Asset Type
          </div>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 3 }}>
            Select one category to browse
          </div>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "8px 8px 12px" }}>
          {OVERLAY_GROUPS.map((group) => (
            <div key={group.id} style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", padding: "4px 8px 6px" }}>
                {group.label}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                {group.items.map((item) => {
                  const count = counts[item.key] || 0;
                  const active = category === item.key;
                  return (
                    <button
                      key={item.key}
                      type="button"
                      onClick={() => selectCategory(item.key)}
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 8,
                        padding: "8px 10px",
                        borderRadius: 8,
                        border: active ? "1.5px solid var(--green)" : "1px solid transparent",
                        background: active ? "var(--bg-active)" : "transparent",
                        color: active ? "var(--green)" : "var(--text-secondary)",
                        fontSize: 11.5,
                        fontWeight: active ? 800 : 600,
                        cursor: "pointer",
                        textAlign: "left",
                        fontFamily: "var(--font-body)",
                      }}
                    >
                      <span style={{ display: "flex", alignItems: "center", gap: 6, minWidth: 0 }}>
                        <span aria-hidden>{item.emoji}</span>
                        <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{item.label}</span>
                      </span>
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        background: active ? "rgba(0,102,51,0.12)" : "rgba(0,0,0,0.05)",
                        borderRadius: 10,
                        padding: "1px 7px",
                        flexShrink: 0,
                      }}>
                        {count}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </aside>

      {/* Main column */}
      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
        {/* Per-asset stats */}
        <div style={{
          background: "var(--green)",
          padding: "12px 20px",
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: 16,
          flexShrink: 0,
          flexWrap: "wrap",
        }}>
          <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 11, fontWeight: 700 }}>
            {activeLabel} · condition snapshot
          </div>
          <div style={{ display: "flex", gap: 0, alignItems: "stretch" }}>
            {[
              { label: "Total", value: categoryStats.total, color: "#fff" },
              { label: "Good", value: categoryStats.good, color: "#fff" },
              { label: "Fair", value: categoryStats.fair, color: "#fff" },
              { label: "Poor", value: categoryStats.poor, color: categoryStats.poor > 0 ? "#FFD100" : "#fff" },
            ].map((stat, i) => (
              <div key={stat.label} style={{ display: "flex", alignItems: "center" }}>
                {i > 0 && <div style={{ width: 1, height: 28, background: "rgba(255,255,255,0.2)", margin: "0 14px" }} />}
                <div style={{ textAlign: "center", minWidth: 52 }}>
                  <div style={{ fontFamily: "var(--font-title)", fontSize: 22, fontWeight: 800, color: stat.color, lineHeight: 1 }}>
                    {stat.value}
                  </div>
                  <div style={{ fontSize: 8.5, textTransform: "uppercase", letterSpacing: "0.5px", color: "rgba(255,255,255,0.7)", marginTop: 2 }}>
                    {stat.label}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Toolbar */}
        <div style={{ padding: "12px 20px", borderBottom: "1px solid var(--border)", background: "#fafcfb", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          <div style={{ position: "relative", flex: 2, minWidth: 180 }}>
            <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
            <input
              placeholder={`Search ${activeLabel.toLowerCase()}…`}
              value={search}
              onChange={(e) => { setSearch(e.target.value); setPage(0); }}
              style={{ width: "100%", padding: "7px 10px 7px 30px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-primary)" }}
            />
          </div>

          <select
            value={highwayFilter}
            onChange={(e) => { setHighwayFilter(e.target.value); setPage(0); }}
            style={{ padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer", maxWidth: 200 }}
          >
            <option value="all">All Highways</option>
            <option value="A1">A1 Route</option>
            <option value="A2">A2 Route</option>
            <option value="A3">A3 Route</option>
            <option value="A4">A4 Route</option>
            <option value="A5">A5 Route</option>
            {highwayOptions
              .filter((r) => !/^A[1-5]\b/.test(r))
              .slice(0, 40)
              .map((r) => (
                <option key={r} value={r}>{(r ?? "").split(" (")[0]}</option>
              ))}
          </select>

          <select
            value={condFilter}
            onChange={(e) => { setCondFilter(e.target.value); setPage(0); }}
            style={{ padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer" }}
          >
            <option value="all">All Conditions</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="mixed">Mixed</option>
            <option value="under_construction">Under construction</option>
          </select>

          <select
            value={surveyorFilter}
            onChange={(e) => { setSurveyorFilter(e.target.value); setPage(0); }}
            style={{ padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer" }}
          >
            <option value="all">All Surveyors</option>
            {surveyorsList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>

          <button
            onClick={() => setShowAdvanced(!showAdvanced)}
            style={{ padding: "7px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: showAdvanced ? "var(--bg-active)" : "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}
          >
            {showAdvanced ? "▲ Hide Location" : "▼ Location Filters"}
          </button>

          <button
            onClick={() => { setEditRecord(null); setIsFormOpen(true); }}
            style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-body)" }}
          >
            <span>+</span> Add Survey Record
          </button>

          <div style={{ display: "flex", background: "#fff", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, overflow: "hidden" }}>
            <button
              type="button"
              onClick={() => setViewMode("cards")}
              title="Card view"
              style={{
                padding: "7px 10px",
                border: "none",
                background: viewMode === "cards" ? "var(--bg-active)" : "transparent",
                color: viewMode === "cards" ? "var(--green)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <LayoutGrid size={14} />
            </button>
            <button
              type="button"
              onClick={() => setViewMode("table")}
              title="Table view"
              style={{
                padding: "7px 10px",
                border: "none",
                borderLeft: "1px solid rgba(0,102,51,0.2)",
                background: viewMode === "table" ? "var(--bg-active)" : "transparent",
                color: viewMode === "table" ? "var(--green)" : "var(--text-muted)",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
              }}
            >
              <Table2 size={14} />
            </button>
          </div>

          <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", whiteSpace: "nowrap" }}>
            {loading ? "Loading…" : `${workingTotal} rows`} · Page {pageSafe + 1}/{pages}
          </span>
        </div>

        {showAdvanced && (
          <div style={{ padding: "10px 20px 12px", borderBottom: "1px solid var(--border)", background: "#fafcfb", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Province:</span>
              <select
                value={provinceFilter}
                onChange={(e) => { setProvinceFilter(e.target.value); setDistrictFilter("all"); setPage(0); }}
                style={{ padding: "6px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer" }}
              >
                <option value="all">All Provinces</option>
                {Object.keys(ZIM_PROVINCES_DISTRICTS).map((p) => (
                  <option key={p} value={p}>{p}</option>
                ))}
              </select>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>District:</span>
              <select
                value={districtFilter}
                onChange={(e) => { setDistrictFilter(e.target.value); setPage(0); }}
                disabled={provinceFilter === "all"}
                style={{ padding: "6px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: provinceFilter === "all" ? "#f4f6f5" : "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: provinceFilter === "all" ? "not-allowed" : "pointer" }}
              >
                <option value="all">All Districts</option>
                {provinceFilter !== "all" && (ZIM_PROVINCES_DISTRICTS[provinceFilter] || []).map((d) => (
                  <option key={d} value={d}>{d}</option>
                ))}
              </select>
            </div>
            {(provinceFilter !== "all" || districtFilter !== "all") && (
              <button
                onClick={() => { setProvinceFilter("all"); setDistrictFilter("all"); setPage(0); }}
                style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11.5, fontWeight: 700, fontFamily: "var(--font-body)", padding: 0, textDecoration: "underline" }}
              >
                Clear Location Filters
              </button>
            )}
          </div>
        )}

        {viewMode === "cards" ? (
        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          {error ? (
            <div style={{ textAlign: "center", color: "#dc2626", padding: 40, fontSize: 13 }}>{error}</div>
          ) : loading && slice.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 13 }}>Loading {activeLabel.toLowerCase()}…</div>
          ) : slice.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 13 }}>
              No {activeLabel.toLowerCase()} match your filters.
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12, opacity: loading ? 0.6 : 1 }}>
              {slice.map((r, i) => {
                const id = String(r.id || r._id || r.survey_id || "");
                return (
                  <SurveyAssetCard
                    key={id || `${category}-${pageSafe}-${i}`}
                    record={r}
                    selected={!!drawerId && id === drawerId}
                    onOpen={setDrawerRecord}
                    onShowOnMap={onSelectRecord}
                  />
                );
              })}
            </div>
          )}
        </div>
        ) : (
        <div style={{ flex: 1, overflowX: "auto", overflowY: "auto", opacity: loading ? 0.65 : 1 }}>
          {error ? (
            <div style={{ padding: 40, textAlign: "center", color: "#dc2626", fontSize: 13 }}>{error}</div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
              <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
                <tr>
                  <th style={{ background: "#f0f7f3", borderBottom: "2px solid var(--border)", padding: "9px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", width: 40 }}>#</th>
                  {headers.map((h) => (
                    <Th key={h.col} col={h.col} label={h.label} />
                  ))}
                  <th style={{ background: "#f0f7f3", borderBottom: "2px solid var(--border)", padding: "9px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", width: 140 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {slice.length === 0 ? (
                  <tr>
                    <td colSpan={headers.length + 2} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                      {loading ? `Loading ${activeLabel.toLowerCase()}…` : `No matching ${activeLabel.toLowerCase()} found.`}
                    </td>
                  </tr>
                ) : (
                  slice.map((r, i) => {
                    const gpsLabel = formatGpsLabel(r);
                    const id = String(r.id || r._id || r.survey_id || "");
                    const selected = !!drawerId && id === drawerId;
                    return (
                      <tr
                        key={id || i}
                        onClick={() => setDrawerRecord(r)}
                        title="Click row to inspect"
                        style={{
                          cursor: "pointer",
                          transition: "background 0.1s",
                          background: selected ? "var(--bg-active)" : "transparent",
                        }}
                        onMouseOver={(e) => {
                          if (!selected) e.currentTarget.style.background = "var(--bg-hover)";
                        }}
                        onMouseOut={(e) => {
                          e.currentTarget.style.background = selected ? "var(--bg-active)" : "transparent";
                        }}
                      >
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", fontWeight: 600 }}>
                          {pageSafe * PAGE_SIZE + i + 1}
                        </td>
                        {headers.map((h) => {
                          let valContent: React.ReactNode = "—";
                          if (h.col === "asset_name") valContent = getAssetName(r);
                          else if (h.col === "condition") {
                            const c = getRecordStatus(r);
                            valContent = <span className={`badge ${c}`}>{formatStatusLabel(c)}</span>;
                          } else if (h.col === "gps") {
                            valContent = gpsLabel ? (
                              <span style={{ fontFamily: "ui-monospace, monospace" }}>{gpsLabel}</span>
                            ) : "—";
                          } else {
                            const rawVal = r[h.col];
                            valContent = rawVal !== null && rawVal !== undefined && rawVal !== "" ? formatValue(rawVal) : "—";
                          }
                          return (
                            <td
                              key={h.col}
                              style={{
                                padding: "8px 12px",
                                borderBottom: "1px solid rgba(0,102,51,0.06)",
                                color: h.col === "asset_name" ? "var(--text-primary)" : "var(--text-secondary)",
                                fontWeight: h.col === "asset_name" ? 600 : 400,
                                whiteSpace: "nowrap",
                                maxWidth: 280,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                              }}
                            >
                              {valContent}
                            </td>
                          );
                        })}
                        <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,102,51,0.06)", whiteSpace: "nowrap" }} onClick={(e) => e.stopPropagation()}>
                          <button
                            type="button"
                            onClick={() => onSelectRecord(r)}
                            title="Show on map"
                            style={{ background: "var(--bg-active)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--green)", cursor: "pointer", marginRight: 8, fontWeight: 700, fontSize: 11, fontFamily: "var(--font-body)", padding: "4px 8px" }}
                          >
                            🗺 Map
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditRecord(r); setIsFormOpen(true); }}
                            style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", marginRight: 10, fontWeight: 700, fontSize: 11, fontFamily: "var(--font-body)" }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={(e) => handleDelete(e, r._id || r.id || r.survey_id)}
                            style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700, fontSize: 11, fontFamily: "var(--font-body)" }}
                          >
                            Delete
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>
        )}

        {/* Pagination */}
        <div style={{ padding: "10px 20px", borderTop: "1px solid var(--border)", background: "#fafcfb", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
          <button
            onClick={() => setPage((p) => Math.max(0, p - 1))}
            disabled={pageSafe === 0 || loading}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 600, cursor: pageSafe === 0 ? "not-allowed" : "pointer", fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
          >
            ← Previous
          </button>
          <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
            Showing {workingTotal === 0 ? 0 : pageSafe * PAGE_SIZE + 1}–{Math.min((pageSafe + 1) * PAGE_SIZE, workingTotal)} of {workingTotal}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(pages - 1, p + 1))}
            disabled={pageSafe >= pages - 1 || loading}
            style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 600, cursor: pageSafe >= pages - 1 ? "not-allowed" : "pointer", fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}
          >
            Next →
          </button>
        </div>
      </div>

      {drawerRecord && (
        <SurveyDetailDrawer
          record={drawerRecord}
          onClose={() => setDrawerRecord(null)}
          onShowOnMap={onSelectRecord}
        />
      )}

      <SurveyFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} record={editRecord} onSave={handleSave} onToast={onToast} />
    </div>
  );
}


/* Export page lives in ./ExportPage.tsx */


/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
 ════════════════════════════════════════════════════════════════════════════ */




import UserManagementPanel from "./UserManagementPanel";
import DeletionApprovalsPanel from "./DeletionApprovalsPanel";
import { UserProfile } from "@/components/helpers";

const MODULE_TITLES: Record<string, string> = {
  dashboard: "Road Network Overview",
  highways: "Highway Corridor Performance & Asset Analysis",
  analytics: "Survey Analysis",
  survey: "Survey Records",
  database: "Survey Records",
  gallery: "SADC Compliant Asset Photo & Evidence Gallery",
  reports: "Road Condition Briefing Pack",
  documents: "Ministry Manuals, Guidelines & Policy Document Library",
  export: "Data Export & Geographic Exchange Center",
  users: "User accounts",
  approvals: "Deletion approvals",
  settings: "Account & Administration",
};

const MODULE_ICONS: Record<string, React.ReactNode> = {
  dashboard: <LayoutDashboard size={18} />,
  highways: <Route size={18} />,
  analytics: <BarChart2 size={18} />,
  survey: <ClipboardCheck size={18} />,
  database: <ClipboardCheck size={18} />,
  gallery: <Camera size={18} />,
  reports: <FileText size={18} />,
  documents: <BookOpen size={18} />,
  export: <Download size={18} />,
  users: <Users size={18} />,
  approvals: <ShieldAlert size={18} />,
  settings: <Settings size={18} />,
};

interface FullPageModuleProps {
  module: NavModule;
  records: any[];
  onSelectRecord?: (r: any) => void;
  onClose: () => void;
  onRefresh?: () => void;
  onToast: (msg: string, type: "success" | "error" | "info") => void;
  lastSynced?: Date | null;
  currentUser?: UserProfile;
  onNavSelect?: (m: NavModule) => void;
  onSignOut?: () => void;
}

export default function FullPageModule({ module, records, onSelectRecord, onClose, onRefresh, onToast, lastSynced, currentUser, onNavSelect, onSignOut }: FullPageModuleProps) {
  const activeUser: UserProfile = currentUser || {
    id: "usr-master-1",
    email: "ict.admin@transport.gov.zw",
    full_name: "Eng. T. Masango (Master Admin)",
    role: "master_admin",
    is_active: true
  };

  return (
    <div style={{ position: "absolute", inset: 0, background: "var(--bg-app)", display: "flex", flexDirection: "column", zIndex: 1000 }}>
      {/* Module header bar */}
      <div style={{ background: "#fff", borderBottom: "2px solid var(--gold)", padding: "10px 20px", display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0, boxShadow: "var(--shadow-sm)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ width: 4, height: 22, background: "var(--green)", borderRadius: 2 }} />
          <div style={{ width: 32, height: 32, background: "var(--bg-active)", borderRadius: 8, display: "flex", alignItems: "center", justifyContent: "center", color: "var(--green)" }}>
            {MODULE_ICONS[module]}
          </div>
          <div>
            <div style={{ fontFamily: "var(--font-title)", fontSize: 15, fontWeight: 800, color: "var(--text-primary)", display: "flex", alignItems: "center", gap: 8 }}>
              {MODULE_TITLES[module] ?? module}
              {module !== "settings" && module !== "users" && module !== "approvals" && (
                <span style={{ background: "var(--bg-active)", color: "var(--green)", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, border: "1px solid var(--border)" }}>
                  {module === "survey" || module === "database" || module === "gallery"
                    ? "Live server pages"
                    : `${records.length.toLocaleString()} records`}
                </span>
              )}
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
              Roads Department · Zimbabwe
              {lastSynced && module !== "settings" && module !== "users" && module !== "approvals" && (
                <span> · Last synced: {lastSynced.toLocaleTimeString()}</span>
              )}
            </div>
          </div>
        </div>
        <button onClick={() => {
          if ((module === "users" || module === "approvals") && onNavSelect) {
            onNavSelect("settings");
            return;
          }
          onClose();
        }} style={{ background: "var(--bg-app)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", transition: "all 0.15s" }}
          onMouseOver={e => (e.currentTarget.style.borderColor = "var(--green)")}
          onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}>
          {module === "users" || module === "approvals" ? "← Settings" : "🗺 Back to Map"}
          <X size={13} />
        </button>
      </div>

      {/* Module content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {module === "dashboard" && <DashboardPage records={records} onSelectRecord={onSelectRecord} lastSynced={lastSynced} />}
        {module === "highways"  && <HighwaysPage  records={records} onSelectRecord={onSelectRecord} />}
        {module === "analytics" && <AnalyticsPage records={records} />}
        {module === "survey"    && <DatabasePage  records={records} onSelectRecord={onSelectRecord} onRefresh={onRefresh} onToast={onToast} />}
        {module === "database"  && <DatabasePage  records={records} onSelectRecord={onSelectRecord} onRefresh={onRefresh} onToast={onToast} />}
        {module === "gallery"   && <GalleryPage   records={records} onSelectRecord={onSelectRecord} />}
        {module === "reports"   && <ReportsPage   records={records} onSelectRecord={onSelectRecord} currentUser={activeUser} />}
        {module === "documents" && <DocumentsPage />}
        {module === "export"    && <ExportPage    records={records} onSelectRecord={onSelectRecord} />}
        {module === "users"     && <UserManagementPanel currentUser={activeUser} onToast={onToast} />}
        {module === "approvals" && <DeletionApprovalsPanel currentUser={activeUser} onToast={onToast} onRefreshRecords={onRefresh} />}
        {module === "settings"  && (
          <SettingsPage
            currentUser={currentUser ?? activeUser}
            onNavSelect={onNavSelect}
            onSignOut={onSignOut}
            onToast={onToast}
          />
        )}
      </div>
    </div>
  );
}



/* Reports page lives in ./ReportsPage.tsx */

/* ═══════════════════════════════════════════════════════════════════════════
   DOCUMENTS PAGE (MANUALS, GUIDELINES & TECHNICAL DOCUMENTATION LIBRARY)
 ════════════════════════════════════════════════════════════════════════════ */
interface DocItem {
  id: string;
  title: string;
  filename: string;
  format: "PDF" | "XLS" | "DOCX" | "PPTX";
  category: "User Manuals" | "Training Guidelines" | "Contracts & Proposals" | "Equipment Specs" | "Technical Specifications";
  size: string;
  date: string;
  description: string;
}

interface VideoItem {
  id: string;
  title: string;
  description: string;
  src: string;
  duration: string;
  thumbnail?: string;
  chapters: { time: string; label: string }[];
}

const VIDEO_TUTORIALS: VideoItem[] = [
  {
    id: "vid-1",
    title: "Complete Dashboard Walkthrough",
    description: "A full end-to-end tour of the Zimbabwe Roads Condition Dashboard — covering the interactive map, asset browsing, analytics, reporting, and the document library.",
    src: "/videos/dashboard-walkthrough.webp",
    duration: "~5 min",
    chapters: [
      { time: "0:00", label: "Introduction & Overview" },
      { time: "0:30", label: "Assets & Interactive Map" },
      { time: "1:15", label: "Highways Module" },
      { time: "2:00", label: "Analytics & Charts" },
      { time: "2:45", label: "Survey & Database" },
      { time: "3:30", label: "Reports & Export" },
      { time: "4:15", label: "Documents Library" },
    ]
  }
];

const DOCUMENT_REPOSITORY: DocItem[] = [
  {
    id: "doc-1",
    title: "Operational Manual - Visual Road Condition & Inventory F1",
    filename: "Operational_Manual_Visual_Road_Condition_Inventory_F1.pdf",
    format: "PDF",
    category: "User Manuals",
    size: "865 KB",
    date: "2026-09-30",
    description: "Official operational field manual for visual road condition assessment, defect scoring guidelines, and asset inventory recording."
  },
  {
    id: "doc-2",
    title: "Data Dictionary for ZimRoads v11",
    filename: "Data_Dictionary_for_ZimRoads_v11.xls",
    format: "XLS",
    category: "Technical Specifications",
    size: "124 KB",
    date: "2026-09-30",
    description: "Official data dictionary specification defining attribute schemas, asset field parameters, condition codes, and database validation structures for ZimRoads."
  }
];

function DocumentsPage() {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [formatFilter, setFormatFilter] = useState("all");
  const [previewDoc, setPreviewDoc] = useState<DocItem | null>(null);
  const [activeVideo, setActiveVideo] = useState<VideoItem>(VIDEO_TUTORIALS[0]);
  const [videoTab, setVideoTab] = useState<"tutorials" | "docs">("tutorials");

  const filtered = DOCUMENT_REPOSITORY.filter(d => {
    if (catFilter !== "all" && d.category !== catFilter) return false;
    if (formatFilter !== "all" && d.format !== formatFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      if (!d.title.toLowerCase().includes(q) && !d.description.toLowerCase().includes(q) && !d.filename.toLowerCase().includes(q)) return false;
    }
    return true;
  });

  const getFormatBadgeStyle = (fmt: string) => {
    if (fmt === "PDF") return { bg: "rgba(220,38,38,0.1)", color: "#dc2626", border: "1px solid rgba(220,38,38,0.2)" };
    if (fmt === "DOCX") return { bg: "rgba(37,99,235,0.1)", color: "#2563eb", border: "1px solid rgba(37,99,235,0.2)" };
    if (fmt === "PPTX") return { bg: "rgba(217,119,6,0.1)", color: "#d97706", border: "1px solid rgba(217,119,6,0.2)" };
    return { bg: "rgba(0,0,0,0.06)", color: "var(--text-secondary)", border: "1px solid var(--border)" };
  };

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-app)", overflow: "hidden" }}>
      
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #003d1f 0%, #006633 100%)", padding: "18px 24px", flexShrink: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 18, fontWeight: 900, color: "#fff", margin: 0, display: "flex", alignItems: "center", gap: 10, letterSpacing: "-0.3px" }}>
              <span style={{ fontSize: 22 }}>📚</span> Ministry Documentation Hub
            </h2>
            <p style={{ fontSize: 11, color: "rgba(255,255,255,0.65)", margin: "3px 0 0 0" }}>
              Tutorial videos, operational manuals, training guidelines and technical documentation
            </p>
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#FFD100" }}>{VIDEO_TUTORIALS.length}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Video Tutorials</div>
            </div>
            <div style={{ background: "rgba(255,255,255,0.12)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: 10, padding: "8px 16px", textAlign: "center" }}>
              <div style={{ fontSize: 16, fontWeight: 900, color: "#FFD100" }}>{DOCUMENT_REPOSITORY.length}</div>
              <div style={{ fontSize: 9, fontWeight: 700, color: "rgba(255,255,255,0.65)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Documents</div>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div style={{ display: "flex", gap: 4, marginTop: 16 }}>
          <button
            onClick={() => setVideoTab("tutorials")}
            style={{
              padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: videoTab === "tutorials" ? "#fff" : "rgba(255,255,255,0.12)",
              color: videoTab === "tutorials" ? "#006633" : "rgba(255,255,255,0.8)",
              transition: "all 0.2s"
            }}
          >
            🎬 Tutorial Videos
          </button>
          <button
            onClick={() => setVideoTab("docs")}
            style={{
              padding: "7px 18px", borderRadius: 8, border: "none", cursor: "pointer", fontSize: 12, fontWeight: 700,
              background: videoTab === "docs" ? "#fff" : "rgba(255,255,255,0.12)",
              color: videoTab === "docs" ? "#006633" : "rgba(255,255,255,0.8)",
              transition: "all 0.2s"
            }}
          >
            📄 Document Library
          </button>
        </div>
      </div>



      {/* Tab Content */}
      <div style={{ flex: 1, overflowY: "auto" }}>

        {/* ═══════════ TUTORIAL VIDEOS TAB ═══════════ */}
        {videoTab === "tutorials" && (
          <div style={{ padding: 24 }}>

            {/* Section intro */}
            <div style={{ marginBottom: 20 }}>
              <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 4px 0" }}>🎬 System Tutorial Videos</h3>
              <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: 0 }}>Watch step-by-step walkthroughs of the Roads Condition Dashboard to get up to speed quickly.</p>
            </div>

            {/* Video layout: player left, chapters right */}
            <div style={{ display: "grid", gridTemplateColumns: "1fr 300px", gap: 20, marginBottom: 28 }}>

              {/* Main Video / Animated Player */}
              <div style={{ background: "#0c140e", borderRadius: 14, overflow: "hidden", boxShadow: "0 12px 40px rgba(0,0,0,0.3)", display: "flex", flexDirection: "column" }}>
                {activeVideo.src.endsWith(".webp") || activeVideo.src.endsWith(".gif") ? (
                  <div style={{ position: "relative" }}>
                    <div style={{ minHeight: 360, display: "flex", alignItems: "center", justifyContent: "center", background: "#000" }}>
                      <img
                        key={activeVideo.src}
                        src={activeVideo.src}
                        alt={activeVideo.title}
                        style={{ width: "100%", height: "auto", display: "block", maxHeight: 520, objectFit: "contain" }}
                      />
                    </div>
                    {/* Control Bar Overlay */}
                    <div style={{
                      background: "rgba(0,0,0,0.9)", backdropFilter: "blur(6px)", padding: "10px 18px",
                      display: "flex", alignItems: "center", justifyContent: "space-between", color: "#fff"
                    }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{
                          background: "#006633", color: "#FFD100", padding: "4px 12px", borderRadius: 6,
                          fontSize: 11, fontWeight: 800, letterSpacing: "0.5px", display: "flex", alignItems: "center", gap: 6
                        }}>
                          <span>▶</span> WALKTHROUGH PLAYING
                        </span>
                        <button
                          onClick={(e) => {
                            const img = e.currentTarget.parentElement?.parentElement?.previousElementSibling?.querySelector("img");
                            if (img) {
                              const currentSrc = img.src.split("?")[0];
                              img.src = `${currentSrc}?t=${Date.now()}`;
                            }
                          }}
                          style={{
                            background: "rgba(255,255,255,0.15)", color: "#fff", border: "1px solid rgba(255,255,255,0.25)",
                            borderRadius: 6, padding: "4px 10px", fontSize: 11, fontWeight: 700, cursor: "pointer"
                          }}
                        >
                          🔄 Restart Video
                        </button>
                      </div>
                      <div style={{ fontSize: 11, color: "rgba(255,255,255,0.75)", fontWeight: 600 }}>
                        ⏱ Duration: {activeVideo.duration} · High Quality Telemetry Recording
                      </div>
                    </div>
                  </div>
                ) : (
                  <video
                    key={activeVideo.src}
                    src={activeVideo.src}
                    controls
                    autoPlay={false}
                    style={{ width: "100%", display: "block", borderRadius: 14 }}
                  >
                    Your browser does not support HTML5 video.
                  </video>
                )}
              </div>

              {/* Right: video info + chapters */}
              <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

                {/* Video info card */}
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", padding: 16 }}>
                  <span style={{ background: "rgba(0,102,51,0.1)", color: "#006633", fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, textTransform: "uppercase" }}>Tutorial</span>
                  <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", margin: "8px 0 6px 0", lineHeight: 1.3 }}>{activeVideo.title}</h3>
                  <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.5, margin: "0 0 10px 0" }}>{activeVideo.description}</p>
                  <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                    <span style={{ background: "var(--bg-app)", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", padding: "3px 8px", borderRadius: 6 }}>⏱ {activeVideo.duration}</span>
                    <span style={{ background: "var(--bg-app)", fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", padding: "3px 8px", borderRadius: 6 }}>📑 {activeVideo.chapters.length} chapters</span>
                  </div>
                </div>

                {/* Chapters list */}
                <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", padding: 14, flex: 1 }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.6px", marginBottom: 10 }}>📋 Chapters</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                    {activeVideo.chapters.map((ch, i) => (
                      <div
                        key={i}
                        style={{
                          display: "flex", alignItems: "center", gap: 10, padding: "7px 10px", borderRadius: 8,
                          background: "var(--bg-app)", fontSize: 11, color: "var(--text-primary)", fontWeight: 600,
                          cursor: "default"
                        }}
                      >
                        <span style={{ fontSize: 10, fontWeight: 800, color: "#006633", minWidth: 30 }}>{ch.time}</span>
                        <span style={{ flex: 1 }}>{ch.label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>

            {/* Video selector thumbnails (for multiple videos) */}
            {VIDEO_TUTORIALS.length > 1 && (
              <div>
                <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>More Tutorial Videos</div>
                <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
                  {VIDEO_TUTORIALS.map(v => (
                    <div
                      key={v.id}
                      onClick={() => setActiveVideo(v)}
                      style={{
                        background: activeVideo.id === v.id ? "#006633" : "#fff",
                        color: activeVideo.id === v.id ? "#fff" : "var(--text-primary)",
                        border: activeVideo.id === v.id ? "2px solid #006633" : "1px solid var(--border)",
                        borderRadius: 10, padding: "10px 16px", cursor: "pointer", maxWidth: 220,
                        fontSize: 11, fontWeight: 700, transition: "all 0.2s"
                      }}
                    >
                      <div style={{ fontSize: 20, marginBottom: 6 }}>🎬</div>
                      <div>{v.title}</div>
                      <div style={{ fontSize: 10, opacity: 0.7, marginTop: 3 }}>⏱ {v.duration}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════ DOCUMENTS TAB ═══════════ */}
        {videoTab === "docs" && (
          <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
            {/* Filter Controls */}
            <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "12px 24px", flexShrink: 0, display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
              <div style={{ position: "relative", flex: "1 1 240px", minWidth: 220 }}>
                <input
                  type="text"
                  placeholder="Search by title, keyword, description..."
                  value={search}
                  onChange={e => setSearch(e.target.value)}
                  style={{ width: "100%", padding: "7px 12px 7px 32px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "var(--bg-app)", outline: "none", boxSizing: "border-box" }}
                />
                <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.5 }}>🔍</span>
                {search && <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>✕</button>}
              </div>
              <select value={catFilter} onChange={e => setCatFilter(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "#fff", fontWeight: 600, color: "var(--text-primary)", outline: "none" }}>
                <option value="all">All Categories</option>
                <option value="User Manuals">📖 User Manuals</option>
                <option value="Training Guidelines">🎓 Training Guidelines</option>
                <option value="Contracts & Proposals">📝 Contracts &amp; Proposals</option>
                <option value="Equipment Specs">🔬 Equipment Specs</option>
                <option value="Technical Specifications">⚙️ Technical Specifications</option>
              </select>
              <select value={formatFilter} onChange={e => setFormatFilter(e.target.value)} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "#fff", fontWeight: 600, color: "var(--text-primary)", outline: "none" }}>
                <option value="all">All Formats</option>
                <option value="DOCX">📄 DOCX</option>
                <option value="PDF">📕 PDF</option>
                <option value="PPTX">📊 PPTX</option>
              </select>
              {(catFilter !== "all" || formatFilter !== "all" || search) && (
                <button onClick={() => { setCatFilter("all"); setFormatFilter("all"); setSearch(""); }} style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 700, color: "#dc2626", cursor: "pointer" }}>Reset</button>
              )}
            </div>

            {/* Document Grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <BookOpen size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>No documents found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your search terms or filters above</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 18 }}>
            {filtered.map(d => {
              const fmtStyle = getFormatBadgeStyle(d.format);
              return (
                <div
                  key={d.id}
                  style={{
                    background: "#fff",
                    borderRadius: 12,
                    border: "1px solid var(--border)",
                    padding: 18,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "space-between",
                    boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
                    transition: "transform 0.2s, box-shadow 0.2s"
                  }}
                  onMouseOver={e => {
                    e.currentTarget.style.transform = "translateY(-3px)";
                    e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.08)";
                  }}
                  onMouseOut={e => {
                    e.currentTarget.style.transform = "translateY(0)";
                    e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
                  }}
                >
                  <div>
                    {/* Format Badge & Category Header */}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                      <span style={{ background: fmtStyle.bg, color: fmtStyle.color, border: fmtStyle.border, fontSize: 10, fontWeight: 800, padding: "2px 8px", borderRadius: 6, letterSpacing: "0.5px" }}>
                        {d.format}
                      </span>
                      <span style={{ background: "rgba(0,0,0,0.04)", color: "var(--text-secondary)", fontSize: 9.5, fontWeight: 700, padding: "2px 8px", borderRadius: 12 }}>
                        {d.category}
                      </span>
                    </div>

                    {/* Title */}
                    <h3 style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)", margin: "0 0 8px 0", lineHeight: 1.35 }}>
                      {d.title}
                    </h3>

                    {/* Description */}
                    <p style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.45, margin: "0 0 14px 0" }}>
                      {d.description}
                    </p>
                  </div>

                  <div>
                    {/* Metadata Line */}
                    <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10, color: "var(--text-muted)", background: "var(--bg-app)", padding: "6px 10px", borderRadius: 6, marginBottom: 12 }}>
                      <span><strong>Size:</strong> {d.size}</span>
                      <span><strong>Date:</strong> {d.date}</span>
                    </div>

                    {/* Actions */}
                    <div style={{ display: "flex", gap: 8 }}>
                      <a
                        href={`/documents/${d.filename}`}
                        download={d.filename}
                        style={{
                          flex: 1,
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "none",
                          background: "#006633",
                          color: "#fff",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: 6,
                          textDecoration: "none"
                        }}
                      >
                        <span>📥</span> Download File
                      </a>
                      <button
                        onClick={() => setPreviewDoc(d)}
                        style={{
                          padding: "8px 12px",
                          borderRadius: 8,
                          border: "1px solid var(--border)",
                          background: "#fff",
                          color: "var(--text-primary)",
                          fontSize: 11,
                          fontWeight: 700,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          gap: 4
                        }}
                      >
                        <span>👁️</span> Details
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
            </div>
          </div>
        )}
      </div>

      {/* Document Details Modal */}
      {previewDoc && (
        <div
          onClick={() => setPreviewDoc(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.6)",
            backdropFilter: "blur(4px)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 24
          }}
        >
          <div
            onClick={e => e.stopPropagation()}
            style={{
              background: "#fff",
              borderRadius: 14,
              maxWidth: 550,
              width: "100%",
              padding: 24,
              boxShadow: "0 20px 50px rgba(0,0,0,0.3)"
            }}
          >
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 16 }}>
              <div>
                <span style={{ background: "rgba(0,102,51,0.1)", color: "#006633", fontSize: 10, fontWeight: 800, padding: "3px 8px", borderRadius: 6, textTransform: "uppercase" }}>
                  {previewDoc.category}
                </span>
                <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: "8px 0 0 0" }}>
                  {previewDoc.title}
                </h2>
              </div>
              <button
                onClick={() => setPreviewDoc(null)}
                style={{ border: "none", background: "rgba(0,0,0,0.05)", borderRadius: "50%", width: 30, height: 30, cursor: "pointer", fontSize: 14, color: "var(--text-secondary)" }}
              >
                ✕
              </button>
            </div>

            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 18 }}>
              {previewDoc.description}
            </p>

            <div style={{ background: "var(--bg-app)", padding: 12, borderRadius: 8, fontSize: 11, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, marginBottom: 20 }}>
              <div><strong>Filename:</strong> {previewDoc.filename}</div>
              <div><strong>Format:</strong> {previewDoc.format}</div>
              <div><strong>File Size:</strong> {previewDoc.size}</div>
              <div><strong>Date Uploaded:</strong> {previewDoc.date}</div>
            </div>

            <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
              <button
                onClick={() => setPreviewDoc(null)}
                style={{ padding: "8px 16px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer" }}
              >
                Close
              </button>
              <a
                href={`/documents/${previewDoc.filename}`}
                download={previewDoc.filename}
                style={{ padding: "8px 18px", borderRadius: 8, border: "none", background: "#006633", color: "#fff", fontSize: 11.5, fontWeight: 700, cursor: "pointer", textDecoration: "none", display: "inline-flex", alignItems: "center", gap: 6 }}
              >
                <span>📥</span> Download Document
              </a>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}

