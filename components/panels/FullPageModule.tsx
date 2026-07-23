"use client";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

import { useState, useEffect, useCallback } from "react";
import { LayoutDashboard, TrendingUp, BarChart2, ClipboardCheck, Database, Download, ArrowUpDown, Search, X, ChevronDown, ChevronUp, Camera, FileText, Trash2, Compass } from "lucide-react";

import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend, Tooltip as ChartTooltip,
  BarChart, Bar, XAxis, YAxis, LineChart, Line, CartesianGrid, AreaChart, Area,
} from "recharts";
import {
  getRecordStatus, getAssetType, getAssetName, formatStatusLabel, getStatusColor, normalizePhotos, getSadcValue,
  AUTHORITY_OPTIONS, CONDITION_WITH_CONSTRUCTION_OPTIONS,
  formatGpsLabel,
} from "@/components/helpers";
import type { NavModule } from "./LeftNav";

/* ─── helpers ─────────────────────────────────────────────────────────────── */
const HIGHWAYS = [
  { id: "A1", name: "Harare – Chirundu",       color: "#006633", km: "335 km" },
  { id: "A2", name: "Harare – Mutare",         color: "#007a3d", km: "263 km" },
  { id: "A3", name: "Harare – Bulawayo",       color: "#004d26", km: "439 km" },
  { id: "A4", name: "Bulawayo – Beitbridge",   color: "#FFD100", km: "323 km" },
  { id: "A5", name: "Bulawayo – Plumtree",     color: "#e0b800", km: "102 km" },
];

function hwRecords(records: any[], id: string) {
  return records.filter(r => (r.road_name ?? "").includes(id));
}

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

const getGeometry = (record: any): any => {
  if (!record) return null;
  const geojsonStr = record.road_segment_geojson || record.segment_geojson || record.raw_data?.road_segment_geojson || record.raw_data?.segment_geojson;
  if (geojsonStr) {
    try {
      const geojson = typeof geojsonStr === "string" ? JSON.parse(geojsonStr) : geojsonStr;
      if (geojson) {
        if (geojson.type === "Feature" && geojson.geometry) {
          return geojson.geometry;
        }
        if (geojson.type === "LineString" && Array.isArray(geojson.coordinates)) {
          return geojson;
        }
      }
    } catch (e) {
      console.error("Error parsing geometry:", e);
    }
  }

  // Fallback: Check for trace coordinate strings
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
              return {
                type: "LineString",
                coordinates: points.map(p => [p[1], p[0]]) // Swap [lat, lng] to [lng, lat] for GeoJSON standard
              };
            }
          } catch (e) {
            console.error(`Error parsing trace string in key ${key}:`, e);
          }
        }
      }
    }
  }

  if (
    Array.isArray(record._geolocation) &&
    record._geolocation.length >= 2 &&
    typeof record._geolocation[0] === "number" &&
    typeof record._geolocation[1] === "number"
  ) {
    return {
      type: "Point",
      coordinates: [record._geolocation[1], record._geolocation[0]]
    };
  }
  return null;
};

const ASSET_TYPES = [
  { key: "sealed_road",      label: "Sealed Road",      check: (r: any) => getAssetType(r) === "Sealed Road" || getAssetType(r) === "Concrete Road" },
  { key: "gravel_road",     label: "Gravel Road",     check: (r: any) => getAssetType(r) === "Gravel Road" },
  { key: "earth_road",      label: "Earth Road",      check: (r: any) => getAssetType(r) === "Earth Road" },
  { key: "bridge",          label: "Bridge",          check: (r: any) => getAssetType(r) === "Bridge" },
  { key: "foot_bridge",     label: "Foot Bridge",     check: (r: any) => getAssetType(r) === "Foot Bridge" },
  { key: "rail_crossing",   label: "Rail Crossing",   check: (r: any) => getAssetType(r) === "Rail Crossing" },
  { key: "tollgate",        label: "Tollgate",        check: (r: any) => getAssetType(r) === "Tollgate" },
  { key: "lay_by",          label: "Lay By",          check: (r: any) => getAssetType(r) === "Lay By" },
  { key: "bus_stop",        label: "Bus Stop",        check: (r: any) => getAssetType(r) === "Bus Stop" },
  { key: "junction",        label: "Junction",        check: (r: any) => getAssetType(r) === "Junction" },
  { key: "road_sign",       label: "Road Sign",       check: (r: any) => getAssetType(r) === "Road Sign" },
  { key: "shelvet",         label: "Shelvert",        check: (r: any) => getAssetType(r) === "Shelvert" || getAssetType(r) === "Shelvert" },
  { key: "culvert",         label: "Culvert",         check: (r: any) => getAssetType(r) === "Culvert" },
  { key: "piped_causeway",  label: "Piped Causeway",  check: (r: any) => getAssetType(r) === "Piped Causeway" },
  { key: "drift",           label: "Drift",           check: (r: any) => getAssetType(r) === "Drift" },
  { key: "grid",            label: "Grid",            check: (r: any) => getAssetType(r) === "Grid" },
  { key: "traffic_lights",  label: "Traffic Lights",  check: (r: any) => getAssetType(r) === "Traffic Lights" },
  { key: "streetlight",     label: "Streetlight",     check: (r: any) => getAssetType(r) === "Streetlight" || getAssetType(r) === "Street Light" }
];

const COND_COLORS: Record<string, string> = {
  good: "#006633",
  fair: "#f59e0b",
  poor: "#dc2626",
  mixed: "#7c3aed",
  under_construction: "#2563eb",
};

export const ZIM_PROVINCES_DISTRICTS: Record<string, string[]> = {
  "Harare": ["Harare", "Chitungwiza", "Epworth"],
  "Bulawayo": ["Bulawayo"],
  "Manicaland": ["Mutare", "Chimanimani", "Chipinge", "Makoni", "Mutasa", "Nyanga", "Buhera"],
  "Mashonaland Central": ["Bindura", "Centenary", "Guruve", "Mt Darwin", "Mazowe", "Mukumbura", "Mbire", "Rushinga"],
  "Mashonaland East": ["Marondera", "Goromonzi", "Murewa", "Mutoko", "Mudzi", "Sekes", "Chikomba", "Wedza", "UMP", "Makoni"],
  "Mashonaland West": ["Chinhoyi", "Kadoma", "Chegutu", "Kariba", "Makonde", "Hurungwe", "Zvimba", "Sanyati"],
  "Masvingo": ["Masvingo", "Chiredzi", "Chivi", "Gutu", "Mwenezi", "Bikita", "Zaka"],
  "Matabeleland North": ["Lupane", "Binga", "Bubi", "Hwange", "Nkayi", "Tsholotsho", "Umguza"],
  "Matabeleland South": ["Gwanda", "Beitbridge", "Bulilima", "Mangwe", "Insiza", "Matobo", "Umzingwane"],
  "Midlands": ["Gweru", "Kwekwe", "Gokwe North", "Gokwe South", "Mberengwa", "Shurugwi", "Zvishavane", "Chirumhanzu"]
};

