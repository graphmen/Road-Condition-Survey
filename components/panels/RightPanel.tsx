"use client";
import React from "react";
import { ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip,
} from "recharts";
import { getRecordStatus, getAssetType, getAssetName, getSadcValue } from "@/components/helpers";

interface RightPanelProps {
  records: any[];
  onSelectRecord?: (r: any) => void;
}

const HIGHWAYS = ["A1", "A2", "A3", "A4", "A5"];

function hwCount(records: any[], id: string) {
  return records.filter(r => (r.road_name ?? "").includes(id)).length;
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
  "uuid",
  "photo",
  "photos",
]);

const formatKey = (key: string): string => {
  return key
    .replace(/_/g, " ")
    .replace(/\b\w/g, c => c.toUpperCase());
};

export default function RightPanel({ records, onSelectRecord }: RightPanelProps) {
  const total = records.length;
  const good  = records.filter(r => getRecordStatus(r) === "good").length;
  const fair  = records.filter(r => getRecordStatus(r) === "fair").length;
  const poor  = records.filter(r => getRecordStatus(r) === "poor").length;
  const mixed = records.filter(r => getRecordStatus(r) === "mixed").length;
  const underConstruction = records.filter(r => getRecordStatus(r) === "under_construction").length;

  const condData = [
    { name: "Good", value: good, color: "#006633" },
    { name: "Fair", value: fair, color: "#f59e0b" },
    { name: "Poor", value: poor, color: "#dc2626" },
    { name: "Mixed", value: mixed, color: "#7c3aed" },
    { name: "Under construction", value: underConstruction, color: "#2563eb" },
  ].filter(d => d.value > 0);

  const hwData = HIGHWAYS.map(id => ({
    name: id,
    assets: hwCount(records, id),
  })).filter(d => d.assets > 0);

  const compliant    = records.filter(r => getSadcValue(r) === "yes").length;
  const nonCompliant = records.filter(r => getSadcValue(r) === "no").length;
  const sadcMixed    = records.filter(r => getSadcValue(r) === "mixed").length;

  const topPoor = records.filter(r => getRecordStatus(r) === "poor").slice(0, 5);

  return (
    <>
      {/* Network Snapshot */}
      <div className="snapshot-strip">
        <div className="snap-stat">
          <div className="snap-num">{total}</div>
          <div className="snap-lbl">Total</div>
        </div>
        <div className="snap-divider" />
        <div className="snap-stat">
          <div className="snap-num">{good}</div>
          <div className="snap-lbl">Good</div>
        </div>
        <div className="snap-divider" />
        <div className="snap-stat">
          <div className="snap-num">{fair}</div>
          <div className="snap-lbl">Fair</div>
        </div>
        <div className="snap-divider" />
        <div className="snap-stat">
          <div className="snap-num" style={{ color: poor > 0 ? "#FFD100" : "#fff" }}>{poor}</div>
          <div className="snap-lbl">Poor</div>
        </div>
      </div>

      <div className="right-panel-body">
        <div>
          <div className="section-label">Condition Distribution</div>
          <div className="analytics-card" style={{ marginTop: 8 }}>
            <div style={{ height: 170 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={condData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={65} innerRadius={30} paddingAngle={3}>
                    {condData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {[{ label: "Good", val: good, color: "#006633" }, { label: "Fair", val: fair, color: "#f59e0b" }, { label: "Poor", val: poor, color: "#dc2626" }, { label: "Mixed", val: mixed, color: "#7c3aed" }, { label: "UC", val: underConstruction, color: "#2563eb" }].filter(row => row.val > 0 || ["Good","Fair","Poor"].includes(row.label)).map(row => (
              <div className="progress-row" key={row.label}>
                <div className="progress-label-row">
                  <span>{row.label}</span>
                  <span style={{ fontWeight: 700, color: row.color }}>{total ? Math.round(row.val / total * 100) : 0}%</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: total ? `${row.val / total * 100}%` : "0%", background: row.color }} />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* --- Highway Breakdown --------------------------------- */}
        {hwData.length > 0 && (
          <div>
            <div className="section-label">Highway Asset Count</div>
            <div className="analytics-card" style={{ marginTop: 8 }}>
              <div style={{ height: 150 }}>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hwData} margin={{ left: -15, right: 5, top: 5, bottom: 0 }}>
                    <XAxis dataKey="name" fontSize={10} tick={{ fill: "#3d5a48" }} tickLine={false} />
                    <YAxis fontSize={9} tick={{ fill: "#6b8072" }} tickLine={false} />
                    <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--border)" }} />
                    <Bar dataKey="assets" name="Assets" fill="#006633" radius={[4, 4, 0, 0]} barSize={26} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}

        {/* --- SADC Compliance ----------------------------------- */}
        <div>
          <div className="section-label">SADC Sign Compliance</div>
          <div className="analytics-card" style={{ marginTop: 8 }}>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ label: "Compliant", val: compliant, color: "#006633" }, { label: "Non-Compliant", val: nonCompliant, color: "#dc2626" }, { label: "Mixed", val: sadcMixed, color: "#7c3aed" }].map(s => (
                <div key={s.label} style={{ flex: 1, background: "var(--bg-app)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 8px", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-title)", fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* --- Top Poor Assets ----------------------------------- */}
        {topPoor.length > 0 && (
          <div>
            <div className="section-label">⚠️ Poor Condition Assets</div>
            <div className="analytics-card" style={{ marginTop: 8, padding: "8px 10px" }}>
              {topPoor.map((r, i) => (
                <button
                  key={i}
                  type="button"
                  className="poor-asset-row"
                  onClick={() => onSelectRecord?.(r)}
                >
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{getAssetName(r)}</div>
                    <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{(r.road_name ?? "—").split(" (")[0]}</div>
                  </div>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* --- System Actions ------------------------------------ */}
        <div>
          <div className="section-label">System Actions</div>
          <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 7 }}>
            <button
              style={{ background: "var(--bg-app)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "9px 12px", fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-body)", transition: "all 0.15s" }}
              onMouseOver={e => (e.currentTarget.style.borderColor = "var(--green)")}
              onMouseOut={e => (e.currentTarget.style.borderColor = "var(--border)")}
              onClick={() => {
                // Gather all unique keys across all records
                const allKeysSet = new Set<string>();
                records.forEach(r => {
                  Object.keys(r).forEach(k => {
                    if (!EXCLUDED_KEYS.has(k)) {
                      allKeysSet.add(k);
                    }
                  });
                });
                
                // Define standard columns at the beginning
                const leadColumns = ["asset_name", "asset_type", "condition", "latitude", "longitude"];
                const otherKeys = Array.from(allKeysSet).filter(k => !leadColumns.includes(k));
                const headers = [...leadColumns, ...otherKeys];
                
                // Build CSV lines
                const rows = records.map(r => {
                  return headers.map(header => {
                    let val = "";
                    if (header === "asset_name") val = getAssetName(r);
                    else if (header === "asset_type") val = getAssetType(r);
                    else if (header === "condition") val = getRecordStatus(r);
                    else if (header === "latitude") val = r._geolocation?.[0] ?? "";
                    else if (header === "longitude") val = r._geolocation?.[1] ?? "";
                    else val = r[header] ?? "";
                    
                    // Escape CSV values
                    const cell = String(val).replace(/"/g, '""');
                    return `"${cell}"`;
                  }).join(",");
                });
                
                const csv = [headers.map(h => formatKey(h)).join(","), ...rows].join("\n");
                const a = document.createElement("a");
                a.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8;" }));
                a.download = "roads_full_export.csv";
                a.click();
              }}
            >
              Export Full Dataset (CSV) <ChevronRight size={13} />
            </button>
            <button
              style={{ background: "#dc2626", border: "none", borderRadius: "var(--radius-md)", padding: "9px 12px", fontSize: 11, fontWeight: 700, color: "#ffffff", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "space-between", fontFamily: "var(--font-body)", opacity: 0.85, transition: "opacity 0.15s" }}
              onMouseOver={e => (e.currentTarget.style.opacity = "1")}
              onMouseOut={e => (e.currentTarget.style.opacity = "0.85")}
            >
              Archive Records <ChevronRight size={13} />
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
