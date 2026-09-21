"use client";

import { useMemo, useState } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend,
} from "recharts";
import {
  getRecordStatus, getAssetType, getAssetName, formatGpsLabel,
} from "@/components/helpers";
import { HIGHWAY_CORRIDORS, groupRecordsByHighway } from "@/lib/highways";

const CHART_TOOLTIP = {
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid var(--border)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

function condCounts(rows: any[]) {
  let good = 0, fair = 0, poor = 0, mixed = 0, uc = 0;
  for (const r of rows) {
    const s = getRecordStatus(r);
    if (s === "good") good += 1;
    else if (s === "fair") fair += 1;
    else if (s === "poor") poor += 1;
    else if (s === "mixed") mixed += 1;
    else if (s === "under_construction") uc += 1;
  }
  return { good, fair, poor, mixed, uc, total: rows.length };
}

function typeCounts(rows: any[]) {
  const map = new Map<string, number>();
  for (const r of rows) {
    const t = getAssetType(r) || "Asset";
    map.set(t, (map.get(t) || 0) + 1);
  }
  return Array.from(map.entries())
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

function sectionRows(rows: any[]) {
  const map = new Map<string, { count: number; poor: number; last: string }>();
  for (const r of rows) {
    const name = String(r.section_name || "").trim() || "Unnamed section";
    const cur = map.get(name) || { count: 0, poor: 0, last: "" };
    cur.count += 1;
    if (getRecordStatus(r) === "poor") cur.poor += 1;
    const d = String(r.survey_date || "");
    if (d && d > cur.last) cur.last = d;
    map.set(name, cur);
  }
  return Array.from(map.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count);
}

export default function HighwaysPage({
  records,
  onSelectRecord,
}: {
  records: any[];
  onSelectRecord?: (r: any) => void;
}) {
  const grouped = useMemo(() => groupRecordsByHighway(records), [records]);

  const corridors = useMemo(() => {
    return HIGHWAY_CORRIDORS.map((h) => {
      const rows = grouped[h.id] || [];
      const c = condCounts(rows);
      return {
        ...h,
        rows,
        ...c,
        goodPct: c.total ? Math.round((c.good / c.total) * 100) : 0,
        poorPct: c.total ? Math.round((c.poor / c.total) * 100) : 0,
        types: typeCounts(rows),
        sections: sectionRows(rows),
        poorAssets: rows.filter((r) => getRecordStatus(r) === "poor"),
      };
    });
  }, [grouped]);

  const matched = corridors.reduce((n, h) => n + h.total, 0);
  const worst = [...corridors].filter((h) => h.total >= 20).sort((a, b) => b.poorPct - a.poorPct)[0]
    || [...corridors].filter((h) => h.total > 0).sort((a, b) => b.poorPct - a.poorPct)[0];
  const busiest = [...corridors].sort((a, b) => b.total - a.total)[0];

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeId = selectedId || busiest?.id || "A1";
  const selected = corridors.find((h) => h.id === activeId) || corridors[0];

  const showOnMap = (record: any) => {
    if (onSelectRecord) onSelectRecord(record);
  };

  const viewCorridor = () => {
    const withGps = selected.rows.find((r) => formatGpsLabel(r));
    if (withGps) showOnMap(withGps);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg-app)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <Kpi num={matched.toLocaleString()} label="On A-class network" sub={`${records.length.toLocaleString()} total records`} />
        <Kpi num={busiest?.id || "—"} label="Most surveyed" sub={busiest ? `${busiest.total} assets · ${busiest.name}` : ""} />
        <Kpi num={worst?.id || "—"} label="Highest poor share" color="#dc2626" sub={worst ? `${worst.poorPct}% poor · ${worst.poor} assets` : ""} />
        <Kpi num={`${corridors.reduce((n, h) => n + h.poor, 0)}`} label="Poor assets on network" color="#dc2626" />
      </div>

      <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "1px", color: "var(--green)", borderBottom: "2px solid var(--gold)", paddingBottom: 5, marginBottom: 12 }}>
          Corridor comparison
        </div>
        <div style={{ height: 220 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={corridors}
              margin={{ left: -8, right: 8, top: 8, bottom: 0 }}
              onClick={(state: any) => {
                const id = state?.activeLabel;
                if (id) setSelectedId(String(id));
              }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.08)" />
              <XAxis dataKey="id" fontSize={12} tickLine={false} />
              <YAxis fontSize={10} tickLine={false} />
              <ChartTooltip contentStyle={CHART_TOOLTIP} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="good" name="Good" stackId="a" fill="#006633" />
              <Bar dataKey="fair" name="Fair" stackId="a" fill="#f59e0b" />
              <Bar dataKey="poor" name="Poor" stackId="a" fill="#dc2626" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 10 }}>
        {corridors.map((h) => {
          const active = activeId === h.id;
          return (
            <button
              key={h.id}
              type="button"
              onClick={() => setSelectedId(h.id)}
              style={{
                textAlign: "left",
                background: "#fff",
                border: `2px solid ${active ? h.color : "var(--border)"}`,
                borderRadius: 12,
                padding: "12px 14px",
                cursor: "pointer",
                boxShadow: active ? "0 0 0 3px rgba(0,102,51,0.08)" : "var(--shadow-sm)",
                fontFamily: "var(--font-body)",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ background: h.color, color: h.id === "A4" || h.id === "A5" ? "#1a2e22" : "#fff", fontWeight: 800, fontSize: 13, padding: "3px 9px", borderRadius: 6, fontFamily: "var(--font-title)" }}>{h.id}</span>
                <span style={{ fontFamily: "var(--font-title)", fontWeight: 800, fontSize: 18, color: "var(--green)" }}>{h.total}</span>
              </div>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)", marginBottom: 8, lineHeight: 1.3 }}>{h.name}</div>
              <div style={{ height: 7, borderRadius: 4, overflow: "hidden", display: "flex", background: "#e2e8f0" }}>
                {h.total > 0 && (
                  <>
                    <div style={{ flex: h.good || 0.0001, background: "#006633" }} />
                    <div style={{ flex: h.fair || 0.0001, background: "#f59e0b" }} />
                    <div style={{ flex: h.poor || 0.0001, background: "#dc2626" }} />
                  </>
                )}
              </div>
              <div style={{ marginTop: 6, fontSize: 10, color: "var(--text-muted)" }}>{h.goodPct}% good · {h.km} km</div>
            </button>
          );
        })}
      </div>

      {selected && (
        <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: 18, display: "flex", flexDirection: "column", gap: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
                <span style={{ background: selected.color, color: selected.id === "A4" || selected.id === "A5" ? "#1a2e22" : "#fff", fontWeight: 800, fontSize: 16, padding: "4px 12px", borderRadius: 6, fontFamily: "var(--font-title)" }}>{selected.id}</span>
                <div style={{ fontFamily: "var(--font-title)", fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{selected.name}</div>
              </div>
              <div style={{ fontSize: 12, color: "var(--text-muted)" }}>
                {selected.km} km corridor · {selected.total} surveyed assets · {selected.sections.length} sections
              </div>
            </div>
            <button
              type="button"
              onClick={viewCorridor}
              disabled={!selected.rows.some((r) => formatGpsLabel(r))}
              style={{
                background: "var(--green)",
                color: "#fff",
                border: "none",
                borderRadius: 8,
                padding: "8px 14px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                opacity: selected.rows.some((r) => formatGpsLabel(r)) ? 1 : 0.45,
              }}
            >
              🗺 View corridor on map
            </button>
          </div>

          <div className="analytics-grid-2col">
            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", marginBottom: 8 }}>Condition</div>
              <div style={{ height: 10, borderRadius: 5, overflow: "hidden", display: "flex", background: "#e2e8f0", marginBottom: 8 }}>
                {selected.total > 0 && (
                  <>
                    <div style={{ flex: selected.good || 0.0001, background: "#006633" }} />
                    <div style={{ flex: selected.fair || 0.0001, background: "#f59e0b" }} />
                    <div style={{ flex: selected.poor || 0.0001, background: "#dc2626" }} />
                  </>
                )}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, fontWeight: 700 }}>
                <span style={{ color: "#006633" }}>{selected.good} good ({selected.goodPct}%)</span>
                <span style={{ color: "#d97706" }}>{selected.fair} fair</span>
                <span style={{ color: "#dc2626" }}>{selected.poor} poor ({selected.poorPct}%)</span>
              </div>
              <div style={{ marginTop: 14, fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", marginBottom: 8 }}>Asset types</div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {selected.types.slice(0, 8).map((t) => (
                  <div key={t.label} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12 }}>
                    <span style={{ flex: 1, color: "var(--text-secondary)" }}>{t.label}</span>
                    <div style={{ width: 90, height: 6, background: "var(--bg-app)", borderRadius: 3, overflow: "hidden" }}>
                      <div style={{ width: `${selected.total ? (t.count / selected.total) * 100 : 0}%`, height: "100%", background: "var(--green)" }} />
                    </div>
                    <span style={{ width: 28, textAlign: "right", fontWeight: 700, color: "var(--green)" }}>{t.count}</span>
                  </div>
                ))}
                {selected.types.length === 0 && <div style={{ fontSize: 12, color: "var(--text-muted)" }}>No assets matched this corridor yet.</div>}
              </div>
            </div>

            <div>
              <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", marginBottom: 8 }}>Sections</div>
              <div style={{ maxHeight: 260, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr>
                      {["Section", "Assets", "Poor", "Last survey"].map((h) => (
                        <th key={h} style={{ position: "sticky", top: 0, background: "#f4f7f5", textAlign: h === "Section" ? "left" : "right", padding: "7px 10px", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {selected.sections.slice(0, 40).map((s, i) => (
                      <tr
                        key={s.name}
                        style={{ background: i % 2 ? "#f7faf8" : "#fff", cursor: onSelectRecord ? "pointer" : "default" }}
                        onClick={() => {
                          const hit = selected.rows.find((r) => (String(r.section_name || "").trim() || "Unnamed section") === s.name && formatGpsLabel(r))
                            || selected.rows.find((r) => (String(r.section_name || "").trim() || "Unnamed section") === s.name);
                          if (hit) showOnMap(hit);
                        }}
                      >
                        <td style={{ padding: "7px 10px", fontWeight: 600 }}>{s.name}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right" }}>{s.count}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", color: s.poor ? "#dc2626" : "var(--text-muted)", fontWeight: 700 }}>{s.poor}</td>
                        <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{s.last || "—"}</td>
                      </tr>
                    ))}
                    {selected.sections.length === 0 && (
                      <tr><td colSpan={4} style={{ padding: 12, color: "var(--text-muted)" }}>No section names recorded for this corridor.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          <div>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)", marginBottom: 8 }}>
              Poor assets ({selected.poorAssets.length})
            </div>
            <div style={{ maxHeight: 280, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
              <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                <thead>
                  <tr>
                    {["Asset", "Section", "Type", "Surveyor", "Date", ""].map((h) => (
                      <th key={h || "map"} style={{ position: "sticky", top: 0, background: "#f4f7f5", textAlign: "left", padding: "7px 10px", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {selected.poorAssets.slice(0, 50).map((r, i) => (
                    <tr key={String(r.id || r._id || i)} style={{ background: i % 2 ? "#f7faf8" : "#fff" }}>
                      <td style={{ padding: "7px 10px", fontWeight: 700 }}>{getAssetName(r)}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>{r.section_name || "—"}</td>
                      <td style={{ padding: "7px 10px" }}>{getAssetType(r)}</td>
                      <td style={{ padding: "7px 10px", color: "var(--text-muted)" }}>{r.surveyor_name || "—"}</td>
                      <td style={{ padding: "7px 10px", whiteSpace: "nowrap", color: "var(--text-muted)" }}>{r.survey_date || "—"}</td>
                      <td style={{ padding: "7px 10px" }}>
                        <button
                          type="button"
                          onClick={() => showOnMap(r)}
                          style={{ background: "none", border: "none", color: "var(--green)", fontWeight: 700, fontSize: 11, cursor: "pointer", fontFamily: "var(--font-body)" }}
                        >
                          Map
                        </button>
                      </td>
                    </tr>
                  ))}
                  {selected.poorAssets.length === 0 && (
                    <tr><td colSpan={6} style={{ padding: 12, color: "var(--text-muted)" }}>No poor-condition assets on this corridor.</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function Kpi({ num, label, color = "var(--green)", sub }: { num: string; label: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", flex: 1, minWidth: 140, boxShadow: "var(--shadow-sm)" }}>
      <div style={{ fontFamily: "var(--font-title)", fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
