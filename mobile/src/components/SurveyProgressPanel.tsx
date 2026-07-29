import type { SurveyDraft } from "../lib/db";
import { PAUSED_ROAD_CONTEXT_KEY, SEGMENT_SESSION_KEY } from "./SegmentTracker";

type PausedCtx = {
  roadCategory: string;
  roadName: string;
  sectionName: string;
  pointCount: number;
  length_m: number;
};

type Props = {
  drafts: SurveyDraft[];
};

function readPaused(): PausedCtx | null {
  try {
    const raw = localStorage.getItem(PAUSED_ROAD_CONTEXT_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function readActiveSegmentPoints(): number {
  try {
    const raw = localStorage.getItem(SEGMENT_SESSION_KEY);
    if (!raw) return 0;
    const s = JSON.parse(raw);
    return Array.isArray(s.points) ? s.points.length : 0;
  } catch {
    return 0;
  }
}

export function SurveyProgressPanel({ drafts }: Props) {
  const paused = readPaused();
  const activePts = readActiveSegmentPoints();

  const byHighway = new Map<
    string,
    { drafts: number; queued: number; segments: number; lastSection: string }
  >();

  for (const d of drafts) {
    const key = d.road_name?.trim() || "(Unnamed route)";
    const row = byHighway.get(key) ?? {
      drafts: 0,
      queued: 0,
      segments: 0,
      lastSection: "",
    };
    if (d.status === "queued") row.queued += 1;
    else row.drafts += 1;
    if (d.road_segment_length_m) row.segments += 1;
    if (d.section_name) row.lastSection = d.section_name;
    byHighway.set(key, row);
  }

  const highways = [...byHighway.entries()].sort((a, b) => a[0].localeCompare(b[0]));

  return (
    <div
      style={{
        border: "1px solid var(--border-color)",
        borderRadius: "var(--radius-md)",
        padding: "12px",
        display: "flex",
        flexDirection: "column",
        gap: "10px",
        background: "var(--bg-card)",
      }}
    >
      <div>
        <p style={{ margin: 0, fontSize: "12px", fontWeight: 800, color: "var(--text-accent)" }}>
          Survey progress
        </p>
        <p style={{ margin: "4px 0 0", fontSize: "10px", color: "var(--text-muted)" }}>
          What you have collected and where you left off on each highway.
        </p>
      </div>

      {paused && (
        <div
          style={{
            padding: "8px 10px",
            borderRadius: "var(--radius-sm)",
            background: "rgba(245, 158, 11, 0.1)",
            border: "1px solid rgba(245, 158, 11, 0.35)",
            fontSize: "11px",
          }}
        >
          <strong style={{ color: "#d97706" }}>Paused line survey</strong>
          <div style={{ marginTop: 4, color: "var(--text-muted)" }}>
            {paused.roadCategory} · {paused.roadName || "—"}
            <br />
            Section: {paused.sectionName || "—"} · {paused.pointCount || activePts} GPS pts ·{" "}
            {(paused.length_m / 1000).toFixed(2)} km recorded
          </div>
        </div>
      )}

      {highways.length === 0 ? (
        <p style={{ margin: 0, fontSize: "11px", color: "var(--text-muted)" }}>
          No surveys saved yet. Completed segments and point assets will appear here grouped by highway.
        </p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: "6px", maxHeight: 220, overflowY: "auto" }}>
          {highways.map(([name, stats]) => (
            <div
              key={name}
              style={{
                padding: "8px 10px",
                borderRadius: "var(--radius-sm)",
                border: "1px solid var(--border-color)",
                fontSize: "11px",
              }}
            >
              <div style={{ fontWeight: 700, color: "var(--text-primary)" }}>{name}</div>
              <div style={{ color: "var(--text-muted)", marginTop: 2 }}>
                {stats.segments} segment{stats.segments !== 1 ? "s" : ""} · {stats.queued} queued ·{" "}
                {stats.drafts} draft{stats.drafts !== 1 ? "s" : ""}
                {stats.lastSection ? ` · Last: ${stats.lastSection}` : ""}
              </div>
            </div>
          ))}
        </div>
      )}

      <p style={{ margin: 0, fontSize: "9px", color: "var(--text-muted)" }}>
        Totals: {drafts.filter((d) => d.status === "queued").length} queued ·{" "}
        {drafts.filter((d) => d.status !== "queued").length} in progress
      </p>
    </div>
  );
}
