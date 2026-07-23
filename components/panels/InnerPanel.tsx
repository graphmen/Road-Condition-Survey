"use client";
import { useState } from "react";
import { Search, Download, Map, TrendingUp, BarChart2, ClipboardCheck, Database, Camera, FileText, BookOpen, LayoutDashboard, Smartphone, ExternalLink } from "lucide-react";
import {
  getAssetType, getAssetName, getRecordStatus, getCategoryKey, formatStatusLabel, getSadcValue, getStatusColor,
  formatGpsLabel,
} from "@/components/helpers";
import type { NavModule } from "./LeftNav";
import {
  ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip as ChartTooltip, Cell,
  PieChart, Pie, Legend,
} from "recharts";

const PAGE_SIZE = 20;

interface InnerPanelProps {
  module: NavModule;
  records: any[];
  selectedRecord: any | null;
  onSelectRecord: (r: any) => void;
  selectedRoad: string;
  onRoadFilter: (road: string) => void;
}

const HIGHWAYS = [
  { id: "A1", name: "A1 Highway", route: "Harare â€“ Chirundu", color: "#006633" },
  { id: "A2", name: "A2 Highway", route: "Harare â€“ Mutare",   color: "#007a3d" },
  { id: "A3", name: "A3 Highway", route: "Harare â€“ Bulawayo", color: "#004d26" },
  { id: "A4", name: "A4 Highway", route: "Bulawayo â€“ Beitbridge", color: "#FFD100" },
  { id: "A5", name: "A5 Highway", route: "Bulawayo â€“ Plumtree", color: "#e0b800" },
];

function highwayCount(records: any[], id: string) {
  return records.filter(r => (r.road_name ?? "").includes(id)).length;
}

function highwayGood(records: any[], id: string) {
  const hw = records.filter(r => (r.road_name ?? "").includes(id));
  if (!hw.length) return 0;
  return Math.round((hw.filter(r => getRecordStatus(r) === "good").length / hw.length) * 100);
}

// â”€â”€â”€ Analytics sub-tabs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
type AnalyticsTab = "condition" | "types" | "highways" | "compliance";