/* ─── sub-components ──────────────────────────────────────────────────────── */
function KpiTile({ num, label, color = "var(--green)", sub }: { num: string|number; label: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "18px 20px", flex: 1, minWidth: 120, boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 2 }}>
      <div style={{ fontFamily: "var(--font-title)", fontSize: 32, fontWeight: 800, color, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--green)", borderBottom: "2px solid var(--gold)", paddingBottom: 5, marginBottom: 14 }}>
      {children}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   DASHBOARD
════════════════════════════════════════════════════════════════════════════ */
function DashboardPage({ records, lastSynced }: { records: any[]; lastSynced?: Date | null }) {
  const total  = records.length;
  const good   = records.filter(r => getRecordStatus(r) === "good").length;
  const fair   = records.filter(r => getRecordStatus(r) === "fair").length;
  const poor   = records.filter(r => getRecordStatus(r) === "poor").length;
  const mixed  = records.filter(r => getRecordStatus(r) === "mixed").length;
  const underConstruction = records.filter(r => getRecordStatus(r) === "under_construction").length;
  const surveyors = new Set(records.map(r => r.surveyor_name).filter(Boolean)).size;
  const dates  = records.map(r => r.survey_date).filter(Boolean).sort();
  const dateRange = dates.length ? `${dates[0]} → ${dates[dates.length - 1]}` : "N/A";

  const condData = [
    { name: "Good", value: good, color: "#006633" },
    { name: "Fair", value: fair, color: "#f59e0b" },
    { name: "Poor", value: poor, color: "#dc2626" },
    { name: "Mixed", value: mixed, color: "#7c3aed" },
    { name: "Under construction", value: underConstruction, color: "#2563eb" },
  ].filter(d => d.value > 0);

  const typeData = ASSET_TYPES.map(t => ({ name: t.label, count: records.filter(t.check).length })).filter(d => d.count > 0);

  const hwData = HIGHWAYS.map(h => {
    const hw = hwRecords(records, h.id);
    return {
      name: h.id,
      total: hw.length,
      good: hw.filter(r => getRecordStatus(r) === "good").length,
      fair: hw.filter(r => getRecordStatus(r) === "fair").length,
      poor: hw.filter(r => getRecordStatus(r) === "poor").length,
      mixed: hw.filter(r => getRecordStatus(r) === "mixed").length,
      under_construction: hw.filter(r => getRecordStatus(r) === "under_construction").length,
    };
  }).filter(d => d.total > 0);

  const surveyorData = Array.from(
    records.reduce((map, r) => { const s = r.surveyor_name ?? "Unknown"; map.set(s, (map.get(s) ?? 0) + 1); return map; }, new Map<string, number>())
  ).map(([name, count]) => ({ name, count })).sort((a, b) => (b as any).count - (a as any).count).slice(0, 8);

  const worstAssets = records.filter(r => getRecordStatus(r) === "poor").slice(0, 8);

  return (
    <div style={{ padding: "20px 24px", overflowY: "auto", height: "100%", background: "var(--bg-app)", display: "flex", flexDirection: "column", gap: 20 }}>
      {/* KPI row */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderBottom: "2px solid var(--gold)", paddingBottom: 5, marginBottom: 14 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--green)" }}>
            Network Overview — {dateRange}
          </div>
          {lastSynced && (
            <span style={{ fontSize: 10.5, color: "var(--text-muted)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px" }}>
              🕒 Last Updated: {lastSynced.toLocaleTimeString()}
            </span>
          )}
        </div>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <KpiTile num={total}   label="Total Assets" sub="All highways" />
          <KpiTile num={good}    label="Good Condition" color="#006633" sub={`${total ? Math.round(good/total*100) : 0}% of network`} />
          <KpiTile num={fair}    label="Fair Condition" color="#d97706" sub={`${total ? Math.round(fair/total*100) : 0}% of network`} />
          <KpiTile num={poor}    label="Poor Condition" color="#dc2626" sub={`${total ? Math.round(poor/total*100) : 0}% — needs attention`} />
          <KpiTile num={surveyors} label="Surveyors" color="#1d6fa4" sub="Active field officers" />
        </div>
      </div>

      {/* Charts row 1 */}
      <div className="dashboard-row-3col">
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <SectionTitle>Condition Distribution</SectionTitle>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={condData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80} innerRadius={35} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                  {condData.map((e, i) => <Cell key={i} fill={e.color} />)}
                </Pie>
                <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                <ChartTooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <SectionTitle>Asset Type Breakdown</SectionTitle>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={typeData} layout="vertical" margin={{ left: 8, right: 20, top: 5, bottom: 0 }}>
                <XAxis type="number" fontSize={9} tick={{ fill: "#6b8072" }} tickLine={false} />
                <YAxis type="category" dataKey="name" fontSize={9} tick={{ fill: "#3d5a48" }} width={70} tickLine={false} />
                <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Bar dataKey="count" radius={[0, 4, 4, 0]} barSize={12} fill="#006633" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <SectionTitle>Surveyors Activity</SectionTitle>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={surveyorData} layout="vertical" margin={{ left: 8, right: 20, top: 5, bottom: 0 }}>
                <XAxis type="number" fontSize={9} tick={{ fill: "#6b8072" }} tickLine={false} />
                <YAxis type="category" dataKey="name" fontSize={9} tick={{ fill: "#3d5a48" }} width={90} tickLine={false} />
                <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Bar dataKey="count" name="Records" radius={[0, 4, 4, 0]} barSize={12} fill="#FFD100" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* Highway stacked bars + worst assets */}
      <div className="dashboard-row-2col">
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <SectionTitle>Highway Condition Breakdown</SectionTitle>
          <div style={{ height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hwData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.08)" />
                <XAxis dataKey="name" fontSize={11} tick={{ fill: "#3d5a48" }} tickLine={false} />
                <YAxis fontSize={9} tick={{ fill: "#6b8072" }} tickLine={false} />
                <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="good" name="Good" stackId="a" fill="#006633" />
                <Bar dataKey="fair" name="Fair" stackId="a" fill="#f59e0b" />
                <Bar dataKey="poor" name="Poor" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <SectionTitle>⚠ Poor Condition Assets</SectionTitle>
          <div style={{ overflowY: "auto", maxHeight: 220, display: "flex", flexDirection: "column", gap: 6 }}>
            {worstAssets.length === 0 ? (
              <div style={{ color: "var(--text-muted)", fontSize: 12, textAlign: "center", paddingTop: 20 }}>No poor condition assets 🎉</div>
            ) : worstAssets.map((r, i) => (
              <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", background: "rgba(220,38,38,0.04)", borderRadius: 6, border: "1px solid rgba(220,38,38,0.1)", fontSize: 11.5 }}>
                <div>
                  <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{getAssetName(r)}</div>
                  <div style={{ fontSize: 10, color: "var(--text-muted)" }}>{(r.road_name ?? "—").split(" (")[0]} · {r.section_name ?? "—"}</div>
                </div>
                <span className="badge poor">Poor</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   HIGHWAYS
════════════════════════════════════════════════════════════════════════════ */
function HighwaysPage({ records }: { records: any[] }) {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div style={{ padding: "20px 24px", overflowY: "auto", height: "100%", background: "var(--bg-app)", display: "flex", flexDirection: "column", gap: 16 }}>
      <SectionTitle>A-Class Highway Network</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 16 }}>
        {HIGHWAYS.map(h => {
          const hw = hwRecords(records, h.id);
          const g = hw.filter(r => getRecordStatus(r) === "good").length;
          const f = hw.filter(r => getRecordStatus(r) === "fair").length;
          const p = hw.filter(r => getRecordStatus(r) === "poor").length;
          const total = hw.length;
          const gPct = total ? Math.round(g / total * 100) : 0;
          const types = ASSET_TYPES.map(t => ({ label: t.label, count: hw.filter(t.check).length })).filter(d => d.count > 0);

          return (
            <div key={h.id} style={{ background: "#fff", borderRadius: 12, border: `2px solid ${selected === h.id ? h.color : "var(--border)"}`, padding: 16, boxShadow: "var(--shadow-sm)", cursor: "pointer", transition: "all 0.18s" }}
              onClick={() => setSelected(selected === h.id ? null : h.id)}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 12 }}>
                <div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 3 }}>
                    <div style={{ background: h.color, color: "#fff", fontWeight: 800, fontSize: 14, padding: "4px 12px", borderRadius: 6, fontFamily: "var(--font-title)" }}>{h.id}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-primary)" }}>Highway {h.id}</div>
                  </div>
                  <div style={{ fontSize: 11, color: "var(--text-muted)" }}>{h.name}</div>
                </div>
                <div style={{ textAlign: "right" }}>
                  <div style={{ fontFamily: "var(--font-title)", fontSize: 22, fontWeight: 800, color: "var(--green)" }}>{total}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase" }}>assets</div>
                </div>
              </div>

              {/* Stacked condition bar */}
              <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex", marginBottom: 8 }}>
                <div style={{ flex: g, background: "#006633" }} />
                <div style={{ flex: f, background: "#f59e0b" }} />
                <div style={{ flex: p, background: "#dc2626" }} />
                {total === 0 && <div style={{ flex: 1, background: "#e2e8f0" }} />}
              </div>

              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5, marginBottom: 12 }}>
                <span style={{ color: "#006633", fontWeight: 700 }}>{g} Good ({gPct}%)</span>
                <span style={{ color: "#d97706", fontWeight: 700 }}>{f} Fair</span>
                <span style={{ color: "#dc2626", fontWeight: 700 }}>{p} Poor</span>
              </div>

              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <span style={{ background: "#f0f7f3", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: 9.5, color: "var(--text-muted)", fontWeight: 600 }}>{h.km}</span>
                {types.slice(0, 4).map(t => (
                  <span key={t.label} style={{ background: "#f0f7f3", border: "1px solid var(--border)", borderRadius: 4, padding: "2px 8px", fontSize: 9.5, color: "var(--text-secondary)", fontWeight: 600 }}>{t.label}: {t.count}</span>
                ))}
              </div>

              {selected === h.id && (
                <div style={{ marginTop: 12, borderTop: "1px solid var(--border)", paddingTop: 12 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", marginBottom: 8 }}>Asset Type Breakdown</div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
                    {types.map(t => (
                      <div key={t.label} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11.5 }}>
                        <span style={{ color: "var(--text-secondary)" }}>{t.label}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                          <div style={{ width: 80, height: 5, background: "var(--bg-app)", borderRadius: 3, overflow: "hidden" }}>
                            <div style={{ height: "100%", width: `${total ? t.count/total*100 : 0}%`, background: "var(--green)", borderRadius: 3 }} />
                          </div>
                          <span style={{ fontWeight: 700, color: "var(--green)", width: 24, textAlign: "right" }}>{t.count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   ANALYTICS
════════════════════════════════════════════════════════════════════════════ */
type ATab = "overview" | "condition" | "assets" | "compliance" | "surveyors";

function AnalyticsPage({ records }: { records: any[] }) {
  const [tab, setTab] = useState<ATab>("overview");
  const total  = records.length;
  const good   = records.filter(r => getRecordStatus(r) === "good").length;
  const fair   = records.filter(r => getRecordStatus(r) === "fair").length;
  const poor   = records.filter(r => getRecordStatus(r) === "poor").length;
  const mixed  = records.filter(r => getRecordStatus(r) === "mixed").length;
  const underConstruction = records.filter(r => getRecordStatus(r) === "under_construction").length;

  const condData = [
    { name: "Good", value: good, color: "#006633" },
    { name: "Fair", value: fair, color: "#f59e0b" },
    { name: "Poor", value: poor, color: "#dc2626" },
    { name: "Mixed", value: mixed, color: "#7c3aed" },
    { name: "Under construction", value: underConstruction, color: "#2563eb" },
  ].filter(d => d.value > 0);

  const typeData = ASSET_TYPES.map(t => ({ name: t.label, count: records.filter(t.check).length })).filter(d => d.count > 0);

  const hwData = HIGHWAYS.map(h => {
    const hw = hwRecords(records, h.id);
    return {
      name: h.id,
      good: hw.filter(r => getRecordStatus(r) === "good").length,
      fair: hw.filter(r => getRecordStatus(r) === "fair").length,
      poor: hw.filter(r => getRecordStatus(r) === "poor").length,
      mixed: hw.filter(r => getRecordStatus(r) === "mixed").length,
      under_construction: hw.filter(r => getRecordStatus(r) === "under_construction").length,
    };
  });

  const compliant    = records.filter(r => getSadcValue(r) === "yes").length;
  const nonCompliant = records.filter(r => getSadcValue(r) === "no").length;
  const sadcMixed    = records.filter(r => getSadcValue(r) === "mixed").length;
  const sadcData = [
    { name: "Compliant", count: compliant, fill: "#006633" },
    { name: "Non-Compliant", count: nonCompliant, fill: "#dc2626" },
    { name: "Mixed", count: sadcMixed, fill: "#7c3aed" },
  ].filter(d => d.count > 0);

  const surveyorData = Array.from(
    records.reduce((map, r) => { const s = r.surveyor_name ?? "Unknown"; map.set(s, (map.get(s) ?? 0) + 1); return map; }, new Map<string, number>())
  ).map(([name, count]) => ({ name, count })).sort((a, b) => (b as any).count - (a as any).count).slice(0, 10);

  const tabs: { id: ATab; label: string }[] = [
    { id: "overview", label: "Overview" },
    { id: "condition", label: "Condition Analysis" },
    { id: "assets", label: "Asset Types" },
    { id: "compliance", label: "SADC Compliance" },
    { id: "surveyors", label: "Surveyor Activity" },
  ];

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-app)" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 4, padding: "14px 24px 0", borderBottom: "1px solid var(--border)", background: "#fafcfb", flexShrink: 0 }}>
        {tabs.map(t => (
          <button key={t.id} onClick={() => setTab(t.id)} style={{ padding: "8px 16px", borderRadius: "6px 6px 0 0", border: "1px solid transparent", borderBottom: "none", background: tab === t.id ? "#fff" : "transparent", fontSize: 12, fontWeight: 600, color: tab === t.id ? "var(--green)" : "var(--text-muted)", cursor: "pointer", transition: "all 0.15s", fontFamily: "var(--font-body)", borderColor: tab === t.id ? "var(--border)" : "transparent", borderBottomColor: tab === t.id ? "#fff" : "transparent", marginBottom: tab === t.id ? -1 : 0 }}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
        {tab === "overview" && (
          <>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <KpiTile num={total}   label="Total Assets" />
              <KpiTile num={`${total ? Math.round(good/total*100):0}%`} label="Good Condition" color="#006633" />
              <KpiTile num={`${total ? Math.round(fair/total*100):0}%`} label="Fair Condition" color="#d97706" />
              <KpiTile num={`${total ? Math.round(poor/total*100):0}%`} label="Poor Condition" color="#dc2626" />
            </div>
            <div className="analytics-grid-2col">
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
                <SectionTitle>Condition Share</SectionTitle>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart><Pie data={condData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={45} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={11}>
                      {condData.map((e,i)=><Cell key={i} fill={e.color}/>)}</Pie><Legend iconSize={9} wrapperStyle={{ fontSize: 11 }}/><ChartTooltip/></PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
              <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
                <SectionTitle>Highway Stacked Condition</SectionTitle>
                <div style={{ height: 260 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={hwData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.06)" />
                      <XAxis dataKey="name" fontSize={11} tickLine={false} />
                      <YAxis fontSize={9} tickLine={false} />
                      <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                      <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                      <Bar dataKey="good" name="Good" stackId="a" fill="#006633" />
                      <Bar dataKey="fair" name="Fair" stackId="a" fill="#f59e0b" />
                      <Bar dataKey="poor" name="Poor" stackId="a" fill="#dc2626" radius={[4,4,0,0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>
          </>
        )}

        {tab === "condition" && (
          <>
            {[{ label: "Good Condition", val: good, color: "#006633" }, { label: "Fair Condition", val: fair, color: "#f59e0b" }, { label: "Poor Condition", val: poor, color: "#dc2626" }].map(row => (
              <div key={row.label} style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, fontSize: 13, color: row.color }}>{row.label}</span>
                  <span style={{ fontFamily: "var(--font-title)", fontSize: 22, fontWeight: 800, color: row.color }}>{row.val} <span style={{ fontSize: 12, fontWeight: 500, color: "var(--text-muted)" }}>({total ? Math.round(row.val/total*100) : 0}%)</span></span>
                </div>
                <div style={{ height: 8, background: "var(--bg-app)", borderRadius: 4, overflow: "hidden", border: "1px solid var(--border)" }}>
                  <div style={{ height: "100%", width: total ? `${row.val/total*100}%` : "0%", background: row.color, borderRadius: 4, transition: "width 0.6s ease" }} />
                </div>
              </div>
            ))}
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
              <SectionTitle>Per-Highway Condition</SectionTitle>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hwData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.06)" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} />
                    <YAxis fontSize={10} tickLine={false} />
                    <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Legend iconSize={9} wrapperStyle={{ fontSize: 11 }} />
                    <Bar dataKey="good" name="Good" stackId="a" fill="#006633" />
                    <Bar dataKey="fair" name="Fair" stackId="a" fill="#f59e0b" />
                    <Bar dataKey="poor" name="Poor" stackId="a" fill="#dc2626" radius={[4,4,0,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {tab === "assets" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <SectionTitle>Asset Type Distribution</SectionTitle>
            <div style={{ height: 360 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                  <XAxis type="number" fontSize={10} tick={{ fill: "#6b8072" }} tickLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={11} tick={{ fill: "#3d5a48" }} width={90} tickLine={false} />
                  <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  <Bar dataKey="count" name="Count" radius={[0,6,6,0]} barSize={18} fill="#006633" label={{ position: "right", fontSize: 11, fill: "#3d5a48", fontWeight: 700 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {tab === "compliance" && (
          <>
            <div style={{ display: "flex", gap: 12 }}>
              <KpiTile num={compliant}    label="SADC Compliant" color="#006633" sub={`${(compliant+nonCompliant) ? Math.round(compliant/(compliant+nonCompliant)*100) : 0}% of tagged signs`} />
              <KpiTile num={nonCompliant} label="Non-Compliant"  color="#dc2626" sub={`${(compliant+nonCompliant) ? Math.round(nonCompliant/(compliant+nonCompliant)*100) : 0}% of tagged signs`} />
            </div>
            <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
              <SectionTitle>SADC Sign Compliance</SectionTitle>
              <div style={{ height: 280 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={sadcData} margin={{ left: -10, right: 10, top: 5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.06)" />
                    <XAxis dataKey="name" fontSize={12} tickLine={false} />
                    <YAxis fontSize={10} tickLine={false} />
                    <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                    <Bar dataKey="count" radius={[6,6,0,0]} barSize={60}>{sadcData.map((e,i)=><Cell key={i} fill={e.fill}/>)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </>
        )}

        {tab === "surveyors" && (
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <SectionTitle>Surveyor Activity ({surveyorData.length} field officers)</SectionTitle>
            <div style={{ height: 340 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={surveyorData} layout="vertical" margin={{ left: 10, right: 40, top: 5, bottom: 5 }}>
                  <XAxis type="number" fontSize={10} tick={{ fill: "#6b8072" }} tickLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={10} tick={{ fill: "#3d5a48" }} width={110} tickLine={false} />
                  <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6 }} />
                  <Bar dataKey="count" name="Records" radius={[0,6,6,0]} barSize={16} fill="#FFD100" label={{ position: "right", fontSize: 10, fill: "#3d5a48", fontWeight: 700 }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   SURVEY RECORDS
════════════════════════════════════════════════════════════════════════════ */
function SurveyPage({ records, onSelectRecord }: { records: any[]; onSelectRecord: (r: any) => void }) {
  const [search, setSearch] = useState("");
  const [cond, setCond] = useState("all");
  const [road, setRoad] = useState("all");

  const roads = Array.from(new Set(records.map(r => r.road_name).filter(Boolean)));

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || getAssetName(r).toLowerCase().includes(q) || (r.road_name ?? "").toLowerCase().includes(q) || (r.surveyor_name ?? "").toLowerCase().includes(q);
    const matchC = cond === "all" || getRecordStatus(r) === cond;
    const matchR = road === "all" || r.road_name === road;
    return matchQ && matchC && matchR;
  });

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-app)" }}>
      {/* Filter bar */}
      <div style={{ padding: "14px 24px", borderBottom: "1px solid var(--border)", background: "#fafcfb", display: "flex", gap: 10, alignItems: "center", flexShrink: 0 }}>
        <div style={{ position: "relative", flex: 2 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input placeholder="Search asset, road, surveyor…" value={search} onChange={e => setSearch(e.target.value)}
            style={{ width: "100%", padding: "8px 10px 8px 30px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-primary)" }} />
        </div>
        <select value={cond} onChange={e => setCond(e.target.value)} style={{ padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)", background: "#fff" }}>
          <option value="all">All Conditions</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
          <option value="mixed">Mixed</option>
          <option value="under_construction">Under construction</option>
        </select>
        <select value={road} onChange={e => setRoad(e.target.value)} style={{ padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)", background: "#fff", flex: 1 }}>
          <option value="all">All Highways</option>
          {roads.map(r => <option key={r} value={r}>{(r ?? "").split(" (")[0]}</option>)}
        </select>
        <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>{filtered.length} records · click to open on map</span>
      </div>

      {/* Cards grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: "14px 24px" }}>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 12 }}>
          {filtered.map((r, i) => {
            const c = getRecordStatus(r);
            const gpsLabel = formatGpsLabel(r);
            return (
              <div key={r._id ?? i} onClick={() => onSelectRecord(r)} style={{ background: "#fff", borderRadius: 10, border: `1px solid ${c === "poor" ? "rgba(220,38,38,0.25)" : "var(--border)"}`, padding: "13px 15px", cursor: "pointer", transition: "all 0.15s", boxShadow: "var(--shadow-sm)" }}
                onMouseOver={e => (e.currentTarget.style.borderColor = "var(--green)")}
                onMouseOut={e => (e.currentTarget.style.borderColor = c === "poor" ? "rgba(220,38,38,0.25)" : "var(--border)")}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                  <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)" }}>{getAssetName(r)}</div>
                  <span className={`badge ${c}`}>{c}</span>
                </div>
                <div style={{ fontSize: 10.5, color: "var(--text-muted)", marginBottom: 8 }}>{(r.road_name ?? "—").split(" (")[0]} · {r.section_name ?? "—"}</div>
                <div style={{ display: "flex", justifyContent: "space-between", fontSize: 10.5 }}>
                  <span style={{ color: "var(--green)", fontWeight: 700, textTransform: "uppercase", fontSize: 9.5 }}>{getAssetType(r)}</span>
                  <span style={{ color: "var(--text-muted)" }}>{r.survey_date ?? "—"}</span>
                </div>
                <div style={{ marginTop: 6, fontSize: 10.5, color: "var(--text-secondary)", fontFamily: "ui-monospace, monospace" }}>
                  GPS: {gpsLabel ?? "—"}
                </div>
                {r.surveyor_name && <div style={{ marginTop: 5, fontSize: 10, color: "var(--text-muted)" }}>👤 {r.surveyor_name}</div>}
                <div style={{ marginTop: 8, fontSize: 10, fontWeight: 700, color: "var(--green)" }}>🗺 Show on map</div>
              </div>
            );
          })}
        </div>
      </div>
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
    ]
  },
];

function SurveyFormModal({ isOpen, onClose, record, onSave, onToast }: SurveyFormModalProps) {
  const [section, setSection] = useState<string>("sealed");
  const [isSaving, setIsSaving] = useState(false);
  const [roadName, setRoadName] = useState("A4 Highway (Harare - Masvingo - Beitbridge)");
  const [sectionName, setSectionName] = useState("");
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
  const [potholePatchesDegree, setPotholePatchesDegree] = useState("good");
  const [ruttingDegree, setRuttingDegree] = useState("no_rutting__5mm");
  const [edgeBreaksDegree, setEdgeBreaksDegree] = useState("no_edge_break");
  const [edgeDropDegree, setEdgeDropDegree] = useState("no_edge_break");
  const [drainage001, setDrainage001] = useState("good");
  const [ravellingDegree, setRavellingDegree] = useState("none");
  const [ridingQuality001, setRidingQuality001] = useState("good");
  const [roadMarkings, setRoadMarkings] = useState("yes");
  const [roadStuds, setRoadStuds] = useState("yes");
  const [passability002, setPassability002] = useState("all_year_round");
  const [grid, setGrid] = useState("good");
  const [yearConstructedToSealedStandard, setYearConstructedToSealedStandard] = useState("");
  const [lastSurfaceYear, setLastSurfaceYear] = useState("");

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
      setSurveyorName(record.surveyor_name || "");
      setSurveyDate(record.survey_date || new Date().toISOString().split("T")[0]);
      setVegetation(record.vegetation || "none");
      setGps(record.gps || "");
      setImageSadcCompliant(record.image_SADC_compliant || "yes");
      setProvince(record.province || "Harare");
      setDistrict(record.district || "Harare");
      setPhoto(record.photo || normalizePhotos(record)[0] || null);
      setPhotos(normalizePhotos(record));

      setPavedRoadName(record.paved_road_name || record.Road_Name_002 || "");
      setPavedRoadClass(record.paved_road_class || record.Road_Class_002 || "secondary");
      setPavedRoadType(record.paved_road_type || record.Road_Type || "wide_mat_ss");
      setPavedRoadCondition(record.paved_road_condition || record.Riding_quality_degree_001 || "good");
      setPotholePatches(record.pothole_patches || "none");
      setNarrowCracks(record.narrow_cracks_degree || record.Narrow_cracks_degree || "no_cracks");
      setWideCracks(record.wide_cracks_degree || record.Wide_cracks_degree || "no_cracks");
      setPotholePatchesDegree(record.pothole_patches_degree || record.Pothole_patches_degree || "good");
      setRuttingDegree(record.rutting_degree || record.Rutting_degree || "no_rutting__5mm");
      setEdgeBreaksDegree(record.edge_breaks_degree || record.Edge_breaks_Degree || "no_edge_break");
      setEdgeDropDegree(record.edge_drop_degree || record.Edge_Drop_Degree || "no_edge_break");
      setDrainage001(record.drainage_001 || record.Drainage_001 || "good");
      setRavellingDegree(record.ravelling_degree || record.Ravelling_Degree || "none");
      setRidingQuality001(record.riding_quality_degree_001 || record.Riding_quality_degree_001 || "good");
      setRoadMarkings(record.road_markings || "yes");
      setRoadStuds(record.road_studs || "yes");
      setPassability002(record.passability_002 || "all_year_round");
      setGrid(record.grid || "good");
      setYearConstructedToSealedStandard(record.year_constructed_to_sealed_standard || "");
      setLastSurfaceYear(record.last_surface_year || "");
      {
        const auth = record.Authority_Name_002 || record.authority_name_002 || "rdc";
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
      setGravelPassability(record.passability || "all_year_round");
      setGravelYearOfConstruction(record.year_of_construction || "");
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
    } else {
      setSection("sealed");
      setRoadName("A4 Highway (Harare - Masvingo - Beitbridge)");
      setSectionName("");
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
      setPotholePatchesDegree("good");
      setRuttingDegree("no_rutting__5mm");
      setEdgeBreaksDegree("no_edge_break");
      setEdgeDropDegree("no_edge_break");
      setDrainage001("good");
      setRavellingDegree("none");
      setRidingQuality001("good");
      setRoadMarkings("yes");
      setRoadStuds("yes");
      setPassability002("all_year_round");
      setGrid("good");
      setYearConstructedToSealedStandard("");
      setLastSurfaceYear("");

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
      data.paved_road_name = pavedRoadName;
      data.paved_road_class = pavedRoadClass;
      data.paved_road_type = pavedRoadType;
      data.paved_road_condition = pavedRoadCondition;
      data.pothole_patches = potholePatches;
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
      data.grid = grid;
      data.Authority_Name_002 = sealedAuthority;
      data.authority_name_002 = sealedAuthority;
      if (yearConstructedToSealedStandard) data.year_constructed_to_sealed_standard = Number(yearConstructedToSealedStandard);
      if (lastSurfaceYear) data.last_surface_year = Number(lastSurfaceYear);
    } else if (section === "gravel") {
      data.gravel_road_name = gravelRoadName;
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
      if (gravelYearOfConstruction) data.year_of_construction = Number(gravelYearOfConstruction);
    } else if (section === "earth") {
      data.earth_road_name = earthRoadName;
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
    if (section === "sealed") derivedCond = pavedRoadCondition;
    else if (section === "gravel") derivedCond = gravelCondition;
    else if (section === "earth") derivedCond = earthRoadCondition;
    else if (section === "bridge") derivedCond = bridgeCondition;
    else if (section === "footbridge") derivedCond = footbridgeCondition;
    else if (section === "rail_crossing") derivedCond = railCrossingCondition;
    else if (section === "tollgate") derivedCond = tollgateCondition;
    else if (section === "layby") derivedCond = laybyCondition;
    else if (section === "busstop") derivedCond = busstopCondition;
    else if (section === "junction") derivedCond = junctionCondition;
    else if (section === "sign") derivedCond = signCondition;
    else if (section === "shelvet") derivedCond = shelvetCondition;
    else if (section === "culvert") derivedCond = culvertServiceability;
    else if (section === "piped_causeway") derivedCond = causewayCondition;
    else if (section === "drift") derivedCond = driftCondition;
    else if (section === "grid") derivedCond = gridCondition;
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
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Name</label>
                <input type="text" placeholder="e.g. A4 Section 5" value={pavedRoadName} onChange={e => setPavedRoadName(e.target.value)} required={section === "sealed"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Class</label>
                  <select value={pavedRoadClass} onChange={e => setPavedRoadClass(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="primary">Primary Link</option>
                    <option value="secondary">Secondary Link</option>
                    <option value="tertiary">Tertiary Feeder</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Pavement Type</label>
                  <select value={pavedRoadType} onChange={e => setPavedRoadType(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="wide_mat_ss">Wide Mat Single Seal</option>
                    <option value="double_seal">Double Seal</option>
                    <option value="concrete_pavement">Concrete Pavement</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Riding Quality</label>
                  <select value={pavedRoadCondition} onChange={e => setPavedRoadCondition(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {CONDITION_WITH_CONSTRUCTION_OPTIONS.map(o => (
                      <option key={o.value} value={o.value}>{o.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Potholes/Patches</label>
                  <select value={potholePatches} onChange={e => setPotholePatches(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="none">None</option>
                    <option value="light">Light</option>
                    <option value="severe">Severe</option>
                    <option value="mixed">Mixed</option>
                    <option value="good">Good</option>
                    <option value="fair">Fair</option>
                    <option value="poor">Poor</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Rutting</label>
                  <select value={ruttingDegree} onChange={e => setRuttingDegree(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="no_rutting__5mm">No Rutting (&lt; 5mm)</option>
                    <option value="moderate_5_15mm">Moderate (5-15mm)</option>
                    <option value="severe__15mm">Severe (&gt; 15mm)</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Narrow Cracks</label>
                  <select value={narrowCracks} onChange={e => setNarrowCracks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="no_cracks">No Cracks</option>
                    <option value="light">Light</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Wide Cracks</label>
                  <select value={wideCracks} onChange={e => setWideCracks(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="no_cracks">No Cracks</option>
                    <option value="light">Light</option>
                    <option value="severe">Severe</option>
                  </select>
                </div>
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Drainage State</label>
                  <select value={drainage001} onChange={e => setDrainage001(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="good">Good (Clean)</option>
                    <option value="fair">Fair (Slight Silt)</option>
                    <option value="poor">Poor (Blocked)</option>
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Year Sealed</label>
                  <input type="number" placeholder="e.g. 2018" value={yearConstructedToSealedStandard} onChange={e => setYearConstructedToSealedStandard(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
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
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Passability</label>
                  <select value={passability002} onChange={e => setPassability002(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="all_year_round">All Year Round</option>
                    <option value="dry_season_only">Dry Season Only</option>
                    <option value="under_construction">Under construction / rehabilitation (detour)</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          {section === "gravel" && (
            <div style={{ background: "#f0f7f3", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 12, padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--green)", textTransform: "uppercase", letterSpacing: "0.5px", marginBottom: 4 }}>Gravel Road Details</div>
              
              <div>
                <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Name</label>
                <input type="text" placeholder="e.g. Murambinda Link" value={gravelRoadName} onChange={e => setGravelRoadName(e.target.value)} required={section === "gravel"} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff", outline: "none" }} />
              </div>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Road Class</label>
                  <select value={gravelRoadClass} onChange={e => setGravelRoadClass(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="urban_collector">Urban Collector</option>
                    <option value="rural_feeder">Rural Feeder</option>
                    <option value="tertiary">Tertiary Feeder</option>
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
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Authority</label>
                  <select value={gravelAuthority} onChange={e => setGravelAuthority(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    {AUTHORITY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
                <div>
                  <label style={{ display: "block", fontSize: 9, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 4 }}>Passability</label>
                  <select value={gravelPassability} onChange={e => setGravelPassability(e.target.value)} style={{ width: "100%", padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 6, fontSize: 11.5, background: "#fff" }}>
                    <option value="all_year_round">All Year Round</option>
                    <option value="dry_season_only">Dry Season Only</option>
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


function DatabasePage({ records, onSelectRecord, onRefresh, onToast }: { records: any[]; onSelectRecord: (r: any) => void; onRefresh?: () => void; onToast?: (msg: string, type: "success" | "error" | "info") => void }) {
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const [sortCol, setSortCol] = useState<string>("survey_date");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  // Filter States
  const [highwayFilter, setHighwayFilter] = useState("all");
  const [typeFilter, setTypeFilter] = useState("all");
  const [condFilter, setCondFilter] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [surveyorFilter, setSurveyorFilter] = useState("all");
  const [selectedTable, setSelectedTable] = useState("all");

  // Modal States
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editRecord, setEditRecord] = useState<any | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const handleSort = (col: string) => {
    if (sortCol === col) setSortDir(d => d === "asc" ? "desc" : "asc");
    else { setSortCol(col); setSortDir("asc"); }
    setPage(0);
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
        if (onRefresh) onRefresh();
      } else {
        throw new Error(data.error || "Saving survey record failed");
      }
    } catch (err: any) {
      if (onToast) onToast("Save failed: " + err.message, "error");
    }
  };

  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || getAssetName(r).toLowerCase().includes(q) || (r.road_name ?? "").toLowerCase().includes(q) || (r.surveyor_name ?? "").toLowerCase().includes(q);
    const matchH = highwayFilter === "all" || (r.road_name ?? "").includes(highwayFilter);
    const matchC = condFilter === "all" || getRecordStatus(r) === condFilter;
    const matchProv = provinceFilter === "all" || r.province === provinceFilter;
    const matchDist = districtFilter === "all" || r.district === districtFilter;
    const matchSurveyor = surveyorFilter === "all" || r.surveyor_name === surveyorFilter;
    
    let matchT = true;
    if (selectedTable !== "all") {
      matchT = r.asset_category === selectedTable;
    } else if (typeFilter !== "all") {
      const typeStr = getAssetType(r).toLowerCase().replace(/ /g, "_").replace("street_light", "streetlight");
      matchT = typeStr === typeFilter || (typeFilter === "sealed_road" && typeStr === "concrete_road");
    }
    
    return matchQ && matchH && matchC && matchT && matchProv && matchDist && matchSurveyor;
  });

  const sorted = [...filtered].sort((a, b) => {
    let va = "";
    let vb = "";
    if (sortCol === "asset_name") {
      va = getAssetName(a);
      vb = getAssetName(b);
    } else if (sortCol === "asset_type") {
      va = getAssetType(a);
      vb = getAssetType(b);
    } else if (sortCol === "condition") {
      va = getRecordStatus(a);
      vb = getRecordStatus(b);
    } else if (sortCol === "gps") {
      const latA = a._geolocation?.[0] ?? 0;
      const latB = b._geolocation?.[0] ?? 0;
      return sortDir === "asc" ? latA - latB : latB - latA;
    } else {
      va = String(a[sortCol] ?? "");
      vb = String(b[sortCol] ?? "");
    }
    return sortDir === "asc" ? va.localeCompare(vb) : vb.localeCompare(va);
  });

  const pages = Math.ceil(sorted.length / PAGE_SIZE);
  const slice = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  // Dynamic headers resolution
  let headers: { col: string; label: string }[] = [];
  if (selectedTable === "all") {
    headers = [
      { col: "asset_type", label: "Category" },
      { col: "asset_name", label: "Asset Name" },
      { col: "road_name", label: "Road / Highway" },
      { col: "section_name", label: "Section" },
      { col: "province", label: "Province" },
      { col: "district", label: "District" },
      { col: "condition", label: "Condition" },
      { col: "survey_date", label: "Survey Date" },
      { col: "surveyor_name", label: "Surveyor" },
      { col: "gps", label: "GPS" }
    ];
  } else {
    headers = [
      { col: "asset_type", label: "Category" },
      { col: "asset_name", label: "Asset Name" },
      { col: "condition", label: "Condition" },
      { col: "survey_date", label: "Survey Date" },
      { col: "surveyor_name", label: "Surveyor" }
    ];

    // Gather specific attributes for the chosen category
    const categoryKeysSet = new Set<string>();
    records.forEach(r => {
      if (r.asset_category === selectedTable) {
        Object.keys(r).forEach(k => {
          if (!EXCLUDED_KEYS.has(k) && k !== "road_name" && k !== "section_name" && k !== "surveyor_name" && k !== "survey_date" && k !== "province" && k !== "district") {
            categoryKeysSet.add(k);
          }
        });
      }
    });
    
    Array.from(categoryKeysSet).forEach(k => {
      headers.push({ col: k, label: formatKey(k) });
    });

    headers.push(
      { col: "road_name", label: "Road / Highway" },
      { col: "section_name", label: "Section" },
      { col: "province", label: "Province" },
      { col: "district", label: "District" },
      { col: "gps", label: "GPS" }
    );
  }

  const surveyorsList = Array.from(new Set(records.map(r => r.surveyor_name).filter(Boolean)));

  const Th = ({ col, label }: { col: string; label: string }) => (
    <th onClick={() => handleSort(col)} style={{ cursor: "pointer", userSelect: "none", background: "#f0f7f3", borderBottom: "2px solid var(--border)", padding: "9px 12px", textAlign: "left", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: sortCol === col ? "var(--green)" : "var(--text-muted)", whiteSpace: "nowrap" }}>
      <span style={{ display: "flex", alignItems: "center", gap: 4 }}>{label}<ArrowUpDown size={10} /></span>
    </th>
  );

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-app)" }}>
      {/* Toolbar */}
      <div style={{ padding: "12px 24px", borderBottom: "1px solid var(--border)", background: "#fafcfb", display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
        {/* Search */}
        <div style={{ position: "relative", flex: 2, minWidth: 180 }}>
          <Search size={13} style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", color: "var(--text-muted)" }} />
          <input placeholder="Search records…" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }}
            style={{ width: "100%", padding: "7px 10px 7px 30px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-primary)" }} />
        </div>

        {/* Parameter Selector */}
        <select value={selectedTable} onChange={e => { setSelectedTable(e.target.value); setPage(0); }} style={{ padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer", fontWeight: "bold" }}>
          <option value="all">🔍 All</option>
          <option value="sealed">🛣️ Sealed Roads</option>
          <option value="gravel">🪨 Gravel Roads</option>
          <option value="earth">🚜 Earth Roads</option>
          <option value="bridge">🌉 Bridges</option>
          <option value="footbridge">🚶 Foot Bridges</option>
          <option value="rail_crossing">🛤️ Rail Crossings</option>
          <option value="tollgate">🪙 Tollgates</option>
          <option value="drift">🌊 Drifts</option>
          <option value="culvert">🕳️ Culverts</option>
          <option value="piped_causeway">🌁 Piped Causeways</option>
          <option value="shelvet">🧱 Shelverts</option>
          <option value="grid">🐄 Cattle Grids</option>
          <option value="layby">🅿️ Laybys</option>
          <option value="busstop">🚌 Bus Stops</option>
          <option value="junction">🔀 Junctions</option>
          <option value="sign">⚠️ Road Signs</option>
          <option value="traffic_lights">🚦 Traffic Lights</option>
          <option value="streetlight">💡 Streetlights</option>
        </select>

        {/* Highway Filter */}
        <select value={highwayFilter} onChange={e => { setHighwayFilter(e.target.value); setPage(0); }} style={{ padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer" }}>
          <option value="all">All Highways</option>
          <option value="A1">A1 Route</option>
          <option value="A2">A2 Route</option>
          <option value="A3">A3 Route</option>
          <option value="A4">A4 Route</option>
          <option value="A5">A5 Route</option>
        </select>

        {/* Condition Filter */}
        <select value={condFilter} onChange={e => { setCondFilter(e.target.value); setPage(0); }} style={{ padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer" }}>
          <option value="all">All Conditions</option>
          <option value="good">Good</option>
          <option value="fair">Fair</option>
          <option value="poor">Poor</option>
          <option value="mixed">Mixed</option>
          <option value="under_construction">Under construction</option>
        </select>

        {/* Surveyor Filter */}
        <select value={surveyorFilter} onChange={e => { setSurveyorFilter(e.target.value); setPage(0); }} style={{ padding: "7px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer" }}>
          <option value="all">All Surveyors</option>
          {surveyorsList.map(s => <option key={s} value={s}>{s}</option>)}
        </select>

        {/* Toggle Advanced Filters */}
        <button onClick={() => setShowAdvanced(!showAdvanced)} style={{ padding: "7px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: showAdvanced ? "var(--bg-active)" : "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer", display: "flex", alignItems: "center", gap: 5, transition: "all 0.15s" }}>
          {showAdvanced ? "▲ Hide Location" : "▼ Location Filters"}
        </button>

        {/* Add Record button */}
        <button onClick={() => { setEditRecord(null); setIsFormOpen(true); }} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 8, padding: "8px 14px", fontSize: 11.5, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 5, fontFamily: "var(--font-body)" }}>
          <span>+</span> Add Survey Record
        </button>

        <span style={{ fontSize: 11, color: "var(--text-muted)", marginLeft: "auto", whiteSpace: "nowrap" }}>{filtered.length} rows · Page {page+1}/{Math.max(1,pages)}</span>
      </div>

      {/* Advanced Collapsible Filters Row */}
      {showAdvanced && (
        <div style={{ padding: "10px 24px 12px", borderBottom: "1px solid var(--border)", background: "#fafcfb", display: "flex", gap: 14, alignItems: "center", flexWrap: "wrap", flexShrink: 0 }}>
          {/* Province Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>Province:</span>
            <select value={provinceFilter} onChange={e => { setProvinceFilter(e.target.value); setDistrictFilter("all"); setPage(0); }} style={{ padding: "6px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: "pointer" }}>
              <option value="all">All Provinces</option>
              {Object.keys(ZIM_PROVINCES_DISTRICTS).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          {/* District Filter */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase" }}>District:</span>
            <select value={districtFilter} onChange={e => { setDistrictFilter(e.target.value); setPage(0); }} disabled={provinceFilter === "all"} style={{ padding: "6px 10px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", background: provinceFilter === "all" ? "#f4f6f5" : "#fff", color: "var(--text-secondary)", fontFamily: "var(--font-body)", cursor: provinceFilter === "all" ? "not-allowed" : "pointer" }}>
              <option value="all">All Districts</option>
              {provinceFilter !== "all" && (ZIM_PROVINCES_DISTRICTS[provinceFilter] || []).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          {/* Clear Advanced filters link */}
          {(provinceFilter !== "all" || districtFilter !== "all") && (
            <button onClick={() => { setProvinceFilter("all"); setDistrictFilter("all"); setPage(0); }} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11.5, fontWeight: 700, fontFamily: "var(--font-body)", padding: 0, textDecoration: "underline" }}>
              Clear Location Filters
            </button>
          )}
        </div>
      )}

      {/* Database Dynamic Table */}
      <div style={{ flex: 1, overflowX: "auto", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 11.5 }}>
          <thead style={{ position: "sticky", top: 0, zIndex: 10 }}>
            <tr>
              <th style={{ background: "#f0f7f3", borderBottom: "2px solid var(--border)", padding: "9px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", width: 40 }}>#</th>
              {headers.map(h => (
                <Th key={h.col} col={h.col} label={h.label} />
              ))}
              <th style={{ background: "#f0f7f3", borderBottom: "2px solid var(--border)", padding: "9px 12px", fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", width: 110 }}>Actions</th>
            </tr>
          </thead>
          <tbody>
            {slice.length === 0 ? (
              <tr>
                <td colSpan={headers.length + 2} style={{ padding: 40, textAlign: "center", color: "var(--text-muted)" }}>
                  No matching survey records found.
                </td>
              </tr>
            ) : slice.map((r, i) => {
              const gpsLabel = formatGpsLabel(r);
              return (
                <tr key={r._id ?? i} onClick={() => onSelectRecord(r)} title="Click row to show on map" style={{ cursor: "pointer", transition: "background 0.1s" }}
                  onMouseOver={e => (e.currentTarget.style.background = "var(--bg-hover)")}
                  onMouseOut={e => (e.currentTarget.style.background = "transparent")}>
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", fontWeight: 600 }}>{page * PAGE_SIZE + i + 1}</td>
                  {headers.map(h => {
                    let valContent: React.ReactNode = "—";
                    if (h.col === "asset_name") {
                      valContent = getAssetName(r);
                    } else if (h.col === "asset_type") {
                      valContent = getAssetType(r);
                    } else if (h.col === "condition") {
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
                      <td key={h.col} style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: h.col === "asset_name" ? "var(--text-primary)" : "var(--text-secondary)", fontWeight: h.col === "asset_name" ? 600 : 400, whiteSpace: "nowrap", maxWidth: 280, overflow: "hidden", textOverflow: "ellipsis" }}>
                        {valContent}
                      </td>
                    );
                  })}
                  <td style={{ padding: "8px 12px", borderBottom: "1px solid rgba(0,102,51,0.06)", whiteSpace: "nowrap" }} onClick={e => e.stopPropagation()}>
                    <button type="button" onClick={() => onSelectRecord(r)} title="Show on map" style={{ background: "var(--bg-active)", border: "1px solid var(--border)", borderRadius: 6, color: "var(--green)", cursor: "pointer", marginRight: 8, fontWeight: 700, fontSize: 11, fontFamily: "var(--font-body)", padding: "4px 8px" }}>🗺 Map</button>
                    <button type="button" onClick={() => { setEditRecord(r); setIsFormOpen(true); }} style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", marginRight: 10, fontWeight: 700, fontSize: 11, fontFamily: "var(--font-body)" }}>Edit</button>
                    <button type="button" onClick={(e) => handleDelete(e, r._id)} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontWeight: 700, fontSize: 11, fontFamily: "var(--font-body)" }}>Delete</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Pagination */}
      <div style={{ padding: "10px 24px", borderTop: "1px solid var(--border)", background: "#fafcfb", display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0 }}>
        <button onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", color: "var(--text-secondary)", transition: "all 0.13s" }}>← Previous</button>
        <span style={{ fontSize: 11, color: "var(--text-muted)" }}>Showing {page * PAGE_SIZE + 1}–{Math.min((page+1)*PAGE_SIZE, filtered.length)} of {filtered.length}</span>
        <button onClick={() => setPage(p => Math.min(pages-1, p+1))} disabled={page >= pages-1} style={{ padding: "6px 14px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font-body)", color: "var(--text-secondary)", transition: "all 0.13s" }}>Next →</button>
      </div>

      {/* Survey Form Modal */}
      <SurveyFormModal isOpen={isFormOpen} onClose={() => setIsFormOpen(false)} record={editRecord} onSave={handleSave} onToast={onToast} />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   EXPORT
 ════════════════════════════════════════════════════════════════════════════ */
const EXPORT_PARAMETERS = [
  { key: "sealed",          label: "Sealed Roads",    emoji: "🛣️" },
  { key: "gravel",          label: "Gravel Roads",    emoji: "🪨" },
  { key: "earth",           label: "Earth Roads",     emoji: "🚜" },
  { key: "bridge",          label: "Bridges",         emoji: "🌉" },
  { key: "footbridge",      label: "Foot Bridges",    emoji: "🚶" },
  { key: "rail_crossing",   label: "Rail Crossings",  emoji: "🛤️" },
  { key: "tollgate",        label: "Tollgates",       emoji: "🪙" },
  { key: "drift",           label: "Drifts",          emoji: "🌊" },
  { key: "culvert",         label: "Culverts",        emoji: "🕳️" },
  { key: "piped_causeway",  label: "Piped Causeways", emoji: "🌁" },
  { key: "shelvet",         label: "Shelverts",        emoji: "🧱" },
  { key: "grid",            label: "Cattle Grids",    emoji: "🐄" },
  { key: "layby",           label: "Lay-bys",         emoji: "🅿️" },
  { key: "busstop",         label: "Bus Stops",       emoji: "🚌" },
  { key: "junction",        label: "Junctions",       emoji: "🔀" },
  { key: "sign",            label: "Road Signs",      emoji: "⚠️" },
  { key: "traffic_lights",  label: "Traffic Lights",  emoji: "🚦" },
  { key: "streetlight",     label: "Streetlights",    emoji: "💡" }
];

const ALL_PARAM_KEYS = EXPORT_PARAMETERS.map(p => p.key);

function ExportPage({ records, onSelectRecord }: { records: any[]; onSelectRecord?: (r: any) => void }) {
  const [fmt, setFmt]   = useState("csv");
  const [road, setRoad] = useState("all");
  const [cond, setCond] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [surveyorFilter, setSurveyorFilter] = useState("all");

  const [selectedParams, setSelectedParams] = useState<string[]>(ALL_PARAM_KEYS);

  const roads = Array.from(new Set(records.map(r => r.road_name).filter(Boolean)));

  const filtered = records.filter(r => {
    const matchR = road === "all" || r.road_name === road;
    const matchC = cond === "all" || getRecordStatus(r) === cond;
    const matchProv = provinceFilter === "all" || r.province === provinceFilter;
    const matchDist = districtFilter === "all" || r.district === districtFilter;
    const matchSurveyor = surveyorFilter === "all" || r.surveyor_name === surveyorFilter;
    return matchR && matchC && matchProv && matchDist && matchSurveyor;
  });

  const recordsToPreview = filtered.filter(r => selectedParams.includes(r.asset_category));
  const countToExport = recordsToPreview.length;

  const handleDownload = () => {
    selectedParams.forEach((paramKey, index) => {
      setTimeout(() => {
        const paramRecords = filtered.filter(r => r.asset_category === paramKey);
        if (paramRecords.length === 0) return;

        // Dynamically gather all attributes captured for this parameter
        const keys = new Set<string>();
        paramRecords.forEach(r => {
          Object.keys(r).forEach(k => {
            if (!EXCLUDED_KEYS.has(k)) {
              keys.add(k);
            }
          });
        });

        const coreKeys = ["asset_name", "asset_type", "condition", "latitude", "longitude", "road_name", "section_name", "province", "district", "surveyor_name", "survey_date"];
        const customAttrs = Array.from(keys).filter(k => !coreKeys.includes(k));

        const allAttrs = [
          "asset_name",
          "asset_type",
          "condition",
          ...customAttrs,
          "road_name",
          "section_name",
          "province",
          "district",
          "surveyor_name",
          "survey_date",
          "latitude",
          "longitude"
        ];

        const paramLabel = EXPORT_PARAMETERS.find(p => p.key === paramKey)?.label || paramKey;
        const cleanFilename = paramLabel.toLowerCase().replace(/ /g, "_");

        if (fmt === "json") {
          const dataToExport = paramRecords.map(r => {
            const obj: any = {};
            allAttrs.forEach(p => {
              if (p === "asset_name") obj.asset_name = getAssetName(r);
              else if (p === "asset_type") obj.asset_type = getAssetType(r);
              else if (p === "condition") obj.condition = getRecordStatus(r);
              else if (p === "latitude") obj.latitude = r._geolocation?.[0] ?? "";
              else if (p === "longitude") obj.longitude = r._geolocation?.[1] ?? "";
              else if (r[p] !== undefined) obj[p] = r[p];
            });
            return obj;
          });
          const blob = new Blob([JSON.stringify(dataToExport, null, 2)], { type: "application/json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `${cleanFilename}_export_${new Date().toISOString().slice(0,10)}.json`;
          a.click();
        } else if (fmt === "geojson") {
          const features = paramRecords.map(r => {
            const geom = getGeometry(r);
            const properties: any = {};
            allAttrs.forEach(p => {
              if (p === "asset_name") properties.asset_name = getAssetName(r);
              else if (p === "asset_type") properties.asset_type = getAssetType(r);
              else if (p === "condition") properties.condition = getRecordStatus(r);
              else if (p === "latitude") properties.latitude = r._geolocation?.[0] ?? "";
              else if (p === "longitude") properties.longitude = r._geolocation?.[1] ?? "";
              else if (r[p] !== undefined) properties[p] = r[p];
            });
            return {
              type: "Feature",
              geometry: geom,
              properties: properties
            };
          }).filter(f => f.geometry !== null);

          const featureCollection = {
            type: "FeatureCollection",
            features: features
          };

          const blob = new Blob([JSON.stringify(featureCollection, null, 2)], { type: "application/geo+json" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `${cleanFilename}_export_${new Date().toISOString().slice(0,10)}.geojson`;
          a.click();
        } else if (fmt === "kml") {
          let kml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
          kml += `<kml xmlns="http://www.opengis.net/kml/2.2">\n`;
          kml += `  <Document>\n`;
          kml += `    <name>${paramLabel} Export - ${new Date().toISOString().slice(0,10)}</name>\n`;

          kml += `    <Style id="goodStyle">\n`;
          kml += `      <LineStyle><color>ff336600</color><width>4</width></LineStyle>\n`;
          kml += `      <IconStyle><color>ff336600</color><scale>1.1</scale></IconStyle>\n`;
          kml += `    </Style>\n`;
          kml += `    <Style id="fairStyle">\n`;
          kml += `      <LineStyle><color>ff0b9ef5</color><width>4</width></LineStyle>\n`;
          kml += `      <IconStyle><color>ff0b9ef5</color><scale>1.1</scale></IconStyle>\n`;
          kml += `    </Style>\n`;
          kml += `    <Style id="poorStyle">\n`;
          kml += `      <LineStyle><color>ff2626dc</color><width>4</width></LineStyle>\n`;
          kml += `      <IconStyle><color>ff2626dc</color><scale>1.1</scale></IconStyle>\n`;
          kml += `    </Style>\n`;
          kml += `    <Style id="defaultStyle">\n`;
          kml += `      <LineStyle><color>ff888888</color><width>4</width></LineStyle>\n`;
          kml += `      <IconStyle><color>ff888888</color><scale>1.1</scale></IconStyle>\n`;
          kml += `    </Style>\n`;

          paramRecords.forEach(r => {
            const geom = getGeometry(r);
            if (!geom) return;

            const condVal = getRecordStatus(r);
            const styleId = condVal === "good" ? "goodStyle" : condVal === "fair" ? "fairStyle" : condVal === "poor" ? "poorStyle" : "defaultStyle";

            let desc = `<table border="1" style="border-collapse: collapse; font-family: sans-serif; font-size: 11px; width: 100%;">`;
            desc += `<tr style="background-color: #006633; color: white;"><th>Attribute</th><th>Value</th></tr>`;

            allAttrs.forEach(p => {
              let val = "";
              if (p === "asset_name") val = getAssetName(r);
              else if (p === "asset_type") val = getAssetType(r);
              else if (p === "condition") val = condVal.toUpperCase();
              else if (p === "latitude") val = r._geolocation?.[0] ?? "";
              else if (p === "longitude") val = r._geolocation?.[1] ?? "";
              else val = r[p] !== undefined ? formatValue(r[p]) : "";

              if (val !== null && val !== undefined && val !== "") {
                desc += `<tr><td><b>${formatKey(p)}</b></td><td>${val}</td></tr>`;
              }
            });
            desc += `</table>`;

            kml += `    <Placemark>\n`;
            kml += `      <name>${getAssetName(r)}</name>\n`;
            kml += `      <styleUrl>#${styleId}</styleUrl>\n`;
            kml += `      <description><![CDATA[${desc}]]></description>\n`;

            if (geom.type === "LineString") {
              kml += `      <LineString>\n`;
              kml += `        <tessellate>1</tessellate>\n`;
              kml += `        <coordinates>\n`;
              const coords = geom.coordinates.map((c: any) => `${c[0]},${c[1]},0`).join("\n          ");
              kml += `          ${coords}\n`;
              kml += `        </coordinates>\n`;
              kml += `      </LineString>\n`;
            } else if (geom.type === "Point") {
              kml += `      <Point>\n`;
              kml += `        <coordinates>${geom.coordinates[0]},${geom.coordinates[1]},0</coordinates>\n`;
              kml += `      </Point>\n`;
            }
            kml += `    </Placemark>\n`;
          });

          kml += `  </Document>\n`;
          kml += `</kml>\n`;

          const blob = new Blob([kml], { type: "application/vnd.google-earth.kml+xml" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `${cleanFilename}_export_${new Date().toISOString().slice(0,10)}.kml`;
          a.click();
        } else {
          // CSV format
          const headers = allAttrs;
          const csvRows = paramRecords.map(r => {
            return headers.map(header => {
              let val = "";
              if (header === "asset_name") val = getAssetName(r);
              else if (header === "asset_type") val = getAssetType(r);
              else if (header === "condition") val = getRecordStatus(r);
              else if (header === "latitude") val = r._geolocation?.[0] ?? "";
              else if (header === "longitude") val = r._geolocation?.[1] ?? "";
              else val = r[header] ?? "";

              const cell = String(val).replace(/"/g, '""');
              return `"${cell}"`;
            }).join(",");
          });

          const csv = [headers.map(h => formatKey(h)).join(","), ...csvRows].join("\n");
          const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
          const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
          a.download = `${cleanFilename}_export_${new Date().toISOString().slice(0,10)}.csv`;
          a.click();
        }
      }, index * 400);
    });
  };

  return (
    <div style={{ padding: "24px", overflowY: "auto", height: "100%", background: "var(--bg-app)", display: "flex", flexDirection: "column", gap: 20 }}>
      <SectionTitle>Export Telemetry Data</SectionTitle>

      <div className="export-page-layout">
        {/* Options panel */}
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 14 }}>
          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 6 }}>Export Format</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {["csv", "json", "geojson", "kml"].map(f => (
                <button key={f} onClick={() => setFmt(f)} style={{ padding: "10px", borderRadius: 8, border: `2px solid ${fmt === f ? "var(--green)" : "var(--border)"}`, background: fmt === f ? "var(--bg-active)" : "#f9fafb", fontSize: 11, fontWeight: 700, color: fmt === f ? "var(--green)" : "var(--text-muted)", cursor: "pointer", textTransform: "uppercase", fontFamily: "var(--font-body)" }}>
                  {f === "csv" ? "📄 CSV" : f === "json" ? "🔧 JSON" : f === "geojson" ? "🌍 GeoJSON" : "🗺️ KML"}
                </button>
              ))}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 6 }}>Filter by Highway</div>
            <select value={road} onChange={e => setRoad(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
              <option value="all">All Highways</option>
              {roads.map(r => <option key={r} value={r}>{(r ?? "").split(" (")[0]}</option>)}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 6 }}>Filter by Condition</div>
            <select value={cond} onChange={e => setCond(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
              <option value="all">All Conditions</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="mixed">Mixed</option>
              <option value="under_construction">Under construction</option>
            </select>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 6 }}>Filter by Province</div>
            <select value={provinceFilter} onChange={e => { setProvinceFilter(e.target.value); setDistrictFilter("all"); }} style={{ width: "100%", padding: "9px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
              <option value="all">All Provinces (National)</option>
              {Object.keys(ZIM_PROVINCES_DISTRICTS).map(p => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 6 }}>Filter by District</div>
            <select value={districtFilter} onChange={e => setDistrictFilter(e.target.value)} disabled={provinceFilter === "all"} style={{ width: "100%", padding: "9px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)", background: provinceFilter === "all" ? "#f4f6f5" : "#fff", cursor: provinceFilter === "all" ? "not-allowed" : "pointer" }}>
              <option value="all">All Districts</option>
              {provinceFilter !== "all" && (ZIM_PROVINCES_DISTRICTS[provinceFilter] || []).map(d => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 6 }}>Filter by Surveyor</div>
            <select value={surveyorFilter} onChange={e => setSurveyorFilter(e.target.value)} style={{ width: "100%", padding: "9px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)" }}>
              <option value="all">All Surveyors</option>
              {Array.from(new Set(records.map(r => r.surveyor_name).filter(Boolean))).map(s => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ background: "var(--bg-app)", borderRadius: 10, padding: 14, border: "1px solid var(--border)", textAlign: "center" }}>
            <div style={{ fontFamily: "var(--font-title)", fontSize: 40, fontWeight: 800, color: "var(--green)" }}>{countToExport}</div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>Records to export</div>
          </div>

          <button onClick={handleDownload} style={{ background: "var(--green)", color: "#fff", border: "none", borderRadius: 10, padding: "13px", fontSize: 13, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", gap: 8, fontFamily: "var(--font-body)", transition: "background 0.15s" }}
            onMouseOver={e => (e.currentTarget.style.background = "var(--green-light)")}
            onMouseOut={e => (e.currentTarget.style.background = "var(--green)")}>
            <Download size={16} /> Download {fmt.toUpperCase()}
          </button>
        </div>

        {/* Dynamic Parameter Checklist + Preview */}
        <div style={{ display: "flex", flexDirection: "column", gap: 16, overflow: "hidden" }}>
          {/* Dynamic Checklist */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)" }}>Choose Parameters to Export ({selectedParams.length} selected)</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button onClick={() => setSelectedParams(ALL_PARAM_KEYS)} style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}>Select All</button>
                <button onClick={() => setSelectedParams([])} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}>Clear All</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 8, maxHeight: 160, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 14px", background: "var(--bg-app)" }}>
              {EXPORT_PARAMETERS.map(p => {
                const isChecked = selectedParams.includes(p.key);
                return (
                  <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, cursor: "pointer", color: isChecked ? "var(--text-primary)" : "var(--text-muted)", fontWeight: isChecked ? 600 : 400 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        if (isChecked) {
                          setSelectedParams(selectedParams.filter(item => item !== p.key));
                        } else {
                          setSelectedParams([...selectedParams, p.key]);
                        }
                      }}
                      style={{ accentColor: "var(--green)" }}
                    />
                    <span style={{ textOverflow: "ellipsis", overflow: "hidden", whiteSpace: "nowrap" }}>{p.emoji} {p.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Preview table */}
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", overflow: "auto", flex: 1 }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 10 }}>Data Preview (first 15 rows)</div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
              <thead>
                <tr>
                  {["Asset", "Type", "Road", "Province", "District", "Condition", "Date", "Surveyor"].map(h => (
                    <th key={h} style={{ background: "#f0f7f3", padding: "7px 10px", textAlign: "left", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", borderBottom: "2px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {recordsToPreview.slice(0, 15).map((r, i) => {
                  const c = getRecordStatus(r);
                  return (
                    <tr
                      key={r._id ?? i}
                      onClick={() => onSelectRecord?.(r)}
                      title="Click to show on map"
                      style={{ cursor: onSelectRecord ? "pointer" : "default" }}
                      onMouseOver={e => { if (onSelectRecord) e.currentTarget.style.background = "var(--bg-hover)"; }}
                      onMouseOut={e => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", fontWeight: 600, color: "var(--text-primary)" }}>{getAssetName(r)}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-secondary)" }}>{getAssetType(r)}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(r.road_name ?? "—").split(" (")[0]}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{r.province ?? "—"}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{r.district ?? "—"}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)" }}><span className={`badge ${c}`}>{c}</span></td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{r.survey_date ?? "—"}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{r.surveyor_name ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN EXPORT
 ════════════════════════════════════════════════════════════════════════════ */
interface FullPageModuleProps {
  module: NavModule;
  records: any[];
  onSelectRecord: (r: any) => void;
  onClose: () => void;
  onRefresh?: () => void;
  onToast?: (msg: string, type: "success" | "error" | "info") => void;
  lastSynced?: Date | null;
}

const MODULE_TITLES: Partial<Record<NavModule, string>> = {
  dashboard: "Dashboard Overview",
  highways:  "Highway Network",
  analytics: "Analytics Workspace",
  survey:    "Survey Records",
  database:  "Database Explorer",
  gallery:   "Photo Gallery",
  reports:   "Executive Reports Platform",
  export:    "Export Data",
};

const MODULE_ICONS: Partial<Record<NavModule, React.ReactNode>> = {
  dashboard: <LayoutDashboard size={16} />,
  highways:  <TrendingUp size={16} />,
  analytics: <BarChart2 size={16} />,
  survey:    <ClipboardCheck size={16} />,
  database:  <Database size={16} />,
  gallery:   <Camera size={16} />,
  reports:   <FileText size={16} />,
  export:    <Download size={16} />,
};

export default function FullPageModule({ module, records, onSelectRecord, onClose, onRefresh, onToast, lastSynced }: FullPageModuleProps) {
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
              <span style={{ background: "var(--bg-active)", color: "var(--green)", fontSize: 10, fontWeight: 700, padding: "2px 7px", borderRadius: 10, border: "1px solid var(--border)" }}>
                {records.length.toLocaleString()} records
              </span>
            </div>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.6px" }}>
              Roads Department · Zimbabwe
              {lastSynced && <span> · Last synced: {lastSynced.toLocaleTimeString()}</span>}
            </div>
          </div>
        </div>
        <button onClick={onClose} style={{ background: "var(--bg-app)", border: "1px solid var(--border)", borderRadius: 8, padding: "7px 14px", fontSize: 11.5, fontWeight: 700, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", gap: 6, fontFamily: "var(--font-body)", transition: "all 0.15s" }}
          onMouseOver={e => (e.currentTarget.style.borderColor = "var(--green)")}
          onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}>
          🗺 Back to Map
          <X size={13} />
        </button>
      </div>

      {/* Module content */}
      <div style={{ flex: 1, overflow: "hidden" }}>
        {module === "dashboard" && <DashboardPage records={records} lastSynced={lastSynced} />}
        {module === "highways"  && <HighwaysPage  records={records} />}
        {module === "analytics" && <AnalyticsPage records={records} />}
        {module === "survey"    && <SurveyPage    records={records} onSelectRecord={onSelectRecord} />}
        {module === "database"  && <DatabasePage  records={records} onSelectRecord={onSelectRecord} onRefresh={onRefresh} onToast={onToast} />}
        {module === "gallery"   && <GalleryPage   records={records} onSelectRecord={onSelectRecord} />}
        {module === "reports"   && <ReportsPage   records={records} onSelectRecord={onSelectRecord} />}
        {module === "export"    && <ExportPage    records={records} onSelectRecord={onSelectRecord} />}
      </div>
    </div>
  );
}


/* ═══════════════════════════════════════════════════════════════════════════
   GALLERY PAGE (NATIONAL PHOTO GALLERY)
 ════════════════════════════════════════════════════════════════════════════ */
function GalleryCard({ record, onSelectRecord, onOpenLightbox }: { record: any; onSelectRecord: (r: any) => void; onOpenLightbox: (record: any, photos: string[]) => void }) {
  const [photos, setPhotos] = useState<string[]>(() => normalizePhotos(record));
  const [loading, setLoading] = useState<boolean>(false);

  useEffect(() => {
    const init = normalizePhotos(record);
    if (init.length > 0) {
      setPhotos(init);
      return;
    }
    const id = record.id || record._id || record.survey_id;
    if (!id) return;

    setLoading(true);
    fetch(`/api/roads?photoFor=${encodeURIComponent(id)}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data.photos) && data.photos.length > 0) {
          setPhotos(data.photos);
        } else if (data.photo) {
          setPhotos([data.photo]);
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [record]);

  const cat = record.asset_category || "unknown";
  const name = getAssetName(record);
  const status = getRecordStatus(record);
  const statusColor = getStatusColor(status);
  const sadc = getSadcValue(record);

  const mainPhoto = photos[0];

  return (
    <div style={{
      background: "#fff",
      borderRadius: 12,
      border: "1px solid var(--border)",
      overflow: "hidden",
      display: "flex",
      flexDirection: "column",
      boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
      transition: "transform 0.2s, box-shadow 0.2s",
    }}
    onMouseOver={e => {
      e.currentTarget.style.transform = "translateY(-3px)";
      e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.1)";
    }}
    onMouseOut={e => {
      e.currentTarget.style.transform = "translateY(0)";
      e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
    }}>
      {/* Image Container */}
      <div 
        onClick={() => photos.length > 0 && onOpenLightbox(record, photos)}
        style={{
          position: "relative",
          height: 180,
          background: "rgba(0,0,0,0.04)",
          cursor: photos.length > 0 ? "pointer" : "default",
          overflow: "hidden"
        }}
      >
        {mainPhoto ? (
          <img 
            src={mainPhoto} 
            alt={name} 
            style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} 
          />
        ) : loading ? (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 11, gap: 8 }}>
            <div style={{ width: 18, height: 18, border: "2px solid rgba(0,102,51,0.2)", borderTop: "2px solid #006633", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
            Loading photo…
          </div>
        ) : (
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 11, flexDirection: "column", gap: 4 }}>
            <Camera size={24} style={{ opacity: 0.3 }} />
            <span>No Image Available</span>
          </div>
        )}

        {/* Top Overlay Badges */}
        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
          <span style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {cat.replace("_", " ")}
          </span>
          <span style={{ background: statusColor, color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, textTransform: "uppercase" }}>
            {formatStatusLabel(status)}
          </span>
        </div>

        {/* Bottom Overlay Badges */}
        <div style={{ position: "absolute", bottom: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", alignItems: "center", pointerEvents: "none" }}>
          {sadc === "yes" ? (
            <span style={{ background: "rgba(0,102,51,0.85)", backdropFilter: "blur(4px)", color: "#fff", fontSize: 9, fontWeight: 700, padding: "2px 7px", borderRadius: 12, display: "flex", alignItems: "center", gap: 3 }}>
              ✓ SADC Compliant
            </span>
          ) : <span />}

          {photos.length > 0 && (
            <span style={{ background: "rgba(0,0,0,0.75)", backdropFilter: "blur(4px)", color: "#fff", fontSize: 10, fontWeight: 700, padding: "2px 8px", borderRadius: 12, display: "flex", alignItems: "center", gap: 4 }}>
              📷 {photos.length} {photos.length === 1 ? "Photo" : "Photos"}
            </span>
          )}
        </div>
      </div>

      {/* Card Content */}
      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={name}>
            {name}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <span>📍</span>
            <span>{record.province || "Harare"} · {record.district || "District"}</span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 9.5, color: "var(--text-muted)", background: "rgba(0,0,0,0.02)", padding: "6px 8px", borderRadius: 6, marginBottom: 10 }}>
            <div><strong style={{ color: "var(--text-secondary)" }}>Surveyor:</strong> {record.surveyor_name || "N/A"}</div>
            <div><strong style={{ color: "var(--text-secondary)" }}>Date:</strong> {record.survey_date || "N/A"}</div>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            onClick={() => photos.length > 0 ? onOpenLightbox(record, photos) : null}
            disabled={photos.length === 0}
            style={{
              flex: 1,
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid var(--border)",
              background: photos.length > 0 ? "rgba(0,102,51,0.08)" : "#f3f4f6",
              color: photos.length > 0 ? "#006633" : "#9ca3af",
              fontSize: 10.5,
              fontWeight: 700,
              cursor: photos.length > 0 ? "pointer" : "default",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 4
            }}
          >
            <span>🔍</span> View Photos ({photos.length})
          </button>
          <button
            onClick={() => onSelectRecord(record)}
            style={{
              padding: "6px 10px",
              borderRadius: 6,
              border: "none",
              background: "#006633",
              color: "#fff",
              fontSize: 10.5,
              fontWeight: 700,
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: 4
            }}
            title="Inspect asset on map"
          >
            <span>📍</span> Map View
          </button>
        </div>
      </div>
    </div>
  );
}

function GalleryPage({ records, onSelectRecord }: { records: any[]; onSelectRecord: (r: any) => void }) {
  const [search, setSearch] = useState("");
  const [catFilter, setCatFilter] = useState("all");
  const [condFilter, setCondFilter] = useState("all");
  const [sadcFilter, setSadcFilter] = useState("all");
  const [lightbox, setLightbox] = useState<{ record: any; photos: string[]; index: number } | null>(null);

  // Filter records
  const filtered = records.filter(r => {
    // Category match
    if (catFilter !== "all" && r.asset_category !== catFilter) return false;
    // Condition match
    if (condFilter !== "all" && getRecordStatus(r) !== condFilter) return false;
    // SADC match
    if (sadcFilter !== "all" && getSadcValue(r) !== sadcFilter) return false;
    // Search query
    if (search.trim()) {
      const q = search.toLowerCase();
      const name = (getAssetName(r) || "").toLowerCase();
      const road = (r.road_name || "").toLowerCase();
      const surveyor = (r.surveyor_name || "").toLowerCase();
      const province = (r.province || "").toLowerCase();
      const district = (r.district || "").toLowerCase();
      if (!name.includes(q) && !road.includes(q) && !surveyor.includes(q) && !province.includes(q) && !district.includes(q)) return false;
    }
    return true;
  });

  // Photo stats
  const totalWithPhoto = records.filter(r => r.photo || (r.photos && r.photos.length > 0) || (r.raw_data && (r.raw_data.photo || r.raw_data.photos))).length;

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-app)", overflow: "hidden" }}>
      
      {/* Gallery Header Controls */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "14px 24px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        
        {/* Top Banner Stats */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📷</span> National Photo Gallery &amp; Inspection Evidence
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
              Visual inspection photos collected by field survey teams across Zimbabwe's road network
            </p>
          </div>

          <div style={{ display: "flex", gap: 10 }}>
            <div style={{ background: "rgba(0,102,51,0.08)", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 8, padding: "6px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "#006633" }}>{filtered.length}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Assets in View</div>
            </div>
            <div style={{ background: "rgba(0,0,0,0.04)", border: "1px solid var(--border)", borderRadius: 8, padding: "6px 14px", textAlign: "center" }}>
              <div style={{ fontSize: 14, fontWeight: 800, color: "var(--text-primary)" }}>{totalWithPhoto}</div>
              <div style={{ fontSize: 9.5, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Media Records</div>
            </div>
          </div>
        </div>

        {/* Filter Controls Row */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          
          {/* Search */}
          <div style={{ position: "relative", flex: "1 1 200px", minWidth: 200 }}>
            <input
              type="text"
              placeholder="Search by road, surveyor, province..."
              value={search}
              onChange={e => setSearch(e.target.value)}
              style={{
                width: "100%",
                padding: "7px 12px 7px 32px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                fontSize: 11.5,
                background: "var(--bg-app)",
                outline: "none"
              }}
            />
            <span style={{ position: "absolute", left: 10, top: "50%", transform: "translateY(-50%)", fontSize: 12, opacity: 0.5 }}>🔍</span>
            {search && (
              <button onClick={() => setSearch("")} style={{ position: "absolute", right: 8, top: "50%", transform: "translateY(-50%)", border: "none", background: "none", cursor: "pointer", fontSize: 12, color: "var(--text-muted)" }}>✕</button>
            )}
          </div>

          {/* Category Filter */}
          <select
            value={catFilter}
            onChange={e => setCatFilter(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "#fff", fontWeight: 600, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
          >
            <option value="all">All Asset Types</option>
            <option value="sealed">🛣️ Sealed Roads</option>
            <option value="gravel">🪨 Gravel Roads</option>
            <option value="earth">🚜 Earth Roads</option>
            <option value="bridge">🌉 Bridges</option>
            <option value="culvert">🕳️ Culverts</option>
            <option value="busstop">🚌 Bus Stops</option>
            <option value="junction">🔀 Junctions</option>
            <option value="sign">⚠️ Road Signs</option>
            <option value="streetlight">💡 Streetlights</option>
            <option value="traffic_lights">🚦 Traffic Lights</option>
          </select>

          {/* Condition Filter */}
          <select
            value={condFilter}
            onChange={e => setCondFilter(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "#fff", fontWeight: 600, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
          >
            <option value="all">All Conditions</option>
            <option value="good">🟢 Good</option>
            <option value="fair">🟡 Fair</option>
            <option value="poor">🔴 Poor</option>
            <option value="bad">🔴 Bad / Severely Damaged</option>
            <option value="under_construction">🔵 Under Construction</option>
          </select>

          {/* SADC Filter */}
          <select
            value={sadcFilter}
            onChange={e => setSadcFilter(e.target.value)}
            style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11.5, background: "#fff", fontWeight: 600, color: "var(--text-primary)", outline: "none", cursor: "pointer" }}
          >
            <option value="all">SADC Compliance (All)</option>
            <option value="yes">✓ SADC Compliant</option>
            <option value="no">✕ Non-Compliant</option>
          </select>

          {/* Reset Filters */}
          {(catFilter !== "all" || condFilter !== "all" || sadcFilter !== "all" || search) && (
            <button
              onClick={() => { setCatFilter("all"); setCondFilter("all"); setSadcFilter("all"); setSearch(""); }}
              style={{ padding: "7px 12px", borderRadius: 8, border: "1px solid var(--border)", background: "#fff", fontSize: 11.5, fontWeight: 700, color: "#dc2626", cursor: "pointer" }}
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Gallery Grid */}
      <div style={{ flex: 1, overflowY: "auto", padding: 24 }}>
        {filtered.length === 0 ? (
          <div style={{ textAlign: "center", padding: "60px 20px", color: "var(--text-muted)" }}>
            <Camera size={48} style={{ opacity: 0.2, marginBottom: 12 }} />
            <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>No photo assets found</div>
            <div style={{ fontSize: 12, marginTop: 4 }}>Try adjusting your search terms or filters above</div>
          </div>
        ) : (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 18 }}>
            {filtered.map(r => (
              <GalleryCard 
                key={r.id || r._id || r.survey_id || Math.random()} 
                record={r} 
                onSelectRecord={onSelectRecord} 
                onOpenLightbox={(record, photos) => setLightbox({ record, photos, index: 0 })}
              />
            ))}
          </div>
        )}
      </div>

      {/* Fullscreen Lightbox Modal */}
      {lightbox && (
        <div 
          onClick={() => setLightbox(null)}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background: "rgba(0,0,0,0.9)",
            backdropFilter: "blur(8px)",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "space-between",
            padding: 24
          }}
        >
          {/* Lightbox Top Header */}
          <div onClick={e => e.stopPropagation()} style={{ width: "100%", maxWidth: 1000, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{getAssetName(lightbox.record)}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {lightbox.record.asset_category?.replace("_", " ")} · {lightbox.record.province || "Harare"} · {lightbox.record.surveyor_name ? `Surveyor: ${lightbox.record.surveyor_name}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                onClick={() => {
                  const rec = lightbox.record;
                  setLightbox(null);
                  onSelectRecord(rec);
                }}
                style={{ background: "#006633", border: "none", borderRadius: 8, color: "#fff", padding: "8px 16px", fontWeight: 700, fontSize: 12, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
              >
                📍 Inspect on Map
              </button>
              <button
                onClick={() => setLightbox(null)}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", color: "#fff", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              >
                ✕
              </button>
            </div>
          </div>

          {/* Lightbox Main Image */}
          <div onClick={e => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 1000, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", margin: "16px 0" }}>
            <img 
              src={lightbox.photos[lightbox.index]} 
              alt="Full inspection photo"
              style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }} 
            />

            {lightbox.photos.length > 1 && (
              <>
                <button
                  onClick={() => setLightbox(prev => prev ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length } : null)}
                  style={{ position: "absolute", left: 10, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", color: "#fff", width: 44, height: 44, fontSize: 18, cursor: "pointer" }}
                >
                  ←
                </button>
                <button
                  onClick={() => setLightbox(prev => prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : null)}
                  style={{ position: "absolute", right: 10, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", color: "#fff", width: 44, height: 44, fontSize: 18, cursor: "pointer" }}
                >
                  →
                </button>
              </>
            )}
          </div>

          {/* Lightbox Footer Counter */}
          <div onClick={e => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.1)", padding: "4px 14px", borderRadius: 20 }}>
            Photo {lightbox.index + 1} of {lightbox.photos.length}
          </div>
        </div>
      )}

    </div>
  );
}



/* ═══════════════════════════════════════════════════════════════════════════
   REPORTS PAGE (NATIONAL, PROVINCIAL & DISTRICT REPORT GENERATOR)
 ════════════════════════════════════════════════════════════════════════════ */

/* ─── Comprehensive Multi-Page PDF Report Generator ──────────────────────── */
function generateWrittenPDFReport(filteredRecords: any[], reportLevel: string, province: string, district: string) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  
  const primaryGreen = [0, 102, 51];
  const goldAccent   = [217, 119, 6];
  const darkSlate    = [30, 41, 59];
  const mutedText    = [100, 116, 139];

  // Helper for Section Headers
  const addSectionHeader = (title: string, yPos: number) => {
    doc.setFillColor(0, 102, 51);
    doc.rect(14, yPos, 4, 12, "F");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(11);
    doc.setTextColor(30, 41, 59);
    doc.text(title, 22, yPos + 8.5);
  };

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 1: TITLE PAGE & EXECUTIVE SUMMARY NARRATIVE
  // ═══════════════════════════════════════════════════════════════════════════
  
  // Header Banner
  doc.setFillColor(0, 102, 51);
  doc.rect(0, 0, 210, 28, "F");

  doc.setTextColor(255, 255, 255);
  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("REPUBLIC OF ZIMBABWE", 14, 12);
  
  doc.setFontSize(9);
  doc.setFont("helvetica", "normal");
  doc.text("MINISTRY OF TRANSPORT AND INFRASTRUCTURAL DEVELOPMENT", 14, 18);
  doc.text("DEPARTMENT OF ROADS · NATIONAL ROAD INFRASTRUCTURE AUDIT UNIT", 14, 23);

  // Document Metadata Box (Top Right)
  doc.setFontSize(8);
  doc.text(`DATE: ${new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}`, 142, 12);
  doc.text(`SCOPE: ${reportLevel.toUpperCase()} AUDIT`, 142, 17);
  doc.text("DOC REF: ZIM-RD-2026-REP", 142, 22);

  // Main Report Title
  doc.setTextColor(0, 102, 51);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  const titleText = reportLevel === "national"
    ? "NATIONAL ROAD NETWORK INFRASTRUCTURE & CONDITION EVALUATION REPORT"
    : reportLevel === "provincial"
    ? `${province.toUpperCase()} PROVINCIAL ROAD NETWORK EVALUATION REPORT`
    : `${district.toUpperCase()} DISTRICT INFRASTRUCTURE AUDIT REPORT`;

  doc.text(titleText, 14, 40);

  doc.setLineWidth(0.6);
  doc.setDrawColor(217, 119, 6);
  doc.line(14, 44, 196, 44);

  // 1. Executive Summary Written Narrative
  addSectionHeader("1. EXECUTIVE SUMMARY & BACKGROUND NARRATIVE", 48);

  const total = filteredRecords.length;
  const good = filteredRecords.filter(r => getRecordStatus(r) === "good").length;
  const fair = filteredRecords.filter(r => getRecordStatus(r) === "fair").length;
  const poor = filteredRecords.filter(r => getRecordStatus(r) === "poor").length;
  const constr = filteredRecords.filter(r => getRecordStatus(r) === "under_construction").length;

  const goodPct = total > 0 ? Math.round((good / total) * 100) : 0;
  const fairPct = total > 0 ? Math.round((fair / total) * 100) : 0;
  const poorPct = total > 0 ? Math.round((poor / total) * 100) : 0;
  const sadcCount = filteredRecords.filter(r => getSadcValue(r) === "yes").length;
  const sadcPct = total > 0 ? Math.round((sadcCount / total) * 100) : 0;

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  const para1 = `1.1 Introduction: This comprehensive technical report provides an official condition assessment of the road network and associated infrastructure within the ${reportLevel.toUpperCase()} jurisdiction (${reportLevel === "national" ? "All 10 Provinces of Zimbabwe" : province + " Province"}). The evaluation encompasses a full audit of ${total} surveyed infrastructure assets, including trunk highways, feeder roads, bridges, culverts, road signs, and urban traffic management installations.`;

  const para2 = `1.2 Overall Network Health Index: Out of the total ${total} evaluated infrastructure elements, ${goodPct}% (${good} assets) are rated in Good / Optimal condition, meeting national operational standards. Approximately ${fairPct}% (${fair} assets) exhibit moderate wear and are classified in Fair condition, requiring routine scheduled preservation. Critically, ${poorPct}% (${poor} assets) display severe structural distress, pavement deterioration, or drainage impairment, requiring urgent rehabilitation intervention.`;

  const para3 = `1.3 Visual Evidence & SADC Compliance: Field telemetry teams utilized standardized mobile GIS surveying tools to capture geo-referenced imagery. SADC compliance verification indicates that ${sadcPct}% (${sadcCount} assets) possess verified compliant visual evidence adhering to regional highway safety inspection criteria.`;

  const splitP1 = doc.splitTextToSize(para1, 182);
  const splitP2 = doc.splitTextToSize(para2, 182);
  const splitP3 = doc.splitTextToSize(para3, 182);

  let curY = 65;
  doc.text(splitP1, 14, curY);
  curY += splitP1.length * 4.8 + 4;
  doc.text(splitP2, 14, curY);
  curY += splitP2.length * 4.8 + 4;
  doc.text(splitP3, 14, curY);
  curY += splitP3.length * 4.8 + 8;

  // Executive KPI Summary Table Box
  autoTable(doc, {
    startY: curY,
    head: [["Key Performance Indicator (KPI)", "Measured Metric", "Percentage", "Operational Status"]],
    body: [
      ["Total Evaluated Infrastructure Assets", `${total} Assets`, "100%", "Audit Complete"],
      ["Passable & Optimal Assets (Good)", `${good} Assets`, `${goodPct}%`, "Satisfactory"],
      ["Preservation Candidate Assets (Fair)", `${fair} Assets`, `${fairPct}%`, "Routine Maintenance Needed"],
      ["Defective / High Risk Assets (Poor)", `${poor} Assets`, `${poorPct}%`, "Urgent Intervention Needed"],
      ["Assets Under Active Construction", `${constr} Assets`, `${total > 0 ? Math.round((constr/total)*100) : 0}%`, "Capital Works In Progress"],
      ["SADC Standardized Compliant Media", `${sadcCount} Media`, `${sadcPct}%`, "Verified Compliant"],
    ],
    headStyles: { fillColor: [0, 102, 51], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 8.5, cellPadding: 2.8 },
    theme: "striped"
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 2: TECHNICAL SECTORAL ANALYSIS & INFRASTRUCTURE NARRATIVE
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();

  // Page 2 Header Banner
  doc.setFillColor(0, 102, 51);
  doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("TECHNICAL INFRASTRUCTURE EVALUATION & SECTORAL ANALYSIS", 14, 9.5);

  addSectionHeader("2. TECHNICAL SECTORAL AUDIT & CONDITION ANALYSIS", 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  const sealedCount = filteredRecords.filter(r => r.asset_category === "sealed").length;
  const gravelCount = filteredRecords.filter(r => r.asset_category === "gravel").length;
  const earthCount  = filteredRecords.filter(r => r.asset_category === "earth").length;
  const bridgeCount = filteredRecords.filter(r => r.asset_category === "bridge").length;
  const culvertCount = filteredRecords.filter(r => r.asset_category === "culvert").length;
  const safetyCount = filteredRecords.filter(r => ["sign", "traffic_lights", "streetlight"].includes(r.asset_category)).length;

  const tech1 = `2.1 Road Pavement Condition (Sealed, Gravel & Earth Networks):
The survey audited ${sealedCount} paved road sections, ${gravelCount} unpaved gravel corridors, and ${earthCount} rural earth access tracks. Sealed road distresses predominantly consist of surface oxidation, rutting along heavy transport routes, and localized edge-break. Gravel roads require periodic regravelling to restore wearing course thickness, while earth roads remain highly vulnerable to seasonal erosion and washouts.`;

  const tech2 = `2.2 Drainage & Structural Infrastructure (Bridges, Culverts & Causeways):
Structural audit results identified ${bridgeCount} major bridge structures and ${culvertCount} cross-drainage culvert installations. Drainage serviceability is a critical factor influencing pavement longevity. Unblocked culverts and intact bridge abutments maintain structural integrity, whereas sediment-clogged culverts have caused severe stormwater ponding and subgrade saturation on affected segments.`;

  const tech3 = `2.3 Road Furniture, Safety & Traffic Control Infrastructure:
A total of ${safetyCount} traffic management and safety assets were audited, including regulatory road signs, traffic signals, and streetlighting installations. Functional streetlighting and visible retroreflective signage significantly reduce night-time traffic incidents. Installations flagged as damaged or vandalized have been scheduled for immediate municipal and departmental restoration.`;

  const splitT1 = doc.splitTextToSize(tech1, 182);
  const splitT2 = doc.splitTextToSize(tech2, 182);
  const splitT3 = doc.splitTextToSize(tech3, 182);

  let curY2 = 36;
  doc.text(splitT1, 14, curY2);
  curY2 += splitT1.length * 4.8 + 6;
  doc.text(splitT2, 14, curY2);
  curY2 += splitT2.length * 4.8 + 6;
  doc.text(splitT3, 14, curY2);
  curY2 += splitT3.length * 4.8 + 8;

  // Sectoral Summary Table
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.text("2.4 Asset Category Scorecard & Maintenance Priority", 14, curY2);
  curY2 += 4;

  const categoriesList = ["sealed", "gravel", "earth", "bridge", "culvert", "busstop", "junction", "sign", "traffic_lights", "streetlight"];
  const scorecardBody = categoriesList.map(c => {
    const sub = filteredRecords.filter(r => r.asset_category === c);
    const cTotal = sub.length;
    const cGood  = sub.filter(r => getRecordStatus(r) === "good").length;
    const cPoor  = sub.filter(r => getRecordStatus(r) === "poor").length;
    const cSadc  = sub.filter(r => getSadcValue(r) === "yes").length;
    return [
      c.replace("_", " ").toUpperCase(),
      cTotal.toString(),
      cGood.toString(),
      cPoor.toString(),
      cTotal > 0 ? `${Math.round((cSadc / cTotal) * 100)}%` : "N/A",
      cPoor > 0 ? "REHABILITATION PRIORITY" : "ROUTINE PRESERVATION"
    ];
  }).filter(row => row[1] !== "0");

  autoTable(doc, {
    startY: curY2,
    head: [["Asset Category", "Total Count", "Good Condition", "Poor / Damaged", "SADC Rate %", "Recommended Strategy"]],
    body: scorecardBody,
    headStyles: { fillColor: [30, 41, 59], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 8, cellPadding: 2.2 },
    theme: "grid"
  });

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 3: STRATEGIC MAINTENANCE RECOMMENDATIONS & SIGN-OFF
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();

  // Page 3 Header Banner
  doc.setFillColor(0, 102, 51);
  doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("STRATEGIC RECOMMENDATIONS & OFFICIAL SIGN-OFF", 14, 9.5);

  addSectionHeader("3. STRATEGIC INTERVENTION & CAPITAL WORK PRIORITIES", 20);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(9.5);
  doc.setTextColor(30, 41, 59);

  const rec1 = `3.1 Priority 1 (Emergency Structural Repairs & Safety Hazard Remediation):
Immediate financial and engineering resources must be allocated to repair the ${poor} assets flagged in Poor/Bad condition. High-priority interventions include culvert desilting along flood-prone arterial corridors, bridge expansion joint repairs, and replacing missing warning signage along major trunk routes.`;

  const rec2 = `3.2 Priority 2 (Periodic Resurfacing & Pothole Patching Programs):
For the ${fair} assets categorized in Fair condition, routine asphalt overlay, pothole patching, and shoulder grading programs must be executed within the next 6 to 12 months to prevent further structural degradation into severe pavement failure.`;

  const rec3 = `3.3 Priority 3 (GIS Telemetry Expansion & Continuous Monitoring):
Expand regular field telemetry collection across all provincial road authorities using standardized mobile GIS tools. Maintain 100% SADC image compliance logging to ensure robust auditability for national infrastructure budgeting.`;

  const splitR1 = doc.splitTextToSize(rec1, 182);
  const splitR2 = doc.splitTextToSize(rec2, 182);
  const splitR3 = doc.splitTextToSize(rec3, 182);

  let curY3 = 36;
  doc.text(splitR1, 14, curY3);
  curY3 += splitR1.length * 4.8 + 6;
  doc.text(splitR2, 14, curY3);
  curY3 += splitR2.length * 4.8 + 6;
  doc.text(splitR3, 14, curY3);
  curY3 += splitR3.length * 4.8 + 12;

  // Official Certification & Sign-off Block
  doc.setFillColor(250, 252, 251);
  doc.rect(14, curY3, 182, 60, "F");
  doc.setLineWidth(0.4);
  doc.setDrawColor(0, 102, 51);
  doc.rect(14, curY3, 182, 60, "S");

  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 102, 51);
  doc.text("4. OFFICIAL REPORT CERTIFICATION & AUDIT SIGN-OFF", 18, curY3 + 10);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(8.5);
  doc.setTextColor(30, 41, 59);
  doc.text("I hereby certify that this Infrastructure Evaluation Report reflects genuine field survey telemetry and condition assessments conducted in accordance with Ministry of Transport & Infrastructural Development auditing standards.", 18, curY3 + 18, { maxWidth: 174 });

  // Signature Lines
  const sigY = curY3 + 45;
  
  // Sig 1
  doc.setLineWidth(0.4);
  doc.setDrawColor(30, 41, 59);
  doc.line(22, sigY, 70, sigY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Eng. T. Moyo", 22, sigY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Chief Roads Engineer (Audit)", 22, sigY + 8);

  // Sig 2
  doc.line(82, sigY, 130, sigY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Eng. R. Ndlovu", 82, sigY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Director of Maintenance", 82, sigY + 8);

  // Sig 3
  doc.line(142, sigY, 190, sigY);
  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.text("Dr. K. Gumbo", 142, sigY + 4);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(7.5);
  doc.text("Permanent Secretary", 142, sigY + 8);

  // ═══════════════════════════════════════════════════════════════════════════
  // PAGE 4+: COMPLETE DETAILED INFRASTRUCTURE ASSET REGISTER
  // ═══════════════════════════════════════════════════════════════════════════
  doc.addPage();

  doc.setFillColor(0, 102, 51);
  doc.rect(0, 0, 210, 14, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(9);
  doc.setFont("helvetica", "bold");
  doc.text("ANNEXURE A: COMPLETE INFRASTRUCTURE ASSET AUDIT REGISTER", 14, 9.5);

  const fullRegisterData = filteredRecords.map(r => [
    (r.asset_category || "other").replace("_", " ").toUpperCase(),
    getAssetName(r),
    r.section_name || "N/A",
    r.province || "Harare",
    r.district || "Central",
    formatStatusLabel(getRecordStatus(r)).toUpperCase(),
    r.surveyor_name || "N/A",
    r.survey_date || "N/A",
    r.gps || formatGpsLabel(r)
  ]);

  autoTable(doc, {
    startY: 20,
    head: [["Category", "Asset Name / Route", "Section", "Province", "District", "Condition", "Surveyor", "Date", "GPS Coords"]],
    body: fullRegisterData,
    headStyles: { fillColor: [0, 102, 51], textColor: [255, 255, 255], fontStyle: "bold" },
    styles: { fontSize: 7, cellPadding: 2 },
    theme: "grid"
  });

  // Global Page Footer for All Pages
  const totalPageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= totalPageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text(`Ministry of Transport & Infrastructural Development · Department of Roads · Page ${i} of ${totalPageCount}`, 14, 288);
  }

  doc.save(`Comprehensive_Road_Condition_Report_${reportLevel}_${Date.now()}.pdf`);
}


function ReportsPage({ records, onSelectRecord }: { records: any[]; onSelectRecord?: (r: any) => void }) {
  // Report scope & filter state
  const [reportLevel, setReportLevel] = useState<"national" | "provincial" | "district">("national");
  const [selectedProvince, setSelectedProvince] = useState<string>("Harare");
  const [selectedDistrict, setSelectedDistrict] = useState<string>("all");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [selectedCondition, setSelectedCondition] = useState<string>("all");
  const [selectedRoad, setSelectedRoad] = useState<string>("all");
  const [page, setPage] = useState(0);
  const PAGE_SIZE = 12;

  // Extract unique options
  const provinces = Array.from(new Set(records.map(r => r.province).filter(Boolean))).sort();
  const districtsForProv = Array.from(new Set(
    records
      .filter(r => selectedProvince === "all" || r.province === selectedProvince)
      .map(r => r.district)
      .filter(Boolean)
  )).sort();
  const roadsList = Array.from(new Set(records.map(r => r.road_name).filter(Boolean))).sort();

  // Filter records based on selected report parameters
  const filtered = records.filter(r => {
    if (reportLevel === "provincial" && selectedProvince !== "all" && r.province !== selectedProvince) return false;
    if (reportLevel === "district") {
      if (selectedProvince !== "all" && r.province !== selectedProvince) return false;
      if (selectedDistrict !== "all" && r.district !== selectedDistrict) return false;
    }
    if (selectedCategory !== "all" && r.asset_category !== selectedCategory) return false;
    if (selectedCondition !== "all" && getRecordStatus(r) !== selectedCondition) return false;
    if (selectedRoad !== "all" && r.road_name !== selectedRoad) return false;
    return true;
  });

  // Calculate Key Summary Metrics
  const totalAssets = filtered.length;
  const goodCount = filtered.filter(r => getRecordStatus(r) === "good").length;
  const fairCount = filtered.filter(r => getRecordStatus(r) === "fair").length;
  const poorCount = filtered.filter(r => getRecordStatus(r) === "poor").length;
  const constrCount = filtered.filter(r => getRecordStatus(r) === "under_construction").length;

  const goodPct = totalAssets > 0 ? Math.round((goodCount / totalAssets) * 100) : 0;
  const fairPct = totalAssets > 0 ? Math.round((fairCount / totalAssets) * 100) : 0;
  const poorPct = totalAssets > 0 ? Math.round((poorCount / totalAssets) * 100) : 0;

  const sadcCompliant = filtered.filter(r => getSadcValue(r) === "yes").length;
  const sadcPct = totalAssets > 0 ? Math.round((sadcCompliant / totalAssets) * 100) : 0;

  // Chart Data: Condition Breakdown by Asset Category
  const catMap: Record<string, { good: number; fair: number; poor: number; total: number }> = {};
  filtered.forEach(r => {
    const c = r.asset_category || "other";
    if (!catMap[c]) catMap[c] = { good: 0, fair: 0, poor: 0, total: 0 };
    catMap[c].total += 1;
    const s = getRecordStatus(r);
    if (s === "good") catMap[c].good += 1;
    else if (s === "fair") catMap[c].fair += 1;
    else catMap[c].poor += 1;
  });

  const categoryChartData = Object.entries(catMap).map(([cat, val]) => ({
    name: cat.replace("_", " ").toUpperCase(),
    Good: val.good,
    Fair: val.fair,
    "Poor / Bad": val.poor,
    Total: val.total
  })).sort((a, b) => b.Total - a.Total).slice(0, 8);

  // Chart Data: Condition Distribution Pie
  const conditionPieData = [
    { name: "Good", value: goodCount, color: "#006633" },
    { name: "Fair", value: fairCount, color: "#d97706" },
    { name: "Poor / Bad", value: poorCount, color: "#dc2626" },
    { name: "Under Construction", value: constrCount, color: "#2563eb" },
  ].filter(d => d.value > 0);

  // Print Report Handler
  const handlePrint = () => {
    window.print();
  };

  // CSV Export Handler
  const handleExportCSV = () => {
    const keys = ["asset_category", "road_name", "section_name", "province", "district", "road_condition", "surveyor_name", "survey_date", "gps_point"];
    const header = keys.map(k => k.replace("_", " ").toUpperCase()).join(",");
    const rows = filtered.map(r => keys.map(k => `"${String(r[k] || "").replace(/"/g, '""')}"`).join(","));
    const csvContent = "data:text/csv;charset=utf-8," + [header, ...rows].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `road_condition_report_${reportLevel}_${Date.now()}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageSlice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <div style={{ height: "100%", display: "flex", flexDirection: "column", background: "var(--bg-app)", overflow: "hidden" }}>
      
      {/* Report Controls Header */}
      <div style={{ background: "#fff", borderBottom: "1px solid var(--border)", padding: "14px 24px", flexShrink: 0, display: "flex", flexDirection: "column", gap: 12 }}>
        
        {/* Top Title & Primary Actions */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: 12 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)", margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
              <span>📑</span> Comprehensive Road Condition Report Generator
            </h2>
            <p style={{ fontSize: 11, color: "var(--text-secondary)", margin: "2px 0 0 0" }}>
              Official executive evaluation reports for National, Provincial, and District road networks
            </p>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button
              onClick={() => generateWrittenPDFReport(filtered, reportLevel, selectedProvince, selectedDistrict)}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#006633",
                color: "#fff",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6,
                boxShadow: "0 2px 6px rgba(0,102,51,0.25)"
              }}
            >
              <span>📄</span> Download Written PDF Report
            </button>

            <button
              onClick={handlePrint}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "1px solid var(--border)",
                background: "#fff",
                color: "var(--text-primary)",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>🖨️</span> Print Formal Report
            </button>

            <button
              onClick={handleExportCSV}
              style={{
                padding: "8px 16px",
                borderRadius: 8,
                border: "none",
                background: "#006633",
                color: "#fff",
                fontSize: 11.5,
                fontWeight: 700,
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                gap: 6
              }}
            >
              <span>📥</span> Export Report CSV
            </button>
          </div>
        </div>

        {/* Report Scope & Parameters Bar */}
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center", background: "var(--bg-app)", padding: 10, borderRadius: 10, border: "1px solid var(--border)" }}>
          
          {/* Level Switcher Buttons */}
          <div style={{ display: "flex", background: "#fff", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
            <button
              onClick={() => { setReportLevel("national"); setSelectedProvince("all"); setSelectedDistrict("all"); }}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                background: reportLevel === "national" ? "#006633" : "transparent",
                color: reportLevel === "national" ? "#fff" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              🇿🇼 National Report
            </button>
            <button
              onClick={() => { setReportLevel("provincial"); if (selectedProvince === "all" && provinces.length > 0) setSelectedProvince(provinces[0]); }}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                background: reportLevel === "provincial" ? "#006633" : "transparent",
                color: reportLevel === "provincial" ? "#fff" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              🏛️ Provincial Report
            </button>
            <button
              onClick={() => { setReportLevel("district"); if (selectedProvince === "all" && provinces.length > 0) setSelectedProvince(provinces[0]); }}
              style={{
                padding: "5px 12px",
                borderRadius: 6,
                border: "none",
                background: reportLevel === "district" ? "#006633" : "transparent",
                color: reportLevel === "district" ? "#fff" : "var(--text-secondary)",
                fontSize: 11,
                fontWeight: 700,
                cursor: "pointer"
              }}
            >
              📍 District Report
            </button>
          </div>

          {/* Province Dropdown */}
          {(reportLevel === "provincial" || reportLevel === "district") && (
            <select
              value={selectedProvince}
              onChange={e => { setSelectedProvince(e.target.value); setSelectedDistrict("all"); }}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, background: "#fff", fontWeight: 700, color: "var(--text-primary)", outline: "none" }}
            >
              <option value="all">All Provinces</option>
              {provinces.map(p => (
                <option key={p} value={p}>{p} Province</option>
              ))}
            </select>
          )}

          {/* District Dropdown */}
          {reportLevel === "district" && (
            <select
              value={selectedDistrict}
              onChange={e => setSelectedDistrict(e.target.value)}
              style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, background: "#fff", fontWeight: 700, color: "var(--text-primary)", outline: "none" }}
            >
              <option value="all">All Districts in {selectedProvince}</option>
              {districtsForProv.map(d => (
                <option key={d} value={d}>{d} District</option>
              ))}
            </select>
          )}

          {/* Asset Category Filter */}
          <select
            value={selectedCategory}
            onChange={e => setSelectedCategory(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, background: "#fff", fontWeight: 600, color: "var(--text-primary)", outline: "none" }}
          >
            <option value="all">All Asset Categories</option>
            <option value="sealed">🛣️ Sealed Roads</option>
            <option value="gravel">🪨 Gravel Roads</option>
            <option value="earth">🚜 Earth Roads</option>
            <option value="bridge">🌉 Bridges</option>
            <option value="culvert">🕳️ Culverts</option>
            <option value="busstop">🚌 Bus Stops</option>
            <option value="junction">🔀 Junctions</option>
            <option value="sign">⚠️ Signs</option>
            <option value="traffic_lights">🚦 Traffic Lights</option>
          </select>

          {/* Condition Filter */}
          <select
            value={selectedCondition}
            onChange={e => setSelectedCondition(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, background: "#fff", fontWeight: 600, color: "var(--text-primary)", outline: "none" }}
          >
            <option value="all">All Condition Ratings</option>
            <option value="good">🟢 Good</option>
            <option value="fair">🟡 Fair</option>
            <option value="poor">🔴 Poor / Bad</option>
          </select>

          {/* Road Route Filter */}
          <select
            value={selectedRoad}
            onChange={e => setSelectedRoad(e.target.value)}
            style={{ padding: "6px 12px", borderRadius: 8, border: "1px solid var(--border)", fontSize: 11, background: "#fff", fontWeight: 600, color: "var(--text-primary)", outline: "none", maxWidth: 180 }}
          >
            <option value="all">All Highway Routes</option>
            {roadsList.map(r => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Report Document Workspace */}
      <div style={{ flex: 1, overflowY: "auto", padding: "24px 32px" }}>
        
        {/* Printable Official Document Sheet */}
        <div style={{
          background: "#fff",
          borderRadius: 12,
          border: "1px solid var(--border)",
          boxShadow: "0 4px 20px rgba(0,0,0,0.06)",
          padding: "36px 40px",
          maxWidth: 1100,
          margin: "0 auto",
          fontFamily: "var(--font-body)"
        }}>
          
          {/* Document Official Header */}
          <div style={{ borderBottom: "3px double #006633", paddingBottom: 20, marginBottom: 24, display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
              <img src="/coat_of_arms.png" alt="Coat of Arms" style={{ width: 64, height: 64, objectFit: "contain" }} />
              <div>
                <div style={{ fontSize: 16, fontWeight: 900, color: "#006633", letterSpacing: "0.5px" }}>REPUBLIC OF ZIMBABWE</div>
                <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>MINISTRY OF TRANSPORT &amp; INFRASTRUCTURAL DEVELOPMENT</div>
                <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Department of Roads · National Infrastructure Audit Unit</div>
              </div>
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ background: "rgba(0,102,51,0.08)", color: "#006633", fontSize: 11, fontWeight: 800, padding: "4px 12px", borderRadius: 6, display: "inline-block", marginBottom: 4 }}>
                OFFICIAL REPORT
              </div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Date: {new Date().toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" })}</div>
              <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Scope: {reportLevel.toUpperCase()} LEVEL AUDIT</div>
            </div>
          </div>

          {/* Report Title */}
          <div style={{ marginBottom: 24 }}>
            <h1 style={{ fontSize: 20, fontWeight: 800, color: "var(--text-primary)", margin: 0 }}>
              {reportLevel === "national" && "ZIMBABWE NATIONAL ROAD NETWORK CONDITION REPORT"}
              {reportLevel === "provincial" && `${selectedProvince.toUpperCase()} PROVINCIAL ROAD CONDITION REPORT`}
              {reportLevel === "district" && `${selectedDistrict.toUpperCase()} DISTRICT ROAD CONDITION REPORT`}
            </h1>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 4 }}>
              Comprehensive infrastructure survey analysis, condition index evaluation, and visual audit metrics
            </div>
          </div>

          {/* Executive Summary Cards Grid */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 28 }}>
            
            <div style={{ background: "rgba(0,102,51,0.04)", border: "1px solid rgba(0,102,51,0.15)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-secondary)", textTransform: "uppercase" }}>Total Assets Evaluated</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#006633", marginTop: 4 }}>{totalAssets.toLocaleString()}</div>
              <div style={{ fontSize: 9.5, color: "var(--text-muted)", marginTop: 2 }}>Across surveyed routes</div>
            </div>

            <div style={{ background: "rgba(16,185,129,0.06)", border: "1px solid rgba(16,185,129,0.2)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>Good Condition Rate</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#047857", marginTop: 4 }}>{goodPct}% <span style={{ fontSize: 13, fontWeight: 700 }}>({goodCount})</span></div>
              <div style={{ fontSize: 9.5, color: "#047857", marginTop: 2 }}>Passable &amp; Optimal</div>
            </div>

            <div style={{ background: "rgba(220,38,38,0.06)", border: "1px solid rgba(220,38,38,0.2)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#b91c1c", textTransform: "uppercase" }}>Poor / Defective Rate</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#b91c1c", marginTop: 4 }}>{poorPct}% <span style={{ fontSize: 13, fontWeight: 700 }}>({poorCount})</span></div>
              <div style={{ fontSize: 9.5, color: "#b91c1c", marginTop: 2 }}>Requires Urgent Intervention</div>
            </div>

            <div style={{ background: "rgba(37,99,235,0.06)", border: "1px solid rgba(37,99,235,0.2)", borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase" }}>SADC Compliance</div>
              <div style={{ fontSize: 22, fontWeight: 900, color: "#1d4ed8", marginTop: 4 }}>{sadcPct}% <span style={{ fontSize: 13, fontWeight: 700 }}>({sadcCompliant})</span></div>
              <div style={{ fontSize: 9.5, color: "#1d4ed8", marginTop: 2 }}>Compliant image evidence</div>
            </div>

          </div>

          {/* Visual Analytics Charts Section */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20, marginBottom: 32 }}>
            
            {/* Chart 1: Bar Chart */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 18, background: "#fafcfb" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
                📊 Asset Condition Breakdown by Category
              </div>
              <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={categoryChartData}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="rgba(0,0,0,0.06)" />
                    <XAxis dataKey="name" tick={{ fontSize: 8.5 }} />
                    <YAxis tick={{ fontSize: 9 }} />
                    <ChartTooltip />
                    <Legend wrapperStyle={{ fontSize: 10 }} />
                    <Bar dataKey="Good" stackId="a" fill="#006633" />
                    <Bar dataKey="Fair" stackId="a" fill="#d97706" />
                    <Bar dataKey="Poor / Bad" stackId="a" fill="#dc2626" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>

            {/* Chart 2: Pie Chart */}
            <div style={{ border: "1px solid var(--border)", borderRadius: 10, padding: 18, background: "#fafcfb" }}>
              <div style={{ fontSize: 12, fontWeight: 800, color: "var(--text-primary)", marginBottom: 12 }}>
                🎯 Overall Condition Rating Share
              </div>
              <div style={{ height: 220, display: "flex", alignItems: "center" }}>
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={conditionPieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={75} label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}>
                      {conditionPieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <ChartTooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>

          </div>

          {/* Asset Audit Register Table */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 800, color: "var(--text-primary)" }}>
                📋 Detailed Asset Audit Register ({filtered.length} items)
              </div>
              <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
                Page {page + 1} of {pages || 1}
              </div>
            </div>

            <div style={{ border: "1px solid var(--border)", borderRadius: 8, overflow: "hidden" }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5, textAlign: "left" }}>
                <thead>
                  <tr style={{ background: "rgba(0,102,51,0.06)", borderBottom: "1px solid var(--border)" }}>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Asset Type</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Road Route Name</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Province / District</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Condition</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>Surveyor</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700 }}>GPS Coords</th>
                    <th style={{ padding: "8px 12px", fontWeight: 700, textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {pageSlice.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ padding: 24, textAlign: "center", color: "var(--text-muted)" }}>No assets match the selected report criteria</td>
                    </tr>
                  ) : (
                    pageSlice.map((r, idx) => {
                      const st = getRecordStatus(r);
                      const col = getStatusColor(st);
                      return (
                        <tr key={idx} style={{ borderBottom: "1px solid var(--border)", background: idx % 2 === 0 ? "#fff" : "#fafcfb" }}>
                          <td style={{ padding: "8px 12px", fontWeight: 700, textTransform: "capitalize" }}>{r.asset_category?.replace("_", " ")}</td>
                          <td style={{ padding: "8px 12px", fontWeight: 600 }}>{getAssetName(r)}</td>
                          <td style={{ padding: "8px 12px" }}>{r.province || "Harare"} · {r.district || "District"}</td>
                          <td style={{ padding: "8px 12px" }}>
                            <span style={{ background: col, color: "#fff", padding: "2px 6px", borderRadius: 10, fontSize: 9, fontWeight: 700, textTransform: "uppercase" }}>
                              {formatStatusLabel(st)}
                            </span>
                          </td>
                          <td style={{ padding: "8px 12px" }}>{r.surveyor_name || "N/A"}</td>
                          <td style={{ padding: "8px 12px", fontFamily: "monospace", fontSize: 9.5 }}>{r.gps || formatGpsLabel(r)}</td>
                          <td style={{ padding: "8px 12px", textAlign: "right" }}>
                            {onSelectRecord && (
                              <button
                                onClick={() => onSelectRecord(r)}
                                style={{ background: "#006633", border: "none", color: "#fff", padding: "3px 8px", borderRadius: 4, fontSize: 9.5, fontWeight: 700, cursor: "pointer" }}
                              >
                                📍 Map
                              </button>
                            )}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>

            {/* Pagination Controls */}
            {pages > 1 && (
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 12 }}>
                <button
                  onClick={() => setPage(p => Math.max(0, p - 1))}
                  disabled={page === 0}
                  style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                >
                  ← Previous
                </button>
                <span style={{ fontSize: 10.5, color: "var(--text-secondary)" }}>
                  Showing {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, filtered.length)} of {filtered.length}
                </span>
                <button
                  onClick={() => setPage(p => Math.min(pages - 1, p + 1))}
                  disabled={page >= pages - 1}
                  style={{ padding: "4px 12px", borderRadius: 6, border: "1px solid var(--border)", background: "#fff", fontSize: 10.5, fontWeight: 700, cursor: "pointer" }}
                >
                  Next →
                </button>
              </div>
            )}
          </div>

          {/* Official Sign-off Footer */}
          <div style={{ borderTop: "1px solid var(--border)", paddingTop: 16, marginTop: 24, display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>
              Report Generated by Roads Department Survey Platform · Ministry of Transport &amp; Infrastructural Development
            </div>
            <div style={{ textAlign: "right" }}>
              <div style={{ borderBottom: "1px solid var(--text-primary)", width: 160, marginBottom: 4 }} />
              <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-primary)" }}>Chief Roads Engineer</div>
              <div style={{ fontSize: 9, color: "var(--text-secondary)" }}>National Infrastructure Quality Assurance</div>
            </div>
          </div>

        </div>

      </div>

    </div>
  );
}

