"use client";

import { useMemo, useState } from "react";
import { FileText } from "lucide-react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend,
} from "recharts";
import {
  getAssetName,
  getAssetType,
  formatGpsLabel,
  type UserProfile,
} from "@/components/helpers";
import { HIGHWAY_CORRIDORS, matchHighwayId } from "@/lib/highways";
import { EXPORT_PARAMETERS } from "@/lib/exportData";
import { ZIM_PROVINCES_DISTRICTS } from "@/lib/zimbabwe";
import {
  buildBriefing,
  downloadBriefingPdf,
  roleLabel,
  surveyDay,
  type ReportLevel,
} from "@/lib/reportBriefing";

const CHART_TOOLTIP = {
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid var(--border)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

const SELECT: React.CSSProperties = {
  padding: "7px 10px",
  borderRadius: 8,
  border: "1px solid var(--border)",
  fontSize: 11.5,
  background: "#fff",
  fontWeight: 600,
  color: "var(--text-primary)",
  outline: "none",
  fontFamily: "var(--font-body)",
};

export default function ReportsPage({
  records,
  onSelectRecord,
  currentUser,
}: {
  records: any[];
  onSelectRecord?: (r: any) => void;
  currentUser?: UserProfile | null;
}) {
  const [level, setLevel] = useState<ReportLevel>("national");
  const [province, setProvince] = useState("all");
  const [district, setDistrict] = useState("all");
  const [highway, setHighway] = useState("all");
  const [category, setCategory] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const dateBounds = useMemo(() => {
    const days = records.map(surveyDay).filter(Boolean).sort() as string[];
    return days.length ? { min: days[0], max: days[days.length - 1] } : { min: "", max: "" };
  }, [records]);

  const briefing = useMemo(
    () => buildBriefing(records, { level, province, district, highway, category, dateFrom, dateTo }),
    [records, level, province, district, highway, category, dateFrom, dateTo]
  );

  const districts = province !== "all" ? (ZIM_PROVINCES_DISTRICTS[province] || []) : [];

  const handlePdf = () => {
    downloadBriefingPdf(briefing, currentUser);
  };

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg-app)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: 16, display: "flex", flexDirection: "column", gap: 12 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 12, flexWrap: "wrap", alignItems: "flex-start" }}>
          <div>
            <div style={{ fontFamily: "var(--font-title)", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
              Road condition briefing
            </div>
            <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
              Numbers only from the selected surveys. One PDF. Bulk files stay on Export.
            </div>
          </div>
          <button
            type="button"
            onClick={handlePdf}
            disabled={!briefing.total}
            style={{
              background: briefing.total ? "var(--green)" : "#94a3b8",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              padding: "9px 16px",
              fontSize: 12.5,
              fontWeight: 700,
              cursor: briefing.total ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              gap: 8,
              fontFamily: "var(--font-body)",
            }}
          >
            <FileText size={15} /> Download PDF briefing
          </button>
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ display: "flex", background: "var(--bg-app)", padding: 3, borderRadius: 8, border: "1px solid var(--border)" }}>
            {([
              { id: "national" as const, label: "National" },
              { id: "provincial" as const, label: "Provincial" },
              { id: "district" as const, label: "District" },
            ]).map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => {
                  setLevel(opt.id);
                  if (opt.id === "national") {
                    setProvince("all");
                    setDistrict("all");
                  } else if (province === "all") {
                    setProvince(Object.keys(ZIM_PROVINCES_DISTRICTS)[0]);
                    setDistrict("all");
                  }
                }}
                style={{
                  padding: "5px 12px",
                  borderRadius: 6,
                  border: "none",
                  background: level === opt.id ? "var(--green)" : "transparent",
                  color: level === opt.id ? "#fff" : "var(--text-secondary)",
                  fontSize: 11,
                  fontWeight: 700,
                  cursor: "pointer",
                  fontFamily: "var(--font-body)",
                }}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {(level === "provincial" || level === "district") && (
            <select value={province} onChange={(e) => { setProvince(e.target.value); setDistrict("all"); }} style={SELECT}>
              {Object.keys(ZIM_PROVINCES_DISTRICTS).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          )}
          {level === "district" && (
            <select value={district} onChange={(e) => setDistrict(e.target.value)} style={SELECT}>
              <option value="all">All districts</option>
              {districts.map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          )}

          <select value={highway} onChange={(e) => setHighway(e.target.value)} style={SELECT}>
            <option value="all">All corridors</option>
            {HIGHWAY_CORRIDORS.map((h) => (
              <option key={h.id} value={h.id}>{h.id} · {h.name}</option>
            ))}
          </select>

          <select value={category} onChange={(e) => setCategory(e.target.value)} style={SELECT}>
            <option value="all">All asset types</option>
            {EXPORT_PARAMETERS.filter((p) => p.key !== "unknown").map((p) => (
              <option key={p.key} value={p.key}>{p.label}</option>
            ))}
          </select>

          <input type="date" value={dateFrom} min={dateBounds.min} max={dateBounds.max || undefined} onChange={(e) => setDateFrom(e.target.value)} style={SELECT} />
          <input type="date" value={dateTo} min={dateBounds.min} max={dateBounds.max || undefined} onChange={(e) => setDateTo(e.target.value)} style={SELECT} />
        </div>
        {dateBounds.min && (
          <div style={{ fontSize: 10, color: "var(--text-muted)" }}>Survey dates in the dataset: {dateBounds.min} → {dateBounds.max}</div>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Kpi num={briefing.total.toLocaleString()} label="Assets in scope" sub={briefing.periodLabel} />
        <Kpi num={`${briefing.goodPct}%`} label="Good" color="#006633" sub={`${briefing.good.toLocaleString()} assets`} />
        <Kpi num={`${briefing.fairPct}%`} label="Fair" color="#d97706" sub={`${briefing.fair.toLocaleString()} assets`} />
        <Kpi num={`${briefing.poorPct}%`} label="Poor" color="#dc2626" sub={`${briefing.poor.toLocaleString()} assets`} />
        <Kpi num={briefing.surveyors.toLocaleString()} label="Surveyors" color="#1d6fa4" />
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--text-primary)" }}>{briefing.scopeLine}.</strong>{" "}
        {briefing.worstCorridor && briefing.worstCorridor.total > 0 && (
          <>Highest poor share on a surveyed corridor: <strong>{briefing.worstCorridor.key}</strong> ({briefing.worstCorridor.poorPct}% · {briefing.worstCorridor.poor} assets). </>
        )}
        {briefing.worstTypes.length > 0 && (
          <>Most poor records: {briefing.worstTypes.map((t) => `${t.label} (${t.poor})`).join(", ")}.</>
        )}
      </div>

      <div className="analytics-grid-2col">
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)", marginBottom: 10 }}>Condition by asset type</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={briefing.categoryRows.slice(0, 10)} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.08)" />
                <XAxis dataKey="label" fontSize={9} interval={0} angle={-28} textAnchor="end" height={64} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} />
                <ChartTooltip contentStyle={CHART_TOOLTIP} />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="good" name="Good" stackId="a" fill="#006633" />
                <Bar dataKey="fair" name="Fair" stackId="a" fill="#f59e0b" />
                <Bar dataKey="poor" name="Poor" stackId="a" fill="#dc2626" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
        <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)", marginBottom: 10 }}>A-class corridors</div>
          <div style={{ height: 240 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={briefing.corridorRows} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.08)" />
                <XAxis dataKey="key" fontSize={12} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} />
                <ChartTooltip contentStyle={CHART_TOOLTIP} />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                <Bar dataKey="good" name="Good" stackId="a" fill="#006633" />
                <Bar dataKey="fair" name="Fair" stackId="a" fill="#f59e0b" />
                <Bar dataKey="poor" name="Poor" stackId="a" fill="#dc2626" radius={[3, 3, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: 16 }}>
        <div style={{ display: "flex", justifyContent: "space-between", gap: 8, flexWrap: "wrap", marginBottom: 10 }}>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)" }}>
            Poor-condition assets ({briefing.poor.toLocaleString()} total · showing {briefing.poorAssets.length})
          </div>
          {currentUser?.full_name && (
            <div style={{ fontSize: 11, color: "var(--text-muted)" }}>
              Prepared by {currentUser.full_name} · {roleLabel(currentUser.role)}
            </div>
          )}
        </div>
        <div style={{ maxHeight: 340, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Asset", "Type", "Road", "Section", "Corridor", "Date", ""].map((h) => (
                  <th key={h || "map"} style={{ position: "sticky", top: 0, background: "#f4f7f5", textAlign: "left", padding: "7px 10px", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {briefing.poorAssets.map((r, i) => (
                <tr key={String(r.id || r._id || i)} style={{ background: i % 2 ? "#f7faf8" : "#fff" }}>
                  <td style={{ padding: "7px 10px", fontWeight: 700 }}>{getAssetName(r)}</td>
                  <td style={{ padding: "7px 10px" }}>{getAssetType(r)}</td>
                  <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>{(r.road_name || "—").split(" (")[0]}</td>
                  <td style={{ padding: "7px 10px", color: "var(--text-muted)" }}>{r.section_name || "—"}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 700, color: "var(--green)" }}>{matchHighwayId(r) || "—"}</td>
                  <td style={{ padding: "7px 10px", whiteSpace: "nowrap", color: "var(--text-muted)" }}>{r.survey_date || "—"}</td>
                  <td style={{ padding: "7px 10px" }}>
                    {onSelectRecord && (
                      <button
                        type="button"
                        onClick={() => onSelectRecord(r)}
                        disabled={!formatGpsLabel(r)}
                        style={{ background: "none", border: "none", color: "var(--green)", fontWeight: 700, fontSize: 11, cursor: formatGpsLabel(r) ? "pointer" : "default", opacity: formatGpsLabel(r) ? 1 : 0.4, fontFamily: "var(--font-body)" }}
                      >
                        Map
                      </button>
                    )}
                  </td>
                </tr>
              ))}
              {briefing.poorAssets.length === 0 && (
                <tr><td colSpan={7} style={{ padding: 16, color: "var(--text-muted)" }}>No poor-condition assets in this selection.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function Kpi({ num, label, color = "var(--green)", sub }: { num: string; label: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ fontFamily: "var(--font-title)", fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}
