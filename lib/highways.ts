export type HighwayCorridor = {
  id: "A1" | "A2" | "A3" | "A4" | "A5";
  name: string;
  color: string;
  km: number;
};

export const HIGHWAY_CORRIDORS: HighwayCorridor[] = [
  { id: "A1", name: "Harare – Chirundu", color: "#006633", km: 335 },
  { id: "A2", name: "Harare – Mutare", color: "#007a3d", km: 263 },
  { id: "A3", name: "Harare – Bulawayo", color: "#004d26", km: 439 },
  { id: "A4", name: "Bulawayo – Beitbridge", color: "#FFD100", km: 323 },
  { id: "A5", name: "Bulawayo – Plumtree", color: "#e0b800", km: 102 },
];

const CODE_RE: Record<string, RegExp> = {
  A1: /(?:^|[^a-z0-9])a\s*1(?:[^a-z0-9]|$)/,
  A2: /(?:^|[^a-z0-9])a\s*2(?:[^a-z0-9]|$)/,
  A3: /(?:^|[^a-z0-9])a\s*3(?:[^a-z0-9]|$)/,
  A4: /(?:^|[^a-z0-9])a\s*4(?:[^a-z0-9]|$)/,
  A5: /(?:^|[^a-z0-9])a\s*5(?:[^a-z0-9]|$)/,
};

const PAIRS: Record<string, [string, string][]> = {
  A1: [
    ["harare", "chirundu"],
    ["harare", "chinhoyi"],
    ["harare", "karoi"],
    ["chirundu", "chinhoyi"],
  ],
  A2: [
    ["harare", "mutare"],
    ["rusape", "mutare"],
    ["harare", "rusape"],
  ],
  A3: [
    ["harare", "bulawayo"],
    ["kwekwe", "gweru"],
    ["gweru", "bulawayo"],
    ["harare", "gweru"],
    ["kadoma", "kwekwe"],
  ],
  A4: [
    ["bulawayo", "beitbridge"],
    ["gwanda", "beitbridge"],
    ["bulawayo", "gwanda"],
  ],
  A5: [
    ["bulawayo", "plumtree"],
  ],
};

const UNIQUE: Record<string, string[]> = {
  A1: ["chirundu", "makuti"],
  A2: [],
  A3: [],
  A4: ["beitbridge"],
  A5: [],
};

export function normaliseRoadText(value: unknown): string {
  return String(value || "")
    .toLowerCase()
    .replace(/[–—−]/g, "-")
    .replace(/\bbyo\b/g, "bulawayo")
    .replace(/\bblwo\b/g, "bulawayo")
    .replace(/\bmtre\b/g, "mutare")
    .replace(/\bhre\b/g, "harare")
    .replace(/[^a-z0-9]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function recordRoadBlob(record: any): string {
  return normaliseRoadText(
    [
      record?.road_name,
      record?.section_name,
      record?.paved_road_name,
      record?.gravel_road_name,
      record?.earth_road_name,
    ]
      .filter(Boolean)
      .join(" ")
  );
}

function hasPair(text: string, a: string, b: string): boolean {
  return text.includes(a) && text.includes(b);
}

/** Best A-class corridor for a survey record, or null if it is not on the network. */
export function matchHighwayId(record: any): string | null {
  const text = recordRoadBlob(record);
  if (!text) return null;

  for (const h of HIGHWAY_CORRIDORS) {
    if (CODE_RE[h.id].test(text)) return h.id;
  }

  for (const h of HIGHWAY_CORRIDORS) {
    if ((PAIRS[h.id] || []).some(([a, b]) => hasPair(text, a, b))) return h.id;
  }

  for (const h of HIGHWAY_CORRIDORS) {
    if ((UNIQUE[h.id] || []).some((token) => text.includes(token))) return h.id;
  }

  return null;
}

export function recordsForHighway(records: any[], id: string): any[] {
  return records.filter((r) => matchHighwayId(r) === id);
}

export function groupRecordsByHighway(records: any[]): Record<string, any[]> {
  const grouped: Record<string, any[]> = {};
  for (const h of HIGHWAY_CORRIDORS) grouped[h.id] = [];
  for (const r of records) {
    const id = matchHighwayId(r);
    if (id) grouped[id].push(r);
  }
  return grouped;
}
