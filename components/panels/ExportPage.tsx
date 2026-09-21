"use client";

import { useMemo, useState } from "react";
import { Download } from "lucide-react";
import {
  getAssetName,
  getAssetType,
  getCategoryKey,
  getRecordStatus,
} from "@/components/helpers";
import { HIGHWAY_CORRIDORS, matchHighwayId } from "@/lib/highways";
import {
  ALL_PARAM_KEYS,
  EXPORT_PARAMETERS,
  collectExportColumns,
  getExportGeometry,
  tableFileName,
  toCsv,
  toGeoJson,
  toJson,
  toKml,
  type ExportFormat,
} from "@/lib/exportData";
import { buildZip } from "@/lib/zip";
import { ZIM_PROVINCES_DISTRICTS } from "@/lib/zimbabwe";

function surveyDay(record: any): string | null {
  const raw = record?.survey_date || record?.created_at;
  if (!raw) return null;
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function triggerDownload(blob: Blob, filename: string) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1500);
}

const SELECT: React.CSSProperties = {
  width: "100%",
  padding: "9px 12px",
  border: "1px solid rgba(0,102,51,0.2)",
  borderRadius: 8,
  fontSize: 12,
  outline: "none",
  fontFamily: "var(--font-body)",
  color: "var(--text-secondary)",
  background: "#fff",
};

const LABEL: React.CSSProperties = {
  fontSize: 10,
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.7px",
  color: "var(--text-muted)",
  marginBottom: 6,
};

