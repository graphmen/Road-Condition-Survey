"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ChevronLeft, ChevronRight, Search } from "lucide-react";
import {
  formatStatusLabel,
  getAssetName,
  getAssetType,
  getRecordStatus,
  getSadcValue,
  getStatusColor,
  normalizePhotos,
} from "@/components/helpers";
import { OVERLAY_GROUPS } from "@/lib/mapLayers";
import { useCategoryBrowse } from "@/hooks/useCategoryBrowse";

const GALLERY_PAGE_SIZE = 24;

function GalleryCard({
  record,
  onSelectRecord,
  onOpenLightbox,
}: {
  record: any;
  onSelectRecord: (r: any) => void;
  onOpenLightbox: (record: any, photos: string[]) => void;
}) {
  const [photos, setPhotos] = useState<string[]>(() => normalizePhotos(record));
  const [loading, setLoading] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { rootMargin: "120px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const initial = normalizePhotos(record);
    setPhotos(initial);
    if (!inView) return;
    if (initial.length > 0) return;

    const id = record.id || record._id || record.survey_id;
    if (!id) return;

    setLoading(true);
    fetch(`/api/roads?photoFor=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const remote = Array.isArray(data.photos) && data.photos.length > 0
          ? data.photos
          : (data.photo ? [data.photo] : []);
        if (remote.length > 0) setPhotos(remote);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [record, inView]);

  const cat = getAssetType(record);
  const name = getAssetName(record);
  const status = getRecordStatus(record);
  const statusColor = getStatusColor(status);
  const sadc = getSadcValue(record);
  const mainPhoto = photos[0];

  return (
    <div
      ref={cardRef}
      style={{
        background: "#fff",
        borderRadius: 12,
        border: "1px solid var(--border)",
        overflow: "hidden",
        display: "flex",
        flexDirection: "column",
        boxShadow: "0 2px 8px rgba(0,0,0,0.04)",
        transition: "transform 0.2s, box-shadow 0.2s",
      }}
      onMouseOver={(e) => {
        e.currentTarget.style.transform = "translateY(-3px)";
        e.currentTarget.style.boxShadow = "0 8px 20px rgba(0,0,0,0.1)";
      }}
      onMouseOut={(e) => {
        e.currentTarget.style.transform = "translateY(0)";
        e.currentTarget.style.boxShadow = "0 2px 8px rgba(0,0,0,0.04)";
      }}
    >
      <div
        onClick={() => photos.length > 0 && onOpenLightbox(record, photos)}
        style={{
          position: "relative",
          height: 180,
          background: "rgba(0,0,0,0.04)",
          cursor: photos.length > 0 ? "pointer" : "default",
          overflow: "hidden",
        }}
      >
        {mainPhoto ? (
          <img src={mainPhoto} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
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

        <div style={{ position: "absolute", top: 10, left: 10, right: 10, display: "flex", justifyContent: "space-between", pointerEvents: "none" }}>
          <span style={{ background: "rgba(0,0,0,0.65)", backdropFilter: "blur(4px)", color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, textTransform: "uppercase", letterSpacing: "0.5px" }}>
            {cat}
          </span>
          <span style={{ background: statusColor, color: "#fff", fontSize: 9.5, fontWeight: 700, padding: "3px 8px", borderRadius: 20, textTransform: "uppercase" }}>
            {formatStatusLabel(status)}
          </span>
        </div>

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

      <div style={{ padding: "12px 14px", flex: 1, display: "flex", flexDirection: "column", justifyContent: "space-between" }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: 13, color: "var(--text-primary)", marginBottom: 4, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }} title={name}>
            {name}
          </div>
          <div style={{ fontSize: 10.5, color: "var(--text-secondary)", marginBottom: 8, display: "flex", alignItems: "center", gap: 4 }}>
            <span>📍</span>
            <span>{record.province || "—"} · {record.district || "—"}</span>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4, fontSize: 9.5, color: "var(--text-muted)", background: "rgba(0,0,0,0.02)", padding: "6px 8px", borderRadius: 6, marginBottom: 10 }}>
            <div><strong style={{ color: "var(--text-secondary)" }}>Surveyor:</strong> {record.surveyor_name || "N/A"}</div>
            <div><strong style={{ color: "var(--text-secondary)" }}>Date:</strong> {record.survey_date || "N/A"}</div>
          </div>
        </div>

        <div style={{ display: "flex", gap: 8, marginTop: 4 }}>
          <button
            type="button"
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
              gap: 4,
            }}
          >
            <span>🔍</span> View Photos ({photos.length})
          </button>
          <button
            type="button"
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
              gap: 4,
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

export default function GalleryPage({
  onSelectRecord,
}: {
  records?: any[];
  onSelectRecord: (r: any) => void;
}) {
  const [category, setCategory] = useState("sealed");
  const [search, setSearch] = useState("");
  const [searchDebounced, setSearchDebounced] = useState("");
  const [cond, setCond] = useState("all");
  const [road, setRoad] = useState("all");
  const [sadcFilter, setSadcFilter] = useState("all");
  const [surveyorFilter, setSurveyorFilter] = useState("all");
  const [page, setPage] = useState(0);
  const [lightbox, setLightbox] = useState<{ record: any; photos: string[]; index: number } | null>(null);

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
  } = useCategoryBrowse({
    category,
    page,
    pageSize: GALLERY_PAGE_SIZE,
    search: searchDebounced,
    condition: cond,
    road,
    surveyor: surveyorFilter,
    sadc: sadcFilter,
  });

  const workingTotal = total;
  const pages = Math.max(1, Math.ceil(workingTotal / GALLERY_PAGE_SIZE));
  const pageSafe = Math.min(page, pages - 1);
  const visibleRows = pageRecords;

  useEffect(() => {
    if (page > pages - 1) setPage(Math.max(0, pages - 1));
  }, [page, pages]);

  const activeLabel =
    OVERLAY_GROUPS.flatMap((g) => g.items).find((i) => i.key === category)?.label ?? category;

  const surveyorsList = surveyors;
  const highwayOptions = roads;

  const selectCategory = (key: string) => {
    setCategory(key);
    setRoad("all");
    setSurveyorFilter("all");
    setPage(0);
    setLightbox(null);
  };

  return (
    <div style={{ height: "100%", display: "flex", background: "var(--bg-app)", position: "relative", overflow: "hidden" }}>
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

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column", overflow: "hidden" }}>
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
            {activeLabel} · photo gallery
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
            {highwayOptions.map((r) => (
              <option key={r} value={r}>{(r ?? "").split(" (")[0]}</option>
            ))}
          </select>
          <select
            value={surveyorFilter}
            onChange={(e) => { setSurveyorFilter(e.target.value); setPage(0); }}
            style={{ padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)", background: "#fff" }}
          >
            <option value="all">All Surveyors</option>
            {surveyorsList.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
          <select
            value={sadcFilter}
            onChange={(e) => { setSadcFilter(e.target.value); setPage(0); }}
            style={{ padding: "8px 12px", border: "1px solid rgba(0,102,51,0.2)", borderRadius: 8, fontSize: 12, outline: "none", fontFamily: "var(--font-body)", color: "var(--text-secondary)", background: "#fff" }}
          >
            <option value="all">SADC Compliance (All)</option>
            <option value="yes">SADC Compliant</option>
            <option value="no">Non-Compliant</option>
          </select>
          <span style={{ fontSize: 11, color: "var(--text-muted)", whiteSpace: "nowrap" }}>
            {loading ? "Loading…" : `${workingTotal} records`}
          </span>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "14px 20px" }}>
          {error ? (
            <div style={{ textAlign: "center", color: "#dc2626", padding: 40, fontSize: 13 }}>{error}</div>
          ) : loading && visibleRows.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 13 }}>Loading {activeLabel.toLowerCase()}…</div>
          ) : visibleRows.length === 0 ? (
            <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 40, fontSize: 13 }}>
              <Camera size={36} style={{ opacity: 0.25, marginBottom: 10 }} />
              <div>No {activeLabel.toLowerCase()} match your filters.</div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14, opacity: loading ? 0.6 : 1 }}>
              {visibleRows.map((r, i) => {
                const id = String(r.id || r._id || r.survey_id || "");
                return (
                  <GalleryCard
                    key={id || `${category}-${pageSafe}-${i}`}
                    record={r}
                    onSelectRecord={onSelectRecord}
                    onOpenLightbox={(record, photos) => setLightbox({ record, photos, index: 0 })}
                  />
                );
              })}
            </div>
          )}
        </div>

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
            Showing {workingTotal === 0 ? 0 : pageSafe * GALLERY_PAGE_SIZE + 1}–
            {Math.min((pageSafe + 1) * GALLERY_PAGE_SIZE, workingTotal)} of {workingTotal}
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
            padding: 24,
          }}
        >
          <div onClick={(e) => e.stopPropagation()} style={{ width: "100%", maxWidth: 1000, display: "flex", justifyContent: "space-between", alignItems: "center", color: "#fff" }}>
            <div>
              <div style={{ fontSize: 16, fontWeight: 800 }}>{getAssetName(lightbox.record)}</div>
              <div style={{ fontSize: 11, color: "rgba(255,255,255,0.6)" }}>
                {getAssetType(lightbox.record)} · {lightbox.record.province || "—"} · {lightbox.record.surveyor_name ? `Surveyor: ${lightbox.record.surveyor_name}` : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
              <button
                type="button"
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
                type="button"
                onClick={() => setLightbox(null)}
                style={{ background: "rgba(255,255,255,0.15)", border: "none", borderRadius: "50%", color: "#fff", width: 36, height: 36, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}
              >
                ✕
              </button>
            </div>
          </div>

          <div onClick={(e) => e.stopPropagation()} style={{ position: "relative", width: "100%", maxWidth: 1000, flex: 1, display: "flex", alignItems: "center", justifyContent: "center", margin: "16px 0" }}>
            <img
              src={lightbox.photos[lightbox.index]}
              alt="Full inspection photo"
              style={{ maxWidth: "100%", maxHeight: "75vh", objectFit: "contain", borderRadius: 10, boxShadow: "0 12px 40px rgba(0,0,0,0.6)" }}
            />
            {lightbox.photos.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setLightbox((prev) => prev ? { ...prev, index: (prev.index - 1 + prev.photos.length) % prev.photos.length } : null)}
                  style={{ position: "absolute", left: 10, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", color: "#fff", width: 44, height: 44, fontSize: 18, cursor: "pointer" }}
                >
                  ←
                </button>
                <button
                  type="button"
                  onClick={() => setLightbox((prev) => prev ? { ...prev, index: (prev.index + 1) % prev.photos.length } : null)}
                  style={{ position: "absolute", right: 10, background: "rgba(0,0,0,0.6)", border: "1px solid rgba(255,255,255,0.2)", borderRadius: "50%", color: "#fff", width: 44, height: 44, fontSize: 18, cursor: "pointer" }}
                >
                  →
                </button>
              </>
            )}
          </div>

          <div onClick={(e) => e.stopPropagation()} style={{ color: "rgba(255,255,255,0.8)", fontSize: 12, fontWeight: 700, background: "rgba(255,255,255,0.1)", padding: "4px 14px", borderRadius: 20 }}>
            Photo {lightbox.index + 1} of {lightbox.photos.length}
          </div>
        </div>
      )}
    </div>
  );
}
