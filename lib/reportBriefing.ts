import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";
import {
  getAssetName,
  getAssetType,
  getCategoryKey,
  getRecordStatus,
  formatGpsLabel,
  type UserProfile,
} from "@/components/helpers";
import { HIGHWAY_CORRIDORS, matchHighwayId } from "@/lib/highways";
import { EXPORT_PARAMETERS } from "@/lib/exportData";

export type ReportLevel = "national" | "provincial" | "district";

export type ReportScope = {
  level: ReportLevel;
  province: string;
  district: string;
  highway: string;
  category: string;
  dateFrom: string;
  dateTo: string;
};

export type CondRow = {
  key: string;
  label: string;
  good: number;
  fair: number;
  poor: number;
  mixed: number;
  uc: number;
  total: number;
  poorPct: number;
  goodPct: number;
  fairPct: number;
};

export type Briefing = {
  scope: ReportScope;
  title: string;
  scopeLine: string;
  periodLabel: string;
  generatedAt: Date;
  total: number;
  good: number;
  fair: number;
  poor: number;
  mixed: number;
  uc: number;
  goodPct: number;
  fairPct: number;
  poorPct: number;
  surveyors: number;
  categoryRows: CondRow[];
  corridorRows: CondRow[];
  worstCorridor: CondRow | null;
  worstTypes: CondRow[];
  poorAssets: any[];
};

const ROLE_LABEL: Record<string, string> = {
  master_admin: "Master Administrator",
  ict_admin: "ICT Administrator",
  national_coordinator: "National Coordinator",
  provincial_coordinator: "Provincial Coordinator",
  district_coordinator: "District Coordinator",
  data_collector: "Data Collector",
};

export function roleLabel(role?: string): string {
  return (role && ROLE_LABEL[role]) || "Roads Department officer";
}

export function surveyDay(record: any): string | null {
  const raw = record?.survey_date || record?.created_at;
  if (!raw) return null;
  const s = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(s) ? s : null;
}

function emptyRow(key: string, label: string): CondRow {
  return { key, label, good: 0, fair: 0, poor: 0, mixed: 0, uc: 0, total: 0, poorPct: 0, goodPct: 0, fairPct: 0 };
}

function bump(row: CondRow, status: string) {
  row.total += 1;
  if (status === "good") row.good += 1;
  else if (status === "fair") row.fair += 1;
  else if (status === "poor") row.poor += 1;
  else if (status === "mixed") row.mixed += 1;
  else if (status === "under_construction") row.uc += 1;
}

function finish(row: CondRow): CondRow {
  row.poorPct = row.total ? Math.round((row.poor / row.total) * 100) : 0;
  row.goodPct = row.total ? Math.round((row.good / row.total) * 100) : 0;
  row.fairPct = row.total ? Math.round((row.fair / row.total) * 100) : 0;
  return row;
}

function categoryLabel(key: string): string {
  return EXPORT_PARAMETERS.find((p) => p.key === key)?.label || key.replace(/_/g, " ");
}

export function filterReportRecords(records: any[], scope: ReportScope): any[] {
  return records.filter((r) => {
    if (scope.level === "provincial" && scope.province !== "all" && r.province !== scope.province) return false;
    if (scope.level === "district") {
      if (scope.province !== "all" && r.province !== scope.province) return false;
      if (scope.district !== "all" && r.district !== scope.district) return false;
    }
    if (scope.highway !== "all" && matchHighwayId(r) !== scope.highway) return false;
    if (scope.category !== "all" && (getCategoryKey(r) || "unknown") !== scope.category) return false;
    const day = surveyDay(r);
    if (scope.dateFrom && (!day || day < scope.dateFrom)) return false;
    if (scope.dateTo && (!day || day > scope.dateTo)) return false;
    return true;
  });
}