export default function ExportPage({
  records,
  onSelectRecord,
}: {
  records: any[];
  onSelectRecord?: (r: any) => void;
}) {
  const [fmt, setFmt] = useState<ExportFormat>("csv");
  const [highway, setHighway] = useState("all");
  const [cond, setCond] = useState("all");
  const [provinceFilter, setProvinceFilter] = useState("all");
  const [districtFilter, setDistrictFilter] = useState("all");
  const [surveyorFilter, setSurveyorFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [selectedParams, setSelectedParams] = useState<string[]>(ALL_PARAM_KEYS.filter((k) => k !== "unknown"));
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState<string | null>(null);

  const surveyors = useMemo(
    () => Array.from(new Set(records.map((r) => r.surveyor_name).filter(Boolean))).sort(),
    [records]
  );

  const dateBounds = useMemo(() => {
    const days = records.map(surveyDay).filter(Boolean).sort() as string[];
    return days.length ? { min: days[0], max: days[days.length - 1] } : { min: "", max: "" };
  }, [records]);

  const highwayMeta = useMemo(() => {
    const map = new Map<any, { highway_id: string | null }>();
    for (const r of records) map.set(r, { highway_id: matchHighwayId(r) });
    return map;
  }, [records]);

  const job = useMemo(() => {
    const filtered = records.filter((r) => {
      const hid = highwayMeta.get(r)?.highway_id || null;
      if (highway !== "all" && hid !== highway) return false;
      if (cond !== "all" && getRecordStatus(r) !== cond) return false;
      if (provinceFilter !== "all" && r.province !== provinceFilter) return false;
      if (districtFilter !== "all" && r.district !== districtFilter) return false;
      if (surveyorFilter !== "all" && r.surveyor_name !== surveyorFilter) return false;
      const day = surveyDay(r);
      if (dateFrom && (!day || day < dateFrom)) return false;
      if (dateTo && (!day || day > dateTo)) return false;
      return true;
    });

    const typeCounts: Record<string, number> = {};
    for (const p of EXPORT_PARAMETERS) typeCounts[p.key] = 0;
    for (const r of filtered) {
      const key = getCategoryKey(r) || "unknown";
      typeCounts[key] = (typeCounts[key] || 0) + 1;
    }

    const selectedSet = new Set(selectedParams);
    const selected = filtered.filter((r) => selectedSet.has(getCategoryKey(r) || "unknown"));
    const uncategorised = filtered.filter((r) => (getCategoryKey(r) || "unknown") === "unknown").length;
    const droppedTypes = filtered.length - selected.length;
    let withGeom = 0;
    for (const r of selected) if (getExportGeometry(r)) withGeom += 1;
    const withoutGeom = selected.length - withGeom;
    const geoFmt = fmt === "geojson" || fmt === "kml";
    const exportCount = geoFmt ? withGeom : selected.length;

    const groups = EXPORT_PARAMETERS
      .filter((p) => selectedSet.has(p.key))
      .map((p) => {
        const rows = selected.filter((r) => (getCategoryKey(r) || "unknown") === p.key);
        const withG = rows.filter((r) => getExportGeometry(r)).length;
        return {
          key: p.key,
          name: p.label,
          table: p.table,
          records: rows,
          columns: collectExportColumns(rows, highwayMeta),
          withGeom: withG,
          withoutGeom: rows.length - withG,
        };
      })
      .filter((g) => g.records.length > 0);

    return {
      filtered,
      selected,
      typeCounts,
      uncategorised,
      droppedTypes,
      withGeom,
      withoutGeom,
      geoFmt,
      exportCount,
      groups,
    };
  }, [records, highwayMeta, highway, cond, provinceFilter, districtFilter, surveyorFilter, dateFrom, dateTo, selectedParams, fmt]);

  const corridorName = highway === "all"
    ? "national"
    : HIGHWAY_CORRIDORS.find((h) => h.id === highway)?.name.replace(/\s+/g, "_").toLowerCase() || highway;

  const stamp = new Date().toISOString().slice(0, 10);
  const baseName = `roads_${corridorName}_${stamp}`;

  const handleDownload = () => {
    if (!job.groups.length) return;
    setBusy(true);
    setNote(null);
    try {
      const encoder = new TextEncoder();
      const extras = highwayMeta;
      const ext = fmt === "geojson" ? "geojson" : fmt;
      const files = job.groups.flatMap((g) => {
        if (fmt === "json") {
          return [{ name: tableFileName(g.key, ext), data: encoder.encode(toJson(g.records, extras)) }];
        }
        if (fmt === "geojson") {
          const { text } = toGeoJson(g.records, extras);
          if (!g.withGeom) return [];
          return [{ name: tableFileName(g.key, ext), data: encoder.encode(text) }];
        }
        if (fmt === "kml") {
          if (!g.withGeom) return [];
          const { text } = toKml([{ name: g.name, records: g.records }], extras, `${g.name} ${stamp}`);
          return [{ name: tableFileName(g.key, ext), data: encoder.encode(text) }];
        }
        return [{ name: tableFileName(g.key, "csv"), data: encoder.encode(toCsv(g.records, g.columns, extras)) }];
      });

      if (!files.length) {
        setNote("Nothing to pack. Spatial formats skip types with no GPS.");
        return;
      }

      triggerDownload(buildZip(files), `${baseName}.zip`);
      const skip = job.geoFmt && job.withoutGeom ? ` · ${job.withoutGeom} without GPS omitted` : "";
      setNote(`${files.length} ${fmt.toUpperCase()} file${files.length === 1 ? "" : "s"} in ${baseName}.zip${skip}.`);
    } catch (err) {
      setNote(err instanceof Error ? err.message : "Export failed.");
    } finally {
      setBusy(false);
    }
  };

  const fileCount = job.geoFmt ? job.groups.filter((g) => g.withGeom > 0).length : job.groups.length;
  const downloadLabel = !fileCount
    ? "Nothing to download"
    : `Download ZIP · ${fileCount} ${fmt.toUpperCase()} file${fileCount === 1 ? "" : "s"}`;

  return (
    <div style={{ padding: "20px 24px", overflowY: "auto", height: "100%", background: "var(--bg-app)", display: "flex", flexDirection: "column", gap: 16 }}>
      <div className="export-page-layout">
        <div style={{ background: "#fff", borderRadius: 12, padding: 20, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", display: "flex", flexDirection: "column", gap: 14, alignSelf: "start" }}>
          <div>
            <div style={LABEL}>Format</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              {(["csv", "json", "geojson", "kml"] as ExportFormat[]).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => setFmt(f)}
                  style={{
                    padding: "10px",
                    borderRadius: 8,
                    border: `2px solid ${fmt === f ? "var(--green)" : "var(--border)"}`,
                    background: fmt === f ? "var(--bg-active)" : "#f9fafb",
                    fontSize: 11,
                    fontWeight: 700,
                    color: fmt === f ? "var(--green)" : "var(--text-muted)",
                    cursor: "pointer",
                    textTransform: "uppercase",
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {f === "csv" ? "📄 CSV" : f === "json" ? "🔧 JSON" : f === "geojson" ? "🌍 GeoJSON" : "🗺️ KML"}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 6 }}>
              {fmt === "csv" && "ZIP with one Excel-ready CSV per asset table."}
              {fmt === "json" && "ZIP with one JSON array per asset table."}
              {fmt === "geojson" && "ZIP with one GeoJSON file per table. Types with no GPS are omitted."}
              {fmt === "kml" && "ZIP with one KML file per table. Types with no GPS are omitted. CRS: WGS84."}
            </div>
          </div>

          <div>
            <div style={LABEL}>A-class corridor</div>
            <select value={highway} onChange={(e) => setHighway(e.target.value)} style={SELECT}>
              <option value="all">All roads (national)</option>
              {HIGHWAY_CORRIDORS.map((h) => (
                <option key={h.id} value={h.id}>{h.id} · {h.name}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={LABEL}>Survey date</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
              <input type="date" value={dateFrom} min={dateBounds.min} max={dateBounds.max || undefined} onChange={(e) => setDateFrom(e.target.value)} style={SELECT} />
              <input type="date" value={dateTo} min={dateBounds.min} max={dateBounds.max || undefined} onChange={(e) => setDateTo(e.target.value)} style={SELECT} />
            </div>
            {dateBounds.min && (
              <div style={{ fontSize: 10, color: "var(--text-muted)", marginTop: 4 }}>
                Data runs {dateBounds.min} → {dateBounds.max}
              </div>
            )}
          </div>

          <div>
            <div style={LABEL}>Condition</div>
            <select value={cond} onChange={(e) => setCond(e.target.value)} style={SELECT}>
              <option value="all">All conditions</option>
              <option value="good">Good</option>
              <option value="fair">Fair</option>
              <option value="poor">Poor</option>
              <option value="mixed">Mixed</option>
              <option value="under_construction">Under construction</option>
            </select>
          </div>

          <div>
            <div style={LABEL}>Province</div>
            <select value={provinceFilter} onChange={(e) => { setProvinceFilter(e.target.value); setDistrictFilter("all"); }} style={SELECT}>
              <option value="all">All provinces</option>
              {Object.keys(ZIM_PROVINCES_DISTRICTS).map((p) => (
                <option key={p} value={p}>{p}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={LABEL}>District</div>
            <select
              value={districtFilter}
              onChange={(e) => setDistrictFilter(e.target.value)}
              disabled={provinceFilter === "all"}
              style={{ ...SELECT, background: provinceFilter === "all" ? "#f4f6f5" : "#fff", cursor: provinceFilter === "all" ? "not-allowed" : "pointer" }}
            >
              <option value="all">All districts</option>
              {provinceFilter !== "all" && (ZIM_PROVINCES_DISTRICTS[provinceFilter] || []).map((d) => (
                <option key={d} value={d}>{d}</option>
              ))}
            </select>
          </div>

          <div>
            <div style={LABEL}>Surveyor</div>
            <select value={surveyorFilter} onChange={(e) => setSurveyorFilter(e.target.value)} style={SELECT}>
              <option value="all">All surveyors</option>
              {surveyors.map((s) => (
                <option key={s} value={s}>{s}</option>
              ))}
            </select>
          </div>

          <div style={{ background: "var(--bg-app)", borderRadius: 10, padding: 14, border: "1px solid var(--border)" }}>
            <div style={{ fontFamily: "var(--font-title)", fontSize: 36, fontWeight: 800, color: "var(--green)", lineHeight: 1, textAlign: "center" }}>
              {job.exportCount.toLocaleString()}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", textAlign: "center", marginTop: 4 }}>
              {job.geoFmt ? "Features in ZIP" : "Rows in ZIP"}
            </div>
            <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 10, display: "flex", flexDirection: "column", gap: 3 }}>
              <span>{fileCount} file{fileCount === 1 ? "" : "s"} · one per asset table</span>
              <span>{job.filtered.length.toLocaleString()} match filters</span>
              <span>{job.selected.length.toLocaleString()} in selected types</span>
              {job.droppedTypes > 0 && <span>{job.droppedTypes.toLocaleString()} excluded by type checkboxes</span>}
              {job.geoFmt && job.withoutGeom > 0 && (
                <span style={{ color: "#b45309" }}>{job.withoutGeom.toLocaleString()} skipped — no GPS</span>
              )}
              {job.uncategorised > 0 && !selectedParams.includes("unknown") && (
                <span>{job.uncategorised} uncategorised not included</span>
              )}
            </div>
          </div>

          <button
            type="button"
            onClick={handleDownload}
            disabled={!fileCount || busy}
            style={{
              background: fileCount ? "var(--green)" : "#94a3b8",
              color: "#fff",
              border: "none",
              borderRadius: 10,
              padding: "13px",
              fontSize: 13,
              fontWeight: 700,
              cursor: fileCount ? "pointer" : "not-allowed",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: 8,
              fontFamily: "var(--font-body)",
              opacity: busy ? 0.7 : 1,
            }}
          >
            <Download size={16} /> {busy ? "Preparing…" : downloadLabel}
          </button>
          {note && <div style={{ fontSize: 11, color: "var(--text-secondary)", lineHeight: 1.4 }}>{note}</div>}
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 16, minWidth: 0 }}>
          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
              <div style={LABEL}>Asset types in this job ({selectedParams.length} selected)</div>
              <div style={{ display: "flex", gap: 12 }}>
                <button type="button" onClick={() => setSelectedParams(ALL_PARAM_KEYS)} style={{ background: "none", border: "none", color: "var(--green)", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}>Select all</button>
                <button type="button" onClick={() => setSelectedParams([])} style={{ background: "none", border: "none", color: "#dc2626", cursor: "pointer", fontSize: 11, fontWeight: 700, padding: 0 }}>Clear</button>
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 6, maxHeight: 180, overflowY: "auto", border: "1px solid var(--border)", borderRadius: 8, padding: "10px 12px", background: "var(--bg-app)" }}>
              {EXPORT_PARAMETERS.map((p) => {
                const isChecked = selectedParams.includes(p.key);
                const n = job.typeCounts[p.key] || 0;
                return (
                  <label key={p.key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 11, cursor: "pointer", color: isChecked ? "var(--text-primary)" : "var(--text-muted)", fontWeight: isChecked ? 600 : 400 }}>
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => {
                        setSelectedParams(isChecked ? selectedParams.filter((k) => k !== p.key) : [...selectedParams, p.key]);
                      }}
                      style={{ accentColor: "var(--green)" }}
                    />
                    <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.emoji} {p.label}</span>
                    <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{n}</span>
                  </label>
                );
              })}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)" }}>
            <div style={LABEL}>Files in this ZIP ({fileCount})</div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6, maxHeight: 220, overflowY: "auto" }}>
              {job.groups.map((g) => {
                const ext = fmt === "geojson" ? "geojson" : fmt;
                const omitted = job.geoFmt && g.withGeom === 0;
                return (
                  <div key={g.key} style={{ display: "flex", justifyContent: "space-between", gap: 12, fontSize: 12, padding: "6px 8px", borderRadius: 8, background: omitted ? "#fff7ed" : "var(--bg-app)", color: omitted ? "#9a3412" : "var(--text-secondary)" }}>
                    <span style={{ fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 11 }}>
                      {omitted ? `${g.table} — omitted (no GPS)` : tableFileName(g.key, ext)}
                    </span>
                    <span style={{ whiteSpace: "nowrap", fontWeight: 700, color: omitted ? "#9a3412" : "var(--green)" }}>
                      {job.geoFmt ? `${g.withGeom} features` : `${g.records.length} rows · ${g.columns.length} cols`}
                    </span>
                  </div>
                );
              })}
              {job.groups.length === 0 && <span style={{ fontSize: 11, color: "var(--text-muted)" }}>No files yet. Select at least one asset type with data.</span>}
            </div>
          </div>

          <div style={{ background: "#fff", borderRadius: 12, padding: 16, border: "1px solid var(--border)", boxShadow: "var(--shadow-sm)", overflow: "auto", flex: 1 }}>
            <div style={{ ...LABEL, marginBottom: 10 }}>
              Preview (first {Math.min(20, job.selected.length)} of {job.selected.length.toLocaleString()})
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 10.5 }}>
              <thead>
                <tr>
                  {["Asset", "Type", "Road", "Corridor", "Condition", "Date", "GPS"].map((h) => (
                    <th key={h} style={{ background: "#f0f7f3", padding: "7px 10px", textAlign: "left", fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--text-muted)", borderBottom: "2px solid var(--border)", whiteSpace: "nowrap" }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {job.selected.slice(0, 20).map((r, i) => {
                  const c = getRecordStatus(r);
                  const hid = highwayMeta.get(r)?.highway_id;
                  const hasGps = !!getExportGeometry(r);
                  return (
                    <tr
                      key={r._id ?? r.id ?? i}
                      onClick={() => onSelectRecord?.(r)}
                      title="Show on map"
                      style={{ cursor: onSelectRecord ? "pointer" : "default" }}
                      onMouseOver={(e) => { if (onSelectRecord) e.currentTarget.style.background = "var(--bg-hover)"; }}
                      onMouseOut={(e) => { e.currentTarget.style.background = "transparent"; }}
                    >
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", fontWeight: 600 }}>{getAssetName(r)}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-secondary)" }}>{getAssetType(r)}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{(r.road_name ?? "—").split(" (")[0]}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", fontWeight: 700, color: "var(--green)" }}>{hid || "—"}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)" }}><span className={`badge ${c}`}>{c}</span></td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: "var(--text-muted)", whiteSpace: "nowrap" }}>{r.survey_date ?? "—"}</td>
                      <td style={{ padding: "6px 10px", borderBottom: "1px solid rgba(0,102,51,0.06)", color: hasGps ? "#006633" : "#b45309", fontWeight: 700 }}>{hasGps ? "Yes" : "No"}</td>
                    </tr>
                  );
                })}
                {job.selected.length === 0 && (
                  <tr><td colSpan={7} style={{ padding: 16, color: "var(--text-muted)" }}>No records match this job. Widen the filters or select more asset types.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
