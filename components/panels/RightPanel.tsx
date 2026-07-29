"use client";
import React from "react";
import { ChevronRight } from "lucide-react";
import {
  ResponsiveContainer, PieChart, Pie, Cell, Legend,
  BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip,
} from "recharts";
import { getRecordStatus, getAssetType, getAssetName, formatStatusLabel, getStatusColor, normalizePhotos, mergePhotoLists, getSadcValue, AUTHORITY_OPTIONS, CONDITION_WITH_CONSTRUCTION_OPTIONS } from "@/components/helpers";

interface RightPanelProps {
  records: any[];
  selectedRecord: any | null;
  onClose: () => void;
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

const CORE_DISPLAYED_KEYS = new Set([
  "road_name",
  "section_name",
  "surveyor_name",
  "survey_date",
  "province",
  "district",
  "asset_category",
  "section",
  "road_condition",
  "source",
  "image_SADC_compliant",
  "image_sadc_compliant",
  "sadc_compliant",
  "sign_sadc_compliant"
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


// -- Photos Section Component -------------------------------------------------
function PhotosSection({ photos }: { photos: string[] }) {
  const [lightbox, setLightbox] = React.useState<number | null>(null);
  return (
    <div style={{ marginBottom: 12 }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
        <span style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.6px", color: "var(--text-muted)" }}>
          Photos Collected
        </span>
        <span style={{ fontSize: 10, fontWeight: 600, background: photos.length > 0 ? "rgba(0,102,51,0.12)" : "rgba(0,0,0,0.06)", color: photos.length > 0 ? "#006633" : "var(--text-muted)", borderRadius: 20, padding: "1px 8px" }}>
          {photos.length} photo{photos.length !== 1 ? "s" : ""}
        </span>
      </div>
      {photos.length === 0 ? (
        <div style={{ textAlign: "center", padding: "14px 0", color: "var(--text-muted)", fontSize: 10.5, background: "rgba(0,0,0,0.025)", borderRadius: 8, border: "1px dashed rgba(0,0,0,0.1)" }}>
          No photos captured for this asset
        </div>
      ) : (
        <>
          <div style={{ display: "grid", gridTemplateColumns: photos.length === 1 ? "1fr" : "1fr 1fr", gap: 5 }}>
            {photos.slice(0, 6).map((src, idx) => (
              <div key={idx} onClick={() => setLightbox(idx)} style={{ borderRadius: 7, overflow: "hidden", border: "1px solid rgba(0,102,51,0.15)", aspectRatio: "4/3", cursor: "pointer", position: "relative", boxShadow: "0 2px 6px rgba(0,0,0,0.08)" }}>
                <img src={src} alt={`Photo ${idx + 1}`} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                {idx === 5 && photos.length > 6 && (
                  <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 14, fontWeight: 700 }}>
                    +{photos.length - 5} more
                  </div>
                )}
              </div>
            ))}
          </div>
          {lightbox !== null && (
            <div onClick={() => setLightbox(null)} style={{ position: "fixed", inset: 0, zIndex: 9999, background: "rgba(0,0,0,0.9)", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: 12 }}>
              <img src={photos[lightbox]} alt={`Photo ${lightbox + 1}`} style={{ maxWidth: "90vw", maxHeight: "80vh", objectFit: "contain", borderRadius: 8, boxShadow: "0 8px 32px rgba(0,0,0,0.5)" }} />
              <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
                <button onClick={e => { e.stopPropagation(); setLightbox(i => i !== null && i > 0 ? i - 1 : i); }} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, color: "#fff", padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>&#8592;</button>
                <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12 }}>{lightbox + 1} / {photos.length}</span>
                <button onClick={e => { e.stopPropagation(); setLightbox(i => i !== null && i < photos.length - 1 ? i + 1 : i); }} style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: 6, color: "#fff", padding: "6px 14px", cursor: "pointer", fontSize: 13 }}>&#8594;</button>
                <button onClick={() => setLightbox(null)} style={{ background: "rgba(220,38,38,0.8)", border: "none", borderRadius: 6, color: "#fff", padding: "6px 14px", cursor: "pointer", fontSize: 12, marginLeft: 8 }}>Close</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
export default function RightPanel({ records, selectedRecord, onClose }: RightPanelProps) {
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
  const [fetchedPhotos, setFetchedPhotos] = React.useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = React.useState<boolean>(false);

  const selectedPhotos = React.useMemo(
    () => mergePhotoLists(selectedRecord ? normalizePhotos(selectedRecord) : [], fetchedPhotos),
    [selectedRecord, fetchedPhotos]
  );

  React.useEffect(() => {
    setFetchedPhotos([]);
    if (!selectedRecord) return;

    const id = selectedRecord.id || selectedRecord._id || selectedRecord.survey_id;
    if (!id) return;

    setLoadingPhotos(true);
    fetch(`/api/roads?photoFor=${encodeURIComponent(id)}`)
      .then(res => res.json())
      .then(data => {
        const remote = Array.isArray(data.photos) && data.photos.length > 0
          ? data.photos
          : (data.photo ? [data.photo] : []);
        if (remote.length > 0) setFetchedPhotos(remote);
      })
      .catch(() => {})
      .finally(() => setLoadingPhotos(false));
  }, [selectedRecord]);
  const selectedStatus = selectedRecord ? getRecordStatus(selectedRecord) : "good";

  const dynamicRows = selectedRecord
    ? Object.entries(selectedRecord)
        .filter(([key, val]) => {
          if (EXCLUDED_KEYS.has(key)) return false;
          if (CORE_DISPLAYED_KEYS.has(key)) return false;
          if (val === null || val === undefined || val === "") return false;
          return true;
        })
        .map(([key, val]) => ({
          key,
          label: formatKey(key),
          value: formatValue(val),
        }))
    : [];

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

        {/* --- Asset Inspector ----------------------------------- */}
        {selectedRecord ? (
          <div>
            <div className="section-label">Asset Inspector</div>
            <div className="inspector-block" style={{ marginTop: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 6 }}>
                <div>
                  <div className="inspector-name">{getAssetName(selectedRecord)}</div>
                  <div className="inspector-type">{getAssetType(selectedRecord)}</div>
                </div>
                <span className={`badge ${selectedStatus}`}>
                  {formatStatusLabel(selectedStatus)}
                </span>
              </div>

              {/* --- Photos Section --------------------------------- */}
              <PhotosSection photos={selectedPhotos} />


              <div className="detail-rows">
                <div className="detail-row">
                  <span className="detail-row-label">Road Route</span>
                  <span className="detail-row-val">{(selectedRecord.road_name ?? "—").split(" (")[0]}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-row-label">Section</span>
                  <span className="detail-row-val">{selectedRecord.section_name ?? "—"}</span>
                </div>
                {selectedRecord.province && (
                  <div className="detail-row">
                    <span className="detail-row-label">Province</span>
                    <span className="detail-row-val">{selectedRecord.province}</span>
                  </div>
                )}
                {selectedRecord.district && (
                  <div className="detail-row">
                    <span className="detail-row-label">District</span>
                    <span className="detail-row-val">{selectedRecord.district}</span>
                  </div>
                )}
                <div className="detail-row">
                  <span className="detail-row-label">Surveyor</span>
                  <span className="detail-row-val">{selectedRecord.surveyor_name ?? "—"}</span>
                </div>
                <div className="detail-row">
                  <span className="detail-row-label">Date</span>
                  <span className="detail-row-val">{selectedRecord.survey_date ?? "—"}</span>
                </div>

                {/* Coordinates */}
                {Array.isArray(selectedRecord._geolocation) && typeof selectedRecord._geolocation[0] === "number" && (
                  <div className="detail-row">
                    <span className="detail-row-label">GPS</span>
                    <span className="detail-row-val" style={{ fontSize: 10 }}>
                      {selectedRecord._geolocation[0].toFixed(5)}, {selectedRecord._geolocation[1].toFixed(5)}
                    </span>
                  </div>
                )}

                {/* SADC Sign Compliance (if present) */}
                {(selectedRecord.image_SADC_compliant || selectedRecord.image_sadc_compliant || selectedRecord.sadc_compliant || selectedRecord.sign_sadc_compliant) && (
                  <div className="detail-row">
                    <span className="detail-row-label">SADC Compliant</span>
                    <span className="detail-row-val">{(getSadcValue(selectedRecord) || "—").toUpperCase()}</span>
                  </div>
                )}

                {/* Dynamic Telemetry Attributes */}
                {dynamicRows.length > 0 && (
                  <>
                    <div style={{ fontSize: 9.5, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.5px", color: "var(--green)", borderTop: "1px solid var(--border)", paddingTop: 8, marginTop: 8, marginBottom: 4 }}>
                      Telemetry Attributes
                    </div>
                    {dynamicRows.map(row => (
                      <div className="detail-row" key={row.key}>
                        <span className="detail-row-label">{row.label}</span>
                        <span className="detail-row-val">{row.value}</span>
                      </div>
                    ))}
                  </>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "14px", background: "var(--bg-app)", borderRadius: "var(--radius-md)", border: "1px dashed var(--border)", textAlign: "center", fontSize: 11, color: "var(--text-muted)" }}>
            Click a map marker or asset card to inspect details
          </div>
        )}

        {/* --- Condition Distribution ---------------------------- */}
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
                <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 0", borderBottom: i < topPoor.length - 1 ? "1px solid var(--border)" : "none", fontSize: 11 }}>
                  <div>
                    <div style={{ fontWeight: 600, color: "var(--text-primary)" }}>{getAssetName(r)}</div>
                    <div style={{ fontSize: 9.5, color: "var(--text-muted)" }}>{(r.road_name ?? "—").split(" (")[0]}</div>
                  </div>
                  <ChevronRight size={13} color="var(--text-muted)" />
                </div>
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
