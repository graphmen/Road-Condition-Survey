"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

export default function ListPager({
  page,
  pageSize,
  total,
  onPage,
}: {
  page: number;
  pageSize: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize) || 1);
  const pageSafe = Math.min(Math.max(0, page), pages - 1);
  const from = total === 0 ? 0 : pageSafe * pageSize + 1;
  const to = Math.min((pageSafe + 1) * pageSize, total);

  return (
    <div
      style={{
        padding: "10px 16px",
        borderTop: "1px solid var(--border)",
        background: "#fff",
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        flexShrink: 0,
        gap: 12,
      }}
    >
      <span style={{ fontSize: 11, color: "var(--text-muted)" }}>
        Showing {from}–{to} of {total}
      </span>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button
          type="button"
          disabled={pageSafe <= 0}
          onClick={() => onPage(Math.max(0, pageSafe - 1))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: pageSafe <= 0 ? "#f3f4f6" : "#fff",
            color: "var(--text-secondary)",
            fontSize: 11,
            fontWeight: 700,
            cursor: pageSafe <= 0 ? "not-allowed" : "pointer",
            fontFamily: "var(--font-body)",
          }}
        >
          <ChevronLeft size={14} /> Prev
        </button>
        <span style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>
          Page {pageSafe + 1} / {pages}
        </span>
        <button
          type="button"
          disabled={pageSafe >= pages - 1}
          onClick={() => onPage(Math.min(pages - 1, pageSafe + 1))}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 4,
            padding: "6px 10px",
            borderRadius: 8,
            border: "1px solid var(--border)",
            background: pageSafe >= pages - 1 ? "#f3f4f6" : "#fff",
            color: "var(--text-secondary)",
            fontSize: 11,
            fontWeight: 700,
            cursor: pageSafe >= pages - 1 ? "not-allowed" : "pointer",
            fontFamily: "var(--font-body)",
          }}
        >
          Next <ChevronRight size={14} />
        </button>
      </div>
    </div>
  );
}

export const LIST_FILTER: React.CSSProperties = {
  padding: "8px 12px",
  border: "1px solid rgba(0,102,51,0.2)",
  borderRadius: 8,
  fontSize: 12,
  outline: "none",
  fontFamily: "var(--font-body)",
  color: "var(--text-secondary)",
  background: "#fff",
};
