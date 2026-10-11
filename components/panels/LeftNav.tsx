"use client";
import { LayoutDashboard, Map, Route, BarChart2, ClipboardCheck, Camera, FileText, BookOpen, Download, Settings } from "lucide-react";

export type NavModule = "dashboard" | "assets" | "highways" | "analytics" | "survey" | "database" | "gallery" | "reports" | "documents" | "export" | "users" | "approvals" | "settings";

interface LeftNavProps {
  active: NavModule;
  onSelect: (m: NavModule) => void;
}

type NavItem = { id: NavModule; icon: React.ReactNode; label: string };

const NAV_GROUPS: NavItem[][] = [
  [{ id: "dashboard", icon: <LayoutDashboard size={18} />, label: "Dashboard" }],
  [{ id: "assets", icon: <Map size={18} />, label: "Assets" }],
  [
    { id: "highways", icon: <Route size={18} />, label: "Highways" },
    { id: "analytics", icon: <BarChart2 size={18} />, label: "Analytics" },
  ],
  [
    { id: "survey", icon: <ClipboardCheck size={18} />, label: "Survey" },
    { id: "gallery", icon: <Camera size={18} />, label: "Gallery" },
  ],
  [
    { id: "reports", icon: <FileText size={18} />, label: "Reports" },
    { id: "documents", icon: <BookOpen size={18} />, label: "Documents" },
    { id: "export", icon: <Download size={18} />, label: "Export" },
  ],
];

function itemIsActive(active: NavModule, id: NavModule) {
  if (id === "settings") return active === "settings" || active === "users" || active === "approvals";
  if (id === "survey") return active === "survey" || active === "database";
  return active === id;
}

export default function LeftNav({ active, onSelect }: LeftNavProps) {
  return (
    <nav className="nav-rail" aria-label="Main">
      {NAV_GROUPS.map((group, gi) => (
        <div key={gi} className="nav-group">
          {gi > 0 && <div className="nav-divider" role="separator" />}
          {group.map((item) => {
            const selected = itemIsActive(active, item.id);
            return (
              <button
                key={item.id}
                type="button"
                className={`nav-item${selected ? " active" : ""}`}
                onClick={() => onSelect(item.id)}
                title={item.label}
                aria-current={selected ? "page" : undefined}
              >
                {item.icon}
                <span className="nav-item-label">{item.label}</span>
              </button>
            );
          })}
        </div>
      ))}
      <div className="nav-spacer" />
      <div className="nav-divider" role="separator" />
      <button
        type="button"
        className={`nav-item${itemIsActive(active, "settings") ? " active" : ""}`}
        title="Settings"
        onClick={() => onSelect("settings")}
        aria-current={itemIsActive(active, "settings") ? "page" : undefined}
      >
        <Settings size={18} />
        <span className="nav-item-label">Settings</span>
      </button>
    </nav>
  );
}