function AnalyticsInner({ records }: { records: any[] }) {
  const [tab, setTab] = useState<AnalyticsTab>("condition");

  const total = records.length;
  const good  = records.filter(r => getRecordStatus(r) === "good").length;
  const fair  = records.filter(r => getRecordStatus(r) === "fair").length;
  const poor  = records.filter(r => getRecordStatus(r) === "poor").length;

  const condData = [
    { name: "Good",  value: good,  color: "#006633" },
    { name: "Fair",  value: fair,  color: "#f59e0b" },
    { name: "Poor",  value: poor,  color: "#dc2626" },
  ].filter(d => d.value > 0);

  const typeCounts: Record<string, number> = {};
  records.forEach(r => {
    const t = getAssetType(r);
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  });
  const typeData = Object.entries(typeCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  const hwData = HIGHWAYS.map(h => ({
    name: h.id,
    assets: highwayCount(records, h.id),
    good: highwayGood(records, h.id),
  }));

  const compliant    = records.filter(r => getSadcValue(r) === "yes").length;
  const nonCompliant = records.filter(r => getSadcValue(r) === "no").length;
  const sadcMixed    = records.filter(r => getSadcValue(r) === "mixed").length;
  const sadcData = [
    { name: "Compliant",     count: compliant,    fill: "#006633" },
    { name: "Non-Compliant", count: nonCompliant, fill: "#dc2626" },
    { name: "Mixed",         count: sadcMixed,    fill: "#7c3aed" },
  ].filter(d => d.count > 0);

  return (
    <>
      <div className="tab-bar">
        {(["condition","types","highways","compliance"] as AnalyticsTab[]).map(t => (
          <button key={t} className={`tab-btn${tab === t ? " active" : ""}`} onClick={() => setTab(t)}>
            {t.charAt(0).toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="tab-content">
        {tab === "condition" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 4 }}>Condition Distribution</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={condData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={70} paddingAngle={3} label={({ name, percent }) => `${name} ${(percent*100).toFixed(0)}%`} labelLine={false} fontSize={10}>
                    {condData.map((e, i) => <Cell key={i} fill={e.color} />)}
                  </Pie>
                  <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            {[{ label: "Good Condition", val: good, color: "#006633" }, { label: "Fair Condition", val: fair, color: "#f59e0b" }, { label: "Poor Condition", val: poor, color: "#dc2626" }].map(row => (
              <div className="progress-row" key={row.label}>
                <div className="progress-label-row"><span>{row.label}</span><span style={{ fontWeight: 700, color: row.color }}>{total ? Math.round(row.val/total*100) : 0}% ({row.val})</span></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: total ? `${row.val/total*100}%` : "0%", background: row.color }} /></div>
              </div>
            ))}
          </>
        )}

        {tab === "types" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 4 }}>Asset Type Breakdown</div>
            <div style={{ height: 220 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={typeData} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
                  <XAxis type="number" fontSize={9} tick={{ fill: "#6b8072" }} tickLine={false} />
                  <YAxis type="category" dataKey="name" fontSize={9} tick={{ fill: "#3d5a48" }} width={62} tickLine={false} />
                  <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--border)" }} />
                  <Bar dataKey="count" radius={[0,4,4,0]} barSize={14} fill="#006633" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </>
        )}

        {tab === "highways" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 4 }}>Highway Performance</div>
            <div style={{ height: 200 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hwData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" fontSize={10} tick={{ fill: "#3d5a48" }} tickLine={false} />
                  <YAxis fontSize={9} tick={{ fill: "#6b8072" }} tickLine={false} />
                  <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--border)" }} />
                  <Bar dataKey="assets" name="Assets" fill="#006633" radius={[4,4,0,0]} barSize={28} />
                </BarChart>
              </ResponsiveContainer>
            </div>
            {hwData.map(h => (
              <div className="progress-row" key={h.name}>
                <div className="progress-label-row"><span style={{ fontWeight: 700 }}>{h.name}</span><span style={{ fontWeight: 700, color: "#006633" }}>{h.good}% Good ({h.assets} assets)</span></div>
                <div className="progress-track"><div className="progress-fill" style={{ width: `${h.good}%`, background: h.good > 70 ? "#006633" : h.good > 40 ? "#f59e0b" : "#dc2626" }} /></div>
              </div>
            ))}
          </>
        )}

        {tab === "compliance" && (
          <>
            <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 4 }}>SADC Sign Compliance</div>
            <div style={{ height: 180 }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={sadcData} margin={{ left: -10, right: 10, top: 5, bottom: 5 }}>
                  <XAxis dataKey="name" fontSize={10} tick={{ fill: "#3d5a48" }} tickLine={false} />
                  <YAxis fontSize={9} tick={{ fill: "#6b8072" }} tickLine={false} />
                  <ChartTooltip contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid var(--border)" }} />
                  <Bar dataKey="count" radius={[4,4,0,0]} barSize={40}>
                    {sadcData.map((e, i) => <Cell key={i} fill={e.fill} />)}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div style={{ display: "flex", gap: 8 }}>
              {[{ label: "Compliant", val: compliant, color: "#006633" }, { label: "Non-Compliant", val: nonCompliant, color: "#dc2626" }, { label: "Mixed", val: sadcMixed, color: "#7c3aed" }].map(s => (
                <div key={s.label} style={{ flex: 1, background: "var(--bg-app)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px", textAlign: "center" }}>
                  <div style={{ fontFamily: "var(--font-title)", fontSize: 22, fontWeight: 800, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 9, color: "var(--text-muted)", textTransform: "uppercase", letterSpacing: "0.5px", marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
}

// â”€â”€â”€ Dashboard overview â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DashboardInner({ records }: { records: any[] }) {
  const total  = records.length;
  const good   = records.filter(r => getRecordStatus(r) === "good").length;
  const fair   = records.filter(r => getRecordStatus(r) === "fair").length;
  const poor   = records.filter(r => getRecordStatus(r) === "poor").length;
  const goodPct = total ? Math.round(good/total*100) : 0;

  const kpis = [
    { label: "Total Assets", val: total,   color: "#006633" },
    { label: "Good",         val: `${goodPct}%`, color: "#006633" },
    { label: "Fair",         val: fair,     color: "#d97706" },
    { label: "Poor",         val: poor,     color: "#dc2626" },
  ];

  const worstAssets = records
    .filter(r => getRecordStatus(r) === "poor")
    .slice(0, 6);

  return (
    <div className="tab-content" style={{ paddingTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 6 }}>Network KPIs</div>
      <div className="stat-grid">
        {kpis.map(k => (
          <div className="stat-tile" key={k.label}>
            <div className="stat-tile-num" style={{ color: k.color }}>{k.val}</div>
            <div className="stat-tile-lbl">{k.label}</div>
          </div>
        ))}
      </div>

      <div style={{ height: 160, marginTop: 8 }}>
        <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 4 }}>Condition Overview</div>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie data={[{name:"Good",value:good,color:"#006633"},{name:"Fair",value:fair,color:"#f59e0b"},{name:"Poor",value:poor,color:"#dc2626"}].filter(d=>d.value>0)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={60} paddingAngle={3}>
              {[{name:"Good",value:good,color:"#006633"},{name:"Fair",value:fair,color:"#f59e0b"},{name:"Poor",value:poor,color:"#dc2626"}].filter(d=>d.value>0).map((e,i)=><Cell key={i} fill={e.color}/>)}
            </Pie>
            <Legend iconSize={8} wrapperStyle={{ fontSize: 10 }} />
          </PieChart>
        </ResponsiveContainer>
      </div>

      {worstAssets.length > 0 && (
        <>
          <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 4 }}>âš  Poor Condition Assets</div>
          {worstAssets.map((r, i) => (
            <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 11, padding: "6px 0", borderBottom: "1px solid var(--border)", color: "var(--text-secondary)" }}>
              <span style={{ fontWeight: 600 }}>{getAssetName(r)}</span>
              <span className="badge poor">Poor</span>
            </div>
          ))}
        </>
      )}
    </div>
  );
}