export function buildBriefing(records: any[], scope: ReportScope): Briefing {
  const filtered = filterReportRecords(records, scope);
  const tot = emptyRow("all", "All assets");
  const catMap = new Map<string, CondRow>();
  const corrMap: Record<string, CondRow> = {};
  for (const h of HIGHWAY_CORRIDORS) corrMap[h.id] = emptyRow(h.id, `${h.id} ${h.name}`);
  const surveyorSet = new Set<string>();
  const poorAssets: any[] = [];

  for (const r of filtered) {
    const status = getRecordStatus(r);
    bump(tot, status);
    const ck = getCategoryKey(r) || "unknown";
    if (!catMap.has(ck)) catMap.set(ck, emptyRow(ck, categoryLabel(ck)));
    bump(catMap.get(ck)!, status);
    const hid = matchHighwayId(r);
    if (hid && corrMap[hid]) bump(corrMap[hid], status);
    const sName = String(r.surveyor_name || "").trim();
    if (sName) surveyorSet.add(sName);
    if (status === "poor") poorAssets.push(r);
  }

  finish(tot);
  const categoryRows = Array.from(catMap.values()).map(finish).sort((a, b) => b.total - a.total);
  const corridorRows = HIGHWAY_CORRIDORS.map((h) => finish(corrMap[h.id]));
  const worstCorridor = [...corridorRows].filter((h) => h.total >= 50).sort((a, b) => b.poorPct - a.poorPct)[0]
    || [...corridorRows].filter((h) => h.total > 0).sort((a, b) => b.poor - a.poor)[0]
    || null;
  const worstTypes = [...categoryRows].filter((c) => c.poor > 0).sort((a, b) => b.poor - a.poor).slice(0, 3);

  poorAssets.sort((a, b) => String(b.survey_date || "").localeCompare(String(a.survey_date || "")));

  const corridor = HIGHWAY_CORRIDORS.find((h) => h.id === scope.highway);
  const levelTitle =
    scope.level === "national" ? "Zimbabwe national road network"
    : scope.level === "provincial" ? `${scope.province === "all" ? "All provinces" : scope.province} provincial network`
    : `${scope.district === "all" ? scope.province : scope.district} district network`;

  const bits = [levelTitle];
  if (corridor) bits.push(`${corridor.id} ${corridor.name}`);
  if (scope.category !== "all") bits.push(categoryLabel(scope.category));

  const days = filtered.map(surveyDay).filter(Boolean).sort() as string[];
  const periodLabel = days.length
    ? `Surveyed ${days[0]} to ${days[days.length - 1]}`
    : scope.dateFrom || scope.dateTo
      ? `Date filter ${scope.dateFrom || "…"} to ${scope.dateTo || "…"}`
      : "No survey dates in this selection";

  return {
    scope,
    title: "Road condition briefing",
    scopeLine: bits.join(" · "),
    periodLabel,
    generatedAt: new Date(),
    total: tot.total,
    good: tot.good,
    fair: tot.fair,
    poor: tot.poor,
    mixed: tot.mixed,
    uc: tot.uc,
    goodPct: tot.goodPct,
    fairPct: tot.fairPct,
    poorPct: tot.poorPct,
    surveyors: surveyorSet.size,
    categoryRows,
    corridorRows,
    worstCorridor,
    worstTypes,
    poorAssets: poorAssets.slice(0, 50),
  };
}

function factParagraphs(b: Briefing): string[] {
  const paras: string[] = [];
  paras.push(
    `This briefing covers ${b.scopeLine}. ${b.periodLabel}. ${b.total.toLocaleString()} surveyed assets are in scope, recorded by ${b.surveyors} surveyor${b.surveyors === 1 ? "" : "s"}.`
  );
  paras.push(
    `Condition split: ${b.goodPct}% good (${b.good.toLocaleString()}), ${b.fairPct}% fair (${b.fair.toLocaleString()}), ${b.poorPct}% poor (${b.poor.toLocaleString()})` +
    (b.mixed ? `, ${b.mixed} mixed` : "") +
    (b.uc ? `, ${b.uc} under construction` : "") +
    "."
  );
  if (b.worstCorridor && b.worstCorridor.total > 0) {
    paras.push(
      `Among A-class corridors in this selection, ${b.worstCorridor.key} (${b.worstCorridor.label.replace(/^[A-Z0-9]+\s/, "")}) has the highest poor share: ${b.worstCorridor.poorPct}% (${b.worstCorridor.poor.toLocaleString()} of ${b.worstCorridor.total.toLocaleString()} assets).`
    );
  }
  if (b.worstTypes.length) {
    paras.push(
      `Asset types with the most poor-condition records: ${b.worstTypes.map((t) => `${t.label} (${t.poor})`).join(", ")}.`
    );
  }
  paras.push("No distress mechanism is inferred beyond the recorded condition ratings. Bulk extracts remain available on the Export page as a ZIP of per-table files.");
  return paras;
}

