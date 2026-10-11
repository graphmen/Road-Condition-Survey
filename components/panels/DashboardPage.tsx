"use client";

import { useMemo } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend,
} from "recharts";
import {
  getAssetName,
  getAssetType,
  formatGpsLabel,
} from "@/components/helpers";
import { matchHighwayId } from "@/lib/highways";
import { buildSystemStats } from "@/lib/systemStats";

const CHART_TOOLTIP = {
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid var(--border)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

export default function DashboardPage({
  records,
  onSelectRecord,
  lastSynced,
}: {
  records: any[];
  onSelectRecord?: (r: any) => void;
  lastSynced?: Date | null;
}) {
  const stats = useMemo(() => buildSystemStats(records), [records]);
  const briefing = stats.briefing;
  const extra = {
    coverage: stats.completeness,
    namedProvinces: stats.provinceRows.filter((p) => p.name !== "Unspecified").length,
    districtCount: stats.districtRows.length,
    offCorridor: stats.offCorridor,
  };
  const provinceRows = stats.provinceRows;

  const poorPreview = briefing.poorAssets.slice(0, 15);

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg-app)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: 16 }}>
        <div style={{ fontFamily: "var(--font-title)", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
          Road network overview
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          National counts from the loaded surveys. No filters. Corridor dossiers are on Highways; a scoped PDF is on Reports.
          {lastSynced && <> · Last synced {lastSynced.toLocaleTimeString()}</>}
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: 10 }}>
        <Kpi num={briefing.total.toLocaleString()} label="Assets surveyed" sub={briefing.periodLabel} />
        <Kpi num={`${briefing.goodPct}%`} label="Good" color="#006633" sub={`${briefing.good.toLocaleString()} assets`} />
        <Kpi num={`${briefing.fairPct}%`} label="Fair" color="#d97706" sub={`${briefing.fair.toLocaleString()} assets`} />
        <Kpi num={`${briefing.poorPct}%`} label="Poor" color="#dc2626" sub={`${briefing.poor.toLocaleString()} assets`} />
        <Kpi num={briefing.surveyors.toLocaleString()} label="Surveyors" color="#1d6fa4" />
        <Kpi num={`${extra.coverage.gpsPct}%`} label="With GPS" color="#0f766e" sub={`${extra.coverage.gps.toLocaleString()} assets`} />
        <Kpi num={`${extra.coverage.photoPct}%`} label="With photos" color="#1d6fa4" sub={`${extra.coverage.photos.toLocaleString()} assets`} />
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--text-primary)" }}>{briefing.scopeLine}.</strong>{" "}
        {briefing.worstCorridor && briefing.worstCorridor.total > 0 && (
          <>Highest poor share on a surveyed corridor: <strong>{briefing.worstCorridor.key}</strong> ({briefing.worstCorridor.poorPct}% · {briefing.worstCorridor.poor} assets). </>
        )}
        {briefing.worstTypes.length > 0 && (
          <>Most poor records: {briefing.worstTypes.map((t) => `${t.label} (${t.poor})`).join(", ")}. </>
        )}
        {(briefing.mixed > 0 || briefing.uc > 0) && (
          <> {briefing.mixed > 0 ? `${briefing.mixed} mixed` : ""}{briefing.mixed > 0 && briefing.uc > 0 ? ", " : ""}{briefing.uc > 0 ? `${briefing.uc} under construction` : ""}. </>
        )}
        {extra.namedProvinces > 0 && (
          <> {extra.namedProvinces} provinces · {extra.districtCount} named districts · {extra.coverage.aClassPct}% on A1–A5.</>
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
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)", marginBottom: 10 }}>
          Provinces ({provinceRows.length})
        </div>
        <div style={{ overflowX: "auto" }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Province", "Assets", "Good", "Fair", "Poor", "Poor share"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)", background: "#f4f7f5" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {provinceRows.map((row, i) => (
                <tr key={row.name} style={{ background: i % 2 ? "#f7faf8" : "#fff" }}>
                  <td style={{ padding: "7px 10px", fontWeight: 700 }}>{row.name}</td>
                  <td style={{ padding: "7px 10px" }}>{row.total.toLocaleString()}</td>
                  <td style={{ padding: "7px 10px", color: "#006633" }}>{row.good.toLocaleString()}</td>
                  <td style={{ padding: "7px 10px", color: "#d97706" }}>{row.fair.toLocaleString()}</td>
                  <td style={{ padding: "7px 10px", color: "#dc2626" }}>{row.poor.toLocaleString()}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 700 }}>{row.poorPct}%</td>
                </tr>
              ))}
              {provinceRows.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 16, color: "var(--text-muted)" }}>No province fields in the loaded surveys.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: 16 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)", marginBottom: 10 }}>
          Poor-condition assets ({briefing.poor.toLocaleString()} total · showing {poorPreview.length})
        </div>
        <div style={{ maxHeight: 320, overflow: "auto", border: "1px solid var(--border)", borderRadius: 8 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Asset", "Type", "Province", "Corridor", "Date", ""].map((h) => (
                  <th key={h || "map"} style={{ position: "sticky", top: 0, background: "#f4f7f5", textAlign: "left", padding: "7px 10px", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {poorPreview.map((r, i) => (
                <tr key={String(r.id || r._id || i)} style={{ background: i % 2 ? "#f7faf8" : "#fff" }}>
                  <td style={{ padding: "7px 10px", fontWeight: 700 }}>{getAssetName(r)}</td>
                  <td style={{ padding: "7px 10px" }}>{getAssetType(r)}</td>
                  <td style={{ padding: "7px 10px", color: "var(--text-secondary)" }}>{r.province || "—"}</td>
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
              {poorPreview.length === 0 && (
                <tr><td colSpan={6} style={{ padding: 16, color: "var(--text-muted)" }}>No poor-condition assets in the loaded surveys.</td></tr>
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
