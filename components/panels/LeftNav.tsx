"use client";
import { LayoutDashboard, Map, TrendingUp, BarChart2, ClipboardCheck, Database, Camera, Download, Settings, ChevronLeft, ChevronRight } from "lucide-react";

export type NavModule = "dashboard" | "assets" | "highways" | "analytics" | "survey" | "database" | "gallery" | "export" | "settings";

interface LeftNavProps {
  active: NavModule;
  onSelect: (m: NavModule) => void;
  innerOpen: boolean;
  onToggleInner: () => void;
}

const NAV_ITEMS: { id: NavModule; icon: React.ReactNode; label: string }[] = [
  { id: "dashboard",  icon: <LayoutDashboard size={18} />, label: "Dashboard" },
  { id: "assets",     icon: <Map size={18} />,             label: "Assets" },
  { id: "highways",   icon: <TrendingUp size={18} />,      label: "Highways" },
  { id: "analytics",  icon: <BarChart2 size={18} />,       label: "Analytics" },
  { id: "survey",     icon: <ClipboardCheck size={18} />,  label: "Survey" },
  { id: "database",   icon: <Database size={18} />,        label: "Database" },
  { id: "gallery",    icon: <Camera size={18} />,          label: "Gallery" },
  { id: "export",     icon: <Download size={18} />,        label: "Export" },
];

export default function LeftNav({ active, onSelect, innerOpen, onToggleInner }: LeftNavProps) {
  return (
    <nav className="nav-rail">
      {NAV_ITEMS.map((item, i) => (
        <div key={item.id}>
          {i === 5 && <div className="nav-divider" />}
          <button
            className={`nav-item${active === item.id ? " active" : ""}`}
            onClick={() => onSelect(item.id)}
            title={item.label}
          >
            {item.icon}
            <span className="nav-item-label">{item.label}</span>
          </button>
        </div>
      ))}
      <div className="nav-spacer" />
      <div className="nav-divider" />
      <button className="nav-item" title="Settings" onClick={() => onSelect("settings")}>
        <Settings size={18} />
        <span className="nav-item-label">Settings</span>
      </button>
      {/* Inner panel toggle */}
      <button
        className="nav-item"
        onClick={onToggleInner}
        title={innerOpen ? "Collapse panel" : "Expand panel"}
        style={{ marginTop: 4 }}
      >
        {innerOpen ? <ChevronLeft size={16} /> : <ChevronRight size={16} />}
        <span className="nav-item-label">{innerOpen ? "Hide" : "Show"}</span>
      </button>
    </nav>
  );
}