export function downloadBriefingPdf(briefing: Briefing, officer?: UserProfile | null) {
  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" });
  const dateStr = briefing.generatedAt.toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  const officerName = officer?.full_name?.trim() || "";
  const officerRole = roleLabel(officer?.role);

  doc.setFillColor(0, 102, 51);
  doc.rect(0, 0, 210, 24, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(12);
  doc.text("REPUBLIC OF ZIMBABWE", 14, 10);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(8);
  doc.text("Ministry of Transport and Infrastructural Development  ·  Department of Roads", 14, 16);
  doc.text(dateStr, 196, 10, { align: "right" });
  doc.text("Briefing pack", 196, 16, { align: "right" });

  doc.setTextColor(0, 102, 51);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(14);
  doc.text("ROAD CONDITION BRIEFING", 14, 34);
  doc.setDrawColor(217, 119, 6);
  doc.setLineWidth(0.8);
  doc.line(14, 37, 196, 37);

  doc.setTextColor(30, 41, 59);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.text(briefing.scopeLine, 14, 44);
  doc.setTextColor(100, 116, 139);
  doc.text(briefing.periodLabel, 14, 49);

  autoTable(doc, {
    startY: 54,
    head: [["Measure", "Count", "Share"]],
    body: [
      ["Assets in scope", briefing.total.toLocaleString(), "100%"],
      ["Good", briefing.good.toLocaleString(), `${briefing.goodPct}%`],
      ["Fair", briefing.fair.toLocaleString(), `${briefing.fairPct}%`],
      ["Poor", briefing.poor.toLocaleString(), `${briefing.poorPct}%`],
      ["Surveyors", String(briefing.surveyors), "—"],
    ],
    headStyles: { fillColor: [0, 102, 51], textColor: 255, fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8.5, cellPadding: 2.2 },
    theme: "striped",
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" } },
  });

  let y = ((doc as any).lastAutoTable?.finalY || 80) + 8;
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 102, 51);
  doc.text("What the data shows", 14, y);
  y += 6;
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  for (const para of factParagraphs(briefing)) {
    const lines = doc.splitTextToSize(para, 182);
    if (y + lines.length * 4.4 > 280) {
      doc.addPage();
      y = 18;
    }
    doc.text(lines, 14, y);
    y += lines.length * 4.4 + 3;
  }

  doc.addPage();
  doc.setFillColor(0, 102, 51);
  doc.rect(0, 0, 210, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("CONDITION BY ASSET TYPE AND A-CLASS CORRIDOR", 14, 8);

  autoTable(doc, {
    startY: 18,
    head: [["Asset type", "Total", "Good", "Fair", "Poor", "Poor %"]],
    body: briefing.categoryRows.map((r) => [
      r.label,
      String(r.total),
      String(r.good),
      String(r.fair),
      String(r.poor),
      `${r.poorPct}%`,
    ]),
    headStyles: { fillColor: [0, 102, 51], textColor: 255, fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.8 },
    theme: "grid",
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  autoTable(doc, {
    startY: ((doc as any).lastAutoTable?.finalY || 80) + 8,
    head: [["Corridor", "Total", "Good", "Fair", "Poor", "Poor %"]],
    body: briefing.corridorRows.filter((r) => r.total > 0).map((r) => [
      `${r.key}  ${HIGHWAY_CORRIDORS.find((h) => h.id === r.key)?.name || ""}`,
      String(r.total),
      String(r.good),
      String(r.fair),
      String(r.poor),
      `${r.poorPct}%`,
    ]),
    headStyles: { fillColor: [30, 41, 59], textColor: 255, fontStyle: "bold", fontSize: 8 },
    styles: { fontSize: 8, cellPadding: 1.8 },
    theme: "grid",
    columnStyles: { 1: { halign: "right" }, 2: { halign: "right" }, 3: { halign: "right" }, 4: { halign: "right" }, 5: { halign: "right" } },
  });

  doc.addPage();
  doc.setFillColor(0, 102, 51);
  doc.rect(0, 0, 210, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFont("helvetica", "bold");
  doc.setFontSize(9);
  doc.text("PRIORITY LIST — POOR-CONDITION ASSETS (UP TO 50)", 14, 8);

  autoTable(doc, {
    startY: 18,
    head: [["Asset", "Type", "Road", "Section", "Corridor", "Date", "GPS"]],
    body: briefing.poorAssets.length
      ? briefing.poorAssets.map((r) => [
          String(getAssetName(r)).slice(0, 32),
          String(getAssetType(r)).slice(0, 18),
          String(r.road_name || "—").split(" (")[0].slice(0, 24),
          String(r.section_name || "—").slice(0, 22),
          matchHighwayId(r) || "—",
          String(r.survey_date || "—").slice(0, 10),
          formatGpsLabel(r) || "—",
        ])
      : [["No poor-condition assets in this selection.", "", "", "", "", "", ""]],
    headStyles: { fillColor: [153, 27, 27], textColor: 255, fontStyle: "bold", fontSize: 7.5 },
    styles: { fontSize: 7, cellPadding: 1.5 },
    theme: "grid",
  });

  let sigY = ((doc as any).lastAutoTable?.finalY || 80) + 16;
  if (sigY > 240) {
    doc.addPage();
    sigY = 24;
  }
  doc.setFont("helvetica", "bold");
  doc.setFontSize(10);
  doc.setTextColor(0, 102, 51);
  doc.text("Prepared by", 14, sigY);
  doc.setFont("helvetica", "normal");
  doc.setFontSize(9);
  doc.setTextColor(30, 41, 59);
  doc.text(officerName || "Name of officer (print)", 14, sigY + 7);
  doc.text(officerRole, 14, sigY + 12);
  doc.setDrawColor(30, 41, 59);
  doc.line(14, sigY + 28, 88, sigY + 28);
  doc.setFontSize(7.5);
  doc.setTextColor(100, 116, 139);
  doc.text("Signature", 14, sigY + 32);

  doc.line(110, sigY + 28, 196, sigY + 28);
  doc.text("Reviewed / approved (name and signature)", 110, sigY + 32);

  const pages = doc.getNumberOfPages();
  for (let i = 1; i <= pages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(100, 116, 139);
    doc.text("Department of Roads  ·  Condition briefing from field survey records", 14, 288);
    doc.text(`Page ${i} of ${pages}`, 196, 288, { align: "right" });
  }

  const stub = [
    "briefing",
    briefing.scope.level,
    briefing.scope.highway !== "all" ? briefing.scope.highway : null,
    briefing.generatedAt.toISOString().slice(0, 10),
  ].filter(Boolean).join("_");
  doc.save(`${stub}.pdf`);
}
