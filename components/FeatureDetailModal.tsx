"use client";

import { useEffect, useMemo, useState } from "react";
import { X } from "lucide-react";
import {
  getRecordStatus,
  getAssetType,
  getAssetName,
  formatStatusLabel,
  getSadcValue,
  normalizePhotos,
  mergePhotoLists,
} from "@/components/helpers";

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
  "sign_sadc_compliant",
]);

function formatKey(key: string): string {
  return key.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function formatValue(val: any): string {
  if (val === null || val === undefined) return "—";
  if (typeof val === "boolean") return val ? "YES" : "NO";
  const s = String(val);
  if (s.toLowerCase() === "yes" || s.toLowerCase() === "no") return s.toUpperCase();
  return s.replace(/_/g, " ").toUpperCase();
}

function PhotosSection({ photos, loading }: { photos: string[]; loading?: boolean }) {
  const [lightbox, setLightbox] = useState<number | null>(null);
  return (
    <div className="feature-modal-photos">
      <div className="feature-modal-photos-head">
        <span>Photos collected</span>
        <span>{loading ? "…" : `${photos.length} photo${photos.length !== 1 ? "s" : ""}`}</span>
      </div>
      {loading ? (
        <div className="feature-modal-photos-empty">Loading photos from server…</div>
      ) : photos.length === 0 ? (
        <div className="feature-modal-photos-empty">No photos captured for this asset</div>
      ) : (
        <div className={`feature-modal-photo-grid${photos.length === 1 ? " single" : ""}`}>
          {photos.slice(0, 6).map((src, idx) => (
            <button
              key={idx}
              type="button"
              className="feature-modal-photo"
              onClick={() => setLightbox(idx)}
            >
              <img src={src} alt={`Photo ${idx + 1}`} />
              {idx === 5 && photos.length > 6 && (
                <span className="feature-modal-photo-more">+{photos.length - 5} more</span>
              )}
            </button>
          ))}
        </div>
      )}
      {lightbox !== null && (
        <div className="feature-lightbox" onClick={() => setLightbox(null)}>
          <img src={photos[lightbox]} alt={`Photo ${lightbox + 1}`} onClick={(e) => e.stopPropagation()} />
          <div className="feature-lightbox-bar" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setLightbox((i) => (i !== null && i > 0 ? i - 1 : i))}>←</button>
            <span>{lightbox + 1} / {photos.length}</span>
            <button type="button" onClick={() => setLightbox((i) => (i !== null && i < photos.length - 1 ? i + 1 : i))}>→</button>
            <button type="button" className="feature-lightbox-close" onClick={() => setLightbox(null)}>Close</button>
          </div>
        </div>
      )}
    </div>
  );
}

interface FeatureDetailModalProps {
  record: any;
  onClose: () => void;
}

export default function FeatureDetailModal({ record, onClose }: FeatureDetailModalProps) {
  const [fetchedPhotos, setFetchedPhotos] = useState<string[]>([]);
  const [loadingPhotos, setLoadingPhotos] = useState(false);
  const status = getRecordStatus(record);
  const photos = useMemo(
    () => mergePhotoLists(normalizePhotos(record), fetchedPhotos),
    [record, fetchedPhotos]
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  useEffect(() => {
    setFetchedPhotos([]);
    const id = record?.id || record?._id || record?.survey_id;
    if (!id) return;
    const embedded = normalizePhotos(record);
    if (embedded.length > 0) {
      setFetchedPhotos(embedded);
      return;
    }
    setLoadingPhotos(true);
    fetch(`/api/roads?photoFor=${encodeURIComponent(id)}`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        const remote = Array.isArray(data.photos) && data.photos.length > 0
          ? data.photos
          : (data.photo ? [data.photo] : []);
        if (remote.length > 0) setFetchedPhotos(remote);
      })
      .catch(() => {})
      .finally(() => setLoadingPhotos(false));
  }, [record]);

  const extraRows = Object.entries(record || {})
    .filter(([key, val]) => {
      if (EXCLUDED_KEYS.has(key) || CORE_DISPLAYED_KEYS.has(key)) return false;
      if (val === null || val === undefined || val === "") return false;
      if (typeof val === "object") return false;
      return true;
    })
    .map(([key, val]) => ({
      key,
      label: formatKey(key),
      value: formatValue(val),
    }));

  return (
    <div className="feature-modal-backdrop" onClick={onClose} role="presentation">
      <div
        className="feature-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="feature-modal-title"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="feature-modal-header">
          <div>
            <div id="feature-modal-title" className="feature-modal-title">{getAssetName(record)}</div>
            <div className="feature-modal-type">{getAssetType(record)}</div>
          </div>
          <div className="feature-modal-header-actions">
            <span className={`badge ${status}`}>{formatStatusLabel(status)}</span>
            <button type="button" className="feature-modal-close" onClick={onClose} aria-label="Close details">
              <X size={16} />
            </button>
          </div>
        </header>

        <div className="feature-modal-body">
          <PhotosSection photos={photos} loading={loadingPhotos} />
          <div className="detail-rows">
            <div className="detail-row">
              <span className="detail-row-label">Road Route</span>
              <span className="detail-row-val">{(record.road_name ?? "—").split(" (")[0]}</span>
            </div>
            <div className="detail-row">
              <span className="detail-row-label">Section</span>
              <span className="detail-row-val">{record.section_name ?? "—"}</span>
            </div>
            {record.province && (
              <div className="detail-row">
                <span className="detail-row-label">Province</span>
                <span className="detail-row-val">{record.province}</span>
              </div>
            )}
            {record.district && (
              <div className="detail-row">
                <span className="detail-row-label">District</span>
                <span className="detail-row-val">{record.district}</span>
              </div>
            )}
            <div className="detail-row">
              <span className="detail-row-label">Surveyor</span>
              <span className="detail-row-val">{record.surveyor_name ?? "—"}</span>
            </div>
            <div className="detail-row">
              <span className="detail-row-label">Date</span>
              <span className="detail-row-val">{record.survey_date ?? "—"}</span>
            </div>
            {Array.isArray(record._geolocation) && typeof record._geolocation[0] === "number" && (
              <div className="detail-row">
                <span className="detail-row-label">GPS</span>
                <span className="detail-row-val" style={{ fontSize: 10 }}>
                  {record._geolocation[0].toFixed(5)}, {record._geolocation[1].toFixed(5)}
                </span>
              </div>
            )}
            {(record.image_SADC_compliant || record.image_sadc_compliant || record.sadc_compliant || record.sign_sadc_compliant) && (
              <div className="detail-row">
                <span className="detail-row-label">SADC Compliant</span>
                <span className="detail-row-val">{(getSadcValue(record) || "—").toUpperCase()}</span>
              </div>
            )}
            {extraRows.length > 0 && (
              <>
                <div className="feature-modal-section-label">Telemetry attributes</div>
                {extraRows.map((row) => (
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
    </div>
  );
}