// â”€â”€â”€ Database table â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function DatabaseInner({ records, onSelectRecord, selectedRecord }: { records: any[]; onSelectRecord:(r:any)=>void; selectedRecord:any|null; }) {
  const [page, setPage] = useState(0);
  const pages = Math.ceil(records.length / PAGE_SIZE);
  const slice = records.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  return (
    <>
      <div className="db-table-wrapper" style={{ flex: 1 }}>
        <table className="db-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Asset Name</th>
              <th>Type</th>
              <th>Road</th>
              <th>GPS</th>
              <th>Condition</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {slice.map((r, i) => {
              const cond = getRecordStatus(r);
              const gpsLabel = formatGpsLabel(r);
              return (
                <tr key={r._id ?? i} className={selectedRecord?._id === r._id ? "active-row" : ""} onClick={() => onSelectRecord(r)}>
                  <td style={{ color: "var(--text-muted)" }}>{page * PAGE_SIZE + i + 1}</td>
                  <td style={{ fontWeight: 600 }}>{getAssetName(r)}</td>
                  <td>{getAssetType(r)}</td>
                  <td>{(r.road_name ?? "â€”").split(" (")[0]}</td>
                  <td style={{ fontFamily: "ui-monospace, monospace", fontSize: 10 }}>
                    {gpsLabel ?? "â€”"}
                  </td>
                  <td><span className={`badge ${cond}`}>{formatStatusLabel(cond)}</span></td>
                  <td>{r.survey_date ?? "â€”"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="pagination-row">
        <button className="page-btn" onClick={() => setPage(p => Math.max(0, p-1))} disabled={page === 0}>â† Prev</button>
        <span>Page {page+1} of {Math.max(1, pages)}</span>
        <button className="page-btn" onClick={() => setPage(p => Math.min(pages-1, p+1))} disabled={page >= pages-1}>Next â†’</button>
      </div>
    </>
  );
}

// â”€â”€â”€ Export panel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ExportInner({ records }: { records: any[] }) {
  const [fmt, setFmt] = useState("csv");
  const [road, setRoad] = useState("all");

  const roads = Array.from(new Set(records.map(r => r.road_name).filter(Boolean)));

  const handleExport = () => {
    const filtered = road === "all" ? records : records.filter(r => r.road_name === road);
    const headers = ["id","asset_name","asset_type","road_name","condition","survey_date","surveyor_name","latitude","longitude"];
    const rows = filtered.map(r => {
      const cond = getRecordStatus(r);
      const lat = r._geolocation?.[0] ?? "";
      const lng = r._geolocation?.[1] ?? "";
      return [r._id ?? "", getAssetName(r), getAssetType(r), r.road_name ?? "", cond, r.survey_date ?? "", r.surveyor_name ?? "", lat, lng].join(",");
    });
    const csv = [headers.join(","), ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
    a.download = `roads_data_${new Date().toISOString().slice(0,10)}.csv`; a.click();
  };

  return (
    <div className="tab-content" style={{ paddingTop: 14 }}>
      <div style={{ fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.7px", color: "var(--text-muted)", marginBottom: 8 }}>Export Dataset</div>
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Format</div>
          <select className="select-sm" style={{ width: "100%" }} value={fmt} onChange={e => setFmt(e.target.value)}>
            <option value="csv">CSV (Comma-Separated)</option>
            <option value="json">JSON</option>
          </select>
        </div>
        <div>
          <div style={{ fontSize: 10, fontWeight: 700, color: "var(--text-muted)", textTransform: "uppercase", marginBottom: 5 }}>Filter by Highway</div>
          <select className="select-sm" style={{ width: "100%" }} value={road} onChange={e => setRoad(e.target.value)}>
            <option value="all">All Highways</option>
            {roads.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
        </div>
        <div style={{ background: "var(--bg-app)", border: "1px solid var(--border)", borderRadius: "var(--radius-md)", padding: "10px 12px" }}>
          <div style={{ fontSize: 11, color: "var(--text-muted)" }}>Records to export:</div>
          <div style={{ fontFamily: "var(--font-title)", fontSize: 24, fontWeight: 800, color: "var(--green)" }}>
            {road === "all" ? records.length : records.filter(r => r.road_name === road).length}
          </div>
        </div>
        <button className="btn-download" style={{ width: "100%", justifyContent: "center", padding: "12px" }} onClick={handleExport}>
          <Download size={14} /> Download {fmt.toUpperCase()}
        </button>
      </div>
    </div>
  );
}

// â”€â”€â”€ Main InnerPanel â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function InnerPanel({ module, records, selectedRecord, onSelectRecord, selectedRoad, onRoadFilter }: InnerPanelProps) {
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState("all");
  const [condFilter, setCondFilter] = useState("all");
  const [page, setPage] = useState(0);

  const uniqueRoads = Array.from(new Set(records.map(r => r.road_name).filter(Boolean)));

  // Filter for asset list
  const filtered = records.filter(r => {
    const q = search.toLowerCase();
    const matchQ = !q || getAssetName(r).toLowerCase().includes(q) || (r.road_name ?? "").toLowerCase().includes(q) || (r.surveyor_name ?? "").toLowerCase().includes(q);
    const catKey = getCategoryKey(r);
    const matchType = typeFilter === "all" || catKey === typeFilter;
    const matchCond = condFilter === "all" || getRecordStatus(r) === condFilter;
    const matchRoad = selectedRoad === "all" || r.road_name === selectedRoad;
    return matchQ && matchType && matchCond && matchRoad;
  });

  const pages = Math.ceil(filtered.length / PAGE_SIZE);
  const pageSlice = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);

  const getTitle = () => {
    const map: Partial<Record<NavModule, {icon: React.ReactNode, label: string}>> = {
      dashboard: { icon: <LayoutDashboard size={15} className="inner-panel-title-icon" />, label: "Dashboard" },
      assets:    { icon: <Map size={15} className="inner-panel-title-icon" />, label: "Road Assets" },
      highways:  { icon: <TrendingUp size={15} className="inner-panel-title-icon" />, label: "Highway Network" },
      analytics: { icon: <BarChart2 size={15} className="inner-panel-title-icon" />, label: "Analytics" },
      survey:    { icon: <ClipboardCheck size={15} className="inner-panel-title-icon" />, label: "Survey Records" },
      database:  { icon: <Database size={15} className="inner-panel-title-icon" />, label: "Database Explorer" },
      gallery:   { icon: <Camera size={15} className="inner-panel-title-icon" />, label: "Photo Gallery" },
      reports:   { icon: <FileText size={15} className="inner-panel-title-icon" />, label: "Reports Generator" },
      documents: { icon: <BookOpen size={15} className="inner-panel-title-icon" />, label: "Manuals & Documents" },
      export:    { icon: <Download size={15} className="inner-panel-title-icon" />, label: "Export Data" },
      settings:  { icon: null, label: "Settings" },
    };
    return map[module] ?? { icon: null, label: module };
  };

  const { icon, label } = getTitle();

  // â”€â”€â”€ Highways module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (module === "highways") {
    return (
      <>
        <div className="inner-panel-header">
          <div className="inner-panel-title">{icon}{label}</div>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{records.length} total</span>
        </div>
        <div className="inner-panel-body">
          <div className="asset-list">
            {HIGHWAYS.map(h => {
              const cnt = highwayCount(records, h.id);
              const gPct = highwayGood(records, h.id);
              return (
                <div key={h.id} className={`highway-item${selectedRoad.includes(h.id) ? " active" : ""}`} onClick={() => onRoadFilter(selectedRoad.includes(h.id) ? "all" : records.find(r => (r.road_name ?? "").includes(h.id))?.road_name ?? "all")}>
                  <div className="highway-badge">{h.id}</div>
                  <div className="highway-info">
                    <div className="highway-name">{h.name}</div>
                    <div className="highway-sub">{h.route}</div>
                    <div style={{ marginTop: 5 }}>
                      <div className="progress-track"><div className="progress-fill" style={{ width: `${gPct}%`, background: gPct > 70 ? "#006633" : gPct > 40 ? "#f59e0b" : "#dc2626" }} /></div>
                    </div>
                  </div>
                  <div className="highway-count">{cnt}</div>
                </div>
              );
            })}
          </div>
        </div>
      </>
    );
  }

  // â”€â”€â”€ Analytics module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (module === "analytics") {
    return (
      <>
        <div className="inner-panel-header">
          <div className="inner-panel-title">{icon}{label}</div>
        </div>
        <div className="inner-panel-body">
          <AnalyticsInner records={records} />
        </div>
      </>
    );
  }

  // â”€â”€â”€ Dashboard module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (module === "dashboard") {
    return (
      <>
        <div className="inner-panel-header">
          <div className="inner-panel-title">{icon}{label}</div>
        </div>
        <div className="inner-panel-body">
          <DashboardInner records={records} />
        </div>
      </>
    );
  }

  // â”€â”€â”€ Database Explorer module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (module === "database") {
    return (
      <>
        <div className="inner-panel-header">
          <div className="inner-panel-title">{icon}{label}</div>
          <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{records.length} rows</span>
        </div>
        <div className="inner-panel-body" style={{ overflow: "hidden" }}>
          <DatabaseInner records={records} onSelectRecord={onSelectRecord} selectedRecord={selectedRecord} />
        </div>
      </>
    );
  }

  // â”€â”€â”€ Export module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (module === "export") {
    return (
      <>
        <div className="inner-panel-header">
          <div className="inner-panel-title">{icon}{label}</div>
        </div>
        <div className="inner-panel-body">
          <ExportInner records={records} />
        </div>
      </>
    );
  }

  // â”€â”€â”€ Settings module â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  if (module === "settings") {
    return (
      <>
        <div className="inner-panel-header">
          <div className="inner-panel-title">{icon}{label}</div>
        </div>
        <div className="inner-panel-body" style={{ padding: 14 }}>
          <div style={{
            background: "var(--bg-hover)",
            border: "1px solid var(--border)",
            borderRadius: 12,
            padding: 14,
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
              <Smartphone size={16} color="var(--green)" />
              <div style={{ fontFamily: "var(--font-title)", fontWeight: 700, fontSize: 14, color: "var(--green-dark)" }}>
                Mobile collector app
              </div>
            </div>
            <p style={{ fontSize: 12, color: "var(--text-secondary)", lineHeight: 1.5, marginBottom: 12 }}>
              Share this link with field collectors so they can download and install the Android APK on their phones.
            </p>
            <a
              href="/download"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                display: "inline-flex",
                alignItems: "center",
                gap: 6,
                background: "var(--green)",
                color: "#fff",
                textDecoration: "none",
                borderRadius: 8,
                padding: "10px 12px",
                fontSize: 12,
                fontWeight: 700,
              }}
            >
              <ExternalLink size={13} /> Open download page
            </a>
          </div>
        </div>
      </>
    );
  }

  // â”€â”€â”€ Default: Assets / Survey list â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  return (
    <>
      <div className="inner-panel-header">
        <div className="inner-panel-title">{icon}{label}</div>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{filtered.length} assets</span>
      </div>
      <div className="panel-search-zone">
        <div className="search-box">
          <Search size={13} className="search-icon" />
          <input placeholder="Search asset, road, surveyorâ€¦" value={search} onChange={e => { setSearch(e.target.value); setPage(0); }} />
        </div>
        <div className="filter-row">
          <select className="filter-pill" value={typeFilter} onChange={e => { setTypeFilter(e.target.value); setPage(0); }} style={{ fontWeight: "bold" }}>
            <option value="all">ðŸ” All</option>
            <option value="sealed">ðŸ›£ï¸ Sealed Roads</option>
            <option value="gravel">ðŸª¨ Gravel Roads</option>
            <option value="earth">ðŸšœ Earth Roads</option>
            <option value="bridge">ðŸŒ‰ Bridges</option>
            <option value="footbridge">ðŸš¶ Foot Bridges</option>
            <option value="rail_crossing">ðŸ›¤ï¸ Rail Crossings</option>
            <option value="tollgate">ðŸª™ Tollgates</option>
            <option value="drift">ðŸŒŠ Drifts</option>
            <option value="culvert">ðŸ•³ï¸ Culverts</option>
            <option value="piped_causeway">ðŸŒ Piped Causeways</option>
            <option value="shelvet">ðŸ§± Shelverts</option>
            <option value="grid">ðŸ„ Cattle Grids</option>
            <option value="layby">ðŸ…¿ï¸ Laybys</option>
            <option value="busstop">ðŸšŒ Bus Stops</option>
            <option value="junction">ðŸ”€ Junctions</option>
            <option value="sign">âš ï¸ Road Signs</option>
            <option value="traffic_lights">ðŸš¦ Traffic Lights</option>
            <option value="streetlight">ðŸ’¡ Streetlights</option>
          </select>
          <select className="filter-pill" value={condFilter} onChange={e => { setCondFilter(e.target.value); setPage(0); }}>
            <option value="all">All Conditions</option>
            <option value="good">Good</option>
            <option value="fair">Fair</option>
            <option value="poor">Poor</option>
            <option value="mixed">Mixed</option>
            <option value="under_construction">Under construction</option>
          </select>
        </div>
        <div className="filter-row">
          <select className="filter-pill" style={{ flex: 2 }} value={selectedRoad} onChange={e => { onRoadFilter(e.target.value); setPage(0); }}>
            <option value="all">All Highways</option>
            {uniqueRoads.map(r => <option key={r} value={r}>{(r ?? "").split(" (")[0]}</option>)}
          </select>
        </div>
      </div>

      <div className="asset-list">
        {pageSlice.length === 0 ? (
          <div style={{ textAlign: "center", color: "var(--text-muted)", padding: 20, fontSize: 12 }}>No assets match your filters.</div>
        ) : pageSlice.map((r, i) => {
          const cond = getRecordStatus(r);
          const name = getAssetName(r);
          const type = getAssetType(r);
          const gpsLabel = formatGpsLabel(r);
          return (
            <div key={r._id ?? i} className={`asset-card${selectedRecord?._id === r._id ? " active" : ""}`} onClick={() => onSelectRecord(r)} title="Show on map">
              <div className="asset-card-top">
                <div className="asset-card-name">{name}</div>
                <span className={`badge ${cond}`}>{formatStatusLabel(cond)}</span>
              </div>
              <div className="asset-card-sub">{(r.road_name ?? "â€”").split(" (")[0]}{r.section_name ? ` Â· ${r.section_name}` : ""}</div>
              <div className="asset-card-meta">
                <span className="asset-card-type">{type}</span>
                <span style={{ fontSize: 10, color: "var(--text-muted)" }}>{r.survey_date ?? "â€”"}</span>
              </div>
              <div style={{ marginTop: 4, fontSize: 10, fontFamily: "ui-monospace, monospace", color: "var(--text-secondary)" }}>
                {gpsLabel ?? "No GPS"}
              </div>
            </div>
          );
        })}
      </div>

      <div className="pagination-row">
        <button className="page-btn" onClick={() => setPage(p => Math.max(0,p-1))} disabled={page === 0}>â† Prev</button>
        <span>Page {page+1} / {Math.max(1,pages)} ({filtered.length})</span>
        <button className="page-btn" onClick={() => setPage(p => Math.min(pages-1,p+1))} disabled={page >= pages-1}>Next â†’</button>
      </div>

      <div className="panel-footer-strip">
        <div className="panel-footer-label">Export Dataset</div>
        <div className="export-row">
          <select className="select-sm">
            <option>CSV</option>
            <option>JSON</option>
          </select>
          <button className="btn-download" onClick={() => {
            const headers = ["asset_name","asset_type","road_name","condition","survey_date","surveyor_name"];
            const rows = filtered.map(r => [getAssetName(r), getAssetType(r), r.road_name ?? "", getRecordStatus(r), r.survey_date ?? "", r.surveyor_name ?? ""].join(","));
            const csv = [headers.join(","), ...rows].join("\n");
            const blob = new Blob([csv], {type:"text/csv"});
            const a = document.createElement("a"); a.href = URL.createObjectURL(blob);
            a.download = "roads_export.csv"; a.click();
          }}>
            <Download size={12} /> Download ({filtered.length})
          </button>
        </div>
      </div>
    </>
  );
}
