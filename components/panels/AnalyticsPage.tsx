"use client";

import { useMemo, type ReactNode } from "react";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid,
  Tooltip as ChartTooltip, Legend, ComposedChart, Area, Line,
} from "recharts";
import { buildSystemStats } from "@/lib/systemStats";

const CHART_TOOLTIP = {
  fontSize: 11,
  borderRadius: 8,
  border: "1px solid var(--border)",
  boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
};

function Kpi({ num, label, color = "var(--green)", sub }: { num: string; label: string; color?: string; sub?: string }) {
  return (
    <div style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "14px 16px", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ fontFamily: "var(--font-title)", fontSize: 26, fontWeight: 800, color, lineHeight: 1 }}>{num}</div>
      <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 4 }}>{label}</div>
      {sub && <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 2 }}>{sub}</div>}
    </div>
  );
}

function Card({ title, children, height }: { title: string; children: ReactNode; height?: number }) {
  return (
    <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--green)", marginBottom: 10 }}>{title}</div>
      {height ? <div style={{ height }}>{children}</div> : children}
    </div>
  );
}

function PlaceTable({ rows, empty }: { rows: { name: string; total: number; good: number; fair: number; poor: number; poorPct: number }[]; empty: string }) {
  return (
    <div style={{ overflow: "auto", maxHeight: 340 }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
        <thead>
          <tr>
            {["Place", "Assets", "Good", "Fair", "Poor", "Poor share"].map((h) => (
              <th key={h} style={{ position: "sticky", top: 0, background: "#f4f7f5", textAlign: "left", padding: "7px 10px", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={row.name} style={{ background: i % 2 ? "#f7faf8" : "#fff" }}>
              <td style={{ padding: "7px 10px", fontWeight: 700 }}>{row.name}</td>
              <td style={{ padding: "7px 10px" }}>{row.total.toLocaleString()}</td>
              <td style={{ padding: "7px 10px", color: "#006633" }}>{row.good.toLocaleString()}</td>
              <td style={{ padding: "7px 10px", color: "#d97706" }}>{row.fair.toLocaleString()}</td>
              <td style={{ padding: "7px 10px", color: "#dc2626" }}>{row.poor.toLocaleString()}</td>
              <td style={{ padding: "7px 10px", fontWeight: 700 }}>{row.poorPct}%</td>
            </tr>
          ))}
          {rows.length === 0 && (
            <tr><td colSpan={6} style={{ padding: 16, color: "var(--text-muted)" }}>{empty}</td></tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

export default function AnalyticsPage({ records }: { records: any[] }) {
  const stats = useMemo(() => buildSystemStats(records), [records]);
  const { briefing, completeness, signSadc } = stats;
  const total = briefing.total;
  const maxSurveyor = stats.surveyorRows[0]?.count || 1;
  const typeHeight = Math.max(280, Math.min(520, briefing.categoryRows.length * 28));
  const corridorShare = briefing.corridorRows.map((h) => ({
    key: h.key,
    total: h.total,
    poor: h.poor,
    poorPct: h.poorPct,
    goodPct: h.goodPct,
  }));

  return (
    <div style={{ height: "100%", overflowY: "auto", background: "var(--bg-app)", padding: "20px 24px", display: "flex", flexDirection: "column", gap: 16 }}>
      <div style={{ background: "#fff", borderRadius: 12, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", padding: 16 }}>
        <div style={{ fontFamily: "var(--font-title)", fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
          Survey analysis
        </div>
        <div style={{ fontSize: 12, color: "var(--text-muted)", marginTop: 2 }}>
          Counts from the loaded surveys. Coverage is field completeness, not a condition rating. SADC is only counted on road signs that were tagged.
        </div>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        <Kpi num={total.toLocaleString()} label="Assets surveyed" sub={briefing.periodLabel} />
        <Kpi num={`${briefing.goodPct}%`} label="Good" color="#006633" sub={`${briefing.good.toLocaleString()} assets`} />
        <Kpi num={`${briefing.fairPct}%`} label="Fair" color="#d97706" sub={`${briefing.fair.toLocaleString()} assets`} />
        <Kpi num={`${briefing.poorPct}%`} label="Poor" color="#dc2626" sub={`${briefing.poor.toLocaleString()} assets`} />
        <Kpi num={`${completeness.gpsPct}%`} label="With GPS" color="#0f766e" sub={`${completeness.gps.toLocaleString()} of ${total.toLocaleString()}`} />
        <Kpi num={`${completeness.photoPct}%`} label="With photos" color="#1d6fa4" sub={`${completeness.photos.toLocaleString()} of ${total.toLocaleString()}`} />
        <Kpi num={String(stats.provinceRows.filter((p) => p.name !== "Unspecified").length)} label="Provinces" sub={`${stats.districtRows.length} districts named`} />
        <Kpi num={briefing.surveyors.toLocaleString()} label="Surveyors" />
      </div>

      <div style={{ fontSize: 13, color: "var(--text-secondary)", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px", lineHeight: 1.45 }}>
        <strong style={{ color: "var(--text-primary)" }}>{briefing.scopeLine}.</strong>{" "}
        {briefing.worstCorridor && briefing.worstCorridor.total > 0 && (
          <>Highest poor share on a surveyed corridor{briefing.worstCorridor.total >= 50 ? " (n ≥ 50)" : ""}: <strong>{briefing.worstCorridor.key}</strong> ({briefing.worstCorridor.poorPct}% · {briefing.worstCorridor.poor} of {briefing.worstCorridor.total.toLocaleString()}). </>
        )}
        {completeness.aClassPct >= 0 && (
          <>A-class match: {completeness.aClass.toLocaleString()} ({completeness.aClassPct}%) · {stats.offCorridor.toLocaleString()} not on A1–A5. </>
        )}
        {briefing.worstTypes.length > 0 && (
          <>Most poor records: {briefing.worstTypes.map((t) => `${t.label} (${t.poor})`).join(", ")}.</>
        )}
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(140px, 1fr))", gap: 10 }}>
        {[
          { label: "GPS", pct: completeness.gpsPct, count: completeness.gps },
          { label: "Photos", pct: completeness.photoPct, count: completeness.photos },
          { label: "Survey date", pct: completeness.datedPct, count: completeness.dated },
          { label: "Province", pct: completeness.provincePct, count: completeness.province },
          { label: "District", pct: completeness.districtPct, count: completeness.district },
          { label: "A-class corridor", pct: completeness.aClassPct, count: completeness.aClass },
        ].map((row) => (
          <div key={row.label} style={{ background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px" }}>{row.label}</div>
            <div style={{ fontFamily: "var(--font-title)", fontSize: 22, fontWeight: 800, color: "var(--green)", margin: "4px 0" }}>{row.pct}%</div>
            <div style={{ height: 6, background: "#eef3f0", borderRadius: 4, overflow: "hidden" }}>
              <div style={{ width: `${row.pct}%`, height: "100%", background: "var(--green)" }} />
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>{row.count.toLocaleString()} records</div>
          </div>
        ))}
      </div>

      <div className="analytics-grid-2col">
        <Card title="Survey volume by month" height={260}>
          {stats.monthRows.length === 0 ? (
            <div style={{ color: "var(--text-muted)", fontSize: 12, padding: 24 }}>No survey dates in this dataset.</div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={stats.monthRows} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.08)" />
                <XAxis dataKey="label" fontSize={10} tickLine={false} />
                <YAxis fontSize={10} tickLine={false} />
                <ChartTooltip contentStyle={CHART_TOOLTIP} />
                <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
                <Area type="monotone" dataKey="total" name="All" stroke="#006633" fill="#006633" fillOpacity={0.12} strokeWidth={2} />
                <Line type="monotone" dataKey="good" name="Good" stroke="#16a34a" strokeWidth={2} dot={false} />
                <Line type="monotone" dataKey="poor" name="Poor" stroke="#dc2626" strokeWidth={2} dot={false} />
              </ComposedChart>
            </ResponsiveContainer>
          )}
        </Card>
        <Card title="Asset families" height={260}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={stats.groupRows} margin={{ left: -8, right: 8, top: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.08)" />
              <XAxis dataKey="label" fontSize={10} tickLine={false} interval={0} angle={-16} height={48} textAnchor="end" />
              <YAxis fontSize={10} tickLine={false} />
              <ChartTooltip contentStyle={CHART_TOOLTIP} />
              <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
              <Bar dataKey="good" name="Good" stackId="a" fill="#006633" />
              <Bar dataKey="fair" name="Fair" stackId="a" fill="#f59e0b" />
              <Bar dataKey="poor" name="Poor" stackId="a" fill="#dc2626" radius={[3, 3, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>
      </div>

      <div className="analytics-grid-2col">
        <Card title="A-class corridors" height={260}>
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
        </Card>
        <Card title="Corridor poor share">
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["Corridor", "Assets", "Poor", "Poor share", "Good share"].map((h) => (
                  <th key={h} style={{ textAlign: "left", padding: "7px 10px", fontSize: 10, textTransform: "uppercase", color: "var(--text-muted)", borderBottom: "1px solid var(--border)" }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corridorShare.map((h, i) => (
                <tr key={h.key} style={{ background: i % 2 ? "#f7faf8" : "#fff" }}>
                  <td style={{ padding: "7px 10px", fontWeight: 800, color: "var(--green)" }}>{h.key}</td>
                  <td style={{ padding: "7px 10px" }}>{h.total.toLocaleString()}</td>
                  <td style={{ padding: "7px 10px", color: "#dc2626" }}>{h.poor.toLocaleString()}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 700 }}>{h.total ? `${h.poorPct}%` : "—"}</td>
                  <td style={{ padding: "7px 10px" }}>{h.total ? `${h.goodPct}%` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 8 }}>
            Poor-share headlines ignore corridors with fewer than 50 surveyed assets.
          </div>
        </Card>
      </div>

      <Card title="Condition by asset type" height={typeHeight}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={briefing.categoryRows} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(0,102,51,0.06)" horizontal={false} />
            <XAxis type="number" fontSize={10} tickLine={false} />
            <YAxis type="category" dataKey="label" fontSize={11} width={120} tickLine={false} tick={{ fill: "#3d5a48" }} />
            <ChartTooltip contentStyle={CHART_TOOLTIP} />
            <Legend iconSize={9} wrapperStyle={{ fontSize: 10 }} />
            <Bar dataKey="good" name="Good" stackId="a" fill="#006633" />
            <Bar dataKey="fair" name="Fair" stackId="a" fill="#f59e0b" />
            <Bar dataKey="poor" name="Poor" stackId="a" fill="#dc2626" radius={[0, 4, 4, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <div className="analytics-grid-2col">
        <Card title={`Provinces (${stats.provinceRows.length})`}>
          <PlaceTable rows={stats.provinceRows} empty="No province fields in the loaded surveys." />
        </Card>
        <Card title={`Districts (${stats.districtRows.length} named)`}>
          <PlaceTable rows={stats.districtRows.slice(0, 25)} empty="No district fields in the loaded surveys." />
        </Card>
      </div>

      <Card title={`Surveyors (${stats.surveyorRows.length})`}>
        <div style={{ overflow: "auto", maxHeight: 420 }}>
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
            <thead>
              <tr>
                {["#", "Surveyor", "Records", "Share", "Good", "Fair", "Poor", "Last survey", "Volume"].map((h) => (
                  <th
                    key={h}
                    style={{
                      textAlign: h === "Surveyor" || h === "Volume" ? "left" : "right",
                      padding: "7px 10px",
                      fontSize: 10,
                      fontWeight: 700,
                      textTransform: "uppercase",
                      color: "var(--text-muted)",
                      borderBottom: "1px solid var(--border)",
                      position: "sticky",
                      top: 0,
                      background: "#f4f7f5",
                    }}
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {stats.surveyorRows.map((s, i) => (
                <tr key={s.name} style={{ background: i % 2 ? "#f7faf8" : "#fff" }}>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-muted)" }}>{i + 1}</td>
                  <td style={{ padding: "7px 10px", fontWeight: 700 }}>{s.name}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right" }}>{s.count.toLocaleString()}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-muted)" }}>{total ? `${((s.count / total) * 100).toFixed(1)}%` : "—"}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "#006633", fontWeight: 700 }}>{s.good}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "#d97706", fontWeight: 700 }}>{s.fair}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "#dc2626", fontWeight: 700 }}>{s.poor}</td>
                  <td style={{ padding: "7px 10px", textAlign: "right", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{s.last || "—"}</td>
                  <td style={{ padding: "7px 10px", minWidth: 110 }}>
                    <div style={{ height: 7, background: "#eef3f0", borderRadius: 4, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${(s.count / maxSurveyor) * 100}%`, background: "#FFD100" }} />
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>

      {signSadc.signs > 0 && (
        <div style={{ fontSize: 12, color: "var(--text-muted)", background: "#fff", border: "1px solid var(--border)", borderRadius: 12, padding: "12px 16px" }}>
          Road signs surveyed: {signSadc.signs.toLocaleString()}. SADC tag present on {signSadc.tagged.toLocaleString()}
          {signSadc.tagged > 0 && (
            <> ({signSadc.yes} yes · {signSadc.no} no · {signSadc.mixed} mixed)</>
          )}
          . Untagged signs are not treated as non-compliant.
        </div>
      )}
    </div>
  );
}
