import {
  getCategoryKey,
  getRecordStatus,
  getSadcValue,
  recordHasPhotos,
  formatGpsLabel,
} from "@/components/helpers";
import { HIGHWAY_CORRIDORS, matchHighwayId } from "@/lib/highways";
import { OVERLAY_GROUPS } from "@/lib/mapLayers";
import { buildBriefing, surveyDay, type Briefing, type CondRow } from "@/lib/reportBriefing";

const NATIONAL_SCOPE = {
  level: "national" as const,
  province: "all",
  district: "all",
  highway: "all",
  category: "all",
  dateFrom: "",
  dateTo: "",
};

const GROUP_BY_KEY: Record<string, string> = Object.fromEntries(
  OVERLAY_GROUPS.flatMap((g) => g.items.map((item) => [item.key, g.label]))
);

export type PlaceRow = {
  name: string;
  total: number;
  good: number;
  fair: number;
  poor: number;
  poorPct: number;
};

export type MonthRow = {
  key: string;
  label: string;
  total: number;
  good: number;
  fair: number;
  poor: number;
};

export type SurveyorRow = {
  name: string;
  count: number;
  good: number;
  fair: number;
  poor: number;
  last: string | null;
};

export type Completeness = {
  gps: number;
  photos: number;
  dated: number;
  province: number;
  district: number;
  aClass: number;
  gpsPct: number;
  photoPct: number;
  datedPct: number;
  provincePct: number;
  districtPct: number;
  aClassPct: number;
};

export type SignSadc = {
  signs: number;
  tagged: number;
  yes: number;
  no: number;
  mixed: number;
};

export type SystemStats = {
  briefing: Briefing;
  completeness: Completeness;
  signSadc: SignSadc;
  provinceRows: PlaceRow[];
  districtRows: PlaceRow[];
  monthRows: MonthRow[];
  surveyorRows: SurveyorRow[];
  groupRows: CondRow[];
  offCorridor: number;
};

function pct(part: number, total: number) {
  return total ? Math.round((part / total) * 100) : 0;
}

function monthLabel(key: string) {
  const [y, m] = key.split("-").map(Number);
  return new Date(y, (m || 1) - 1, 1).toLocaleString("en-GB", { month: "short", year: "2-digit" });
}

function bumpPlace(map: Map<string, PlaceRow>, name: string, status: string) {
  const row = map.get(name) || { name, total: 0, good: 0, fair: 0, poor: 0, poorPct: 0 };
  row.total += 1;
  if (status === "good") row.good += 1;
  else if (status === "fair") row.fair += 1;
  else if (status === "poor") row.poor += 1;
  map.set(name, row);
}

function finishPlaces(map: Map<string, PlaceRow>): PlaceRow[] {
  return Array.from(map.values())
    .map((row) => ({ ...row, poorPct: pct(row.poor, row.total) }))
    .sort((a, b) => b.total - a.total);
}

export function buildSystemStats(records: any[]): SystemStats {
  const briefing = buildBriefing(records, NATIONAL_SCOPE);
  const total = records.length;

  let gps = 0;
  let photos = 0;
  let dated = 0;
  let province = 0;
  let district = 0;
  let aClass = 0;
  let signs = 0;
  let sadcYes = 0;
  let sadcNo = 0;
  let sadcMixed = 0;
  let sadcTagged = 0;

  const provinceMap = new Map<string, PlaceRow>();
  const districtMap = new Map<string, PlaceRow>();
  const monthMap = new Map<string, MonthRow>();
  const surveyorMap = new Map<string, SurveyorRow>();
  const groupMap = new Map<string, CondRow>();

  for (const r of records) {
    const status = getRecordStatus(r);
    if (formatGpsLabel(r)) gps += 1;
    if (recordHasPhotos(r)) photos += 1;

    const prov = String(r.province || "").trim();
    if (prov) {
      province += 1;
      bumpPlace(provinceMap, prov, status);
    } else {
      bumpPlace(provinceMap, "Unspecified", status);
    }

    const dist = String(r.district || "").trim();
    if (dist) {
      district += 1;
      bumpPlace(districtMap, prov ? `${dist} · ${prov}` : dist, status);
    }

    if (matchHighwayId(r)) aClass += 1;

    const day = surveyDay(r);
    if (day) {
      dated += 1;
      const key = day.slice(0, 7);
      const month = monthMap.get(key) || { key, label: monthLabel(key), total: 0, good: 0, fair: 0, poor: 0 };
      month.total += 1;
      if (status === "good") month.good += 1;
      else if (status === "fair") month.fair += 1;
      else if (status === "poor") month.poor += 1;
      monthMap.set(key, month);
    }

    const surveyor = String(r.surveyor_name || "").trim() || "Unnamed";
    const sRow = surveyorMap.get(surveyor) || { name: surveyor, count: 0, good: 0, fair: 0, poor: 0, last: null };
    sRow.count += 1;
    if (status === "good") sRow.good += 1;
    else if (status === "fair") sRow.fair += 1;
    else if (status === "poor") sRow.poor += 1;
    if (day && (!sRow.last || day > sRow.last)) sRow.last = day;
    surveyorMap.set(surveyor, sRow);

    const group = GROUP_BY_KEY[getCategoryKey(r) || "unknown"] || "Other";
    const gRow = groupMap.get(group) || {
      key: group, label: group, good: 0, fair: 0, poor: 0, mixed: 0, uc: 0, total: 0, poorPct: 0, goodPct: 0, fairPct: 0,
    };
    gRow.total += 1;
    if (status === "good") gRow.good += 1;
    else if (status === "fair") gRow.fair += 1;
    else if (status === "poor") gRow.poor += 1;
    else if (status === "mixed") gRow.mixed += 1;
    else if (status === "under_construction") gRow.uc += 1;
    groupMap.set(group, gRow);

    if ((getCategoryKey(r) || "") === "sign") {
      signs += 1;
      const sadc = getSadcValue(r);
      if (sadc === "yes" || sadc === "no" || sadc === "mixed") sadcTagged += 1;
      if (sadc === "yes") sadcYes += 1;
      else if (sadc === "no") sadcNo += 1;
      else if (sadc === "mixed") sadcMixed += 1;
    }
  }

  const monthKeys = [...monthMap.keys()].sort();
  const monthWindow = monthKeys.length > 18 ? monthKeys.slice(-18) : monthKeys;

  const groupRows = Array.from(groupMap.values()).map((row) => {
    row.poorPct = pct(row.poor, row.total);
    row.goodPct = pct(row.good, row.total);
    row.fairPct = pct(row.fair, row.total);
    return row;
  }).sort((a, b) => b.total - a.total);

  return {
    briefing,
    completeness: {
      gps,
      photos,
      dated,
      province,
      district,
      aClass,
      gpsPct: pct(gps, total),
      photoPct: pct(photos, total),
      datedPct: pct(dated, total),
      provincePct: pct(province, total),
      districtPct: pct(district, total),
      aClassPct: pct(aClass, total),
    },
    signSadc: { signs, tagged: sadcTagged, yes: sadcYes, no: sadcNo, mixed: sadcMixed },
    provinceRows: finishPlaces(provinceMap),
    districtRows: finishPlaces(districtMap),
    monthRows: monthWindow.map((key) => monthMap.get(key)!),
    surveyorRows: Array.from(surveyorMap.values()).sort((a, b) => b.count - a.count),
    groupRows,
    offCorridor: Math.max(0, total - aClass),
  };
}
