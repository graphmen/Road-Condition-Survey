"use client";

import React, { useState, useEffect } from "react";
import dynamic from "next/dynamic";
import { RefreshCw, CheckCircle, AlertTriangle, Info, X, ChevronLeft, ChevronRight } from "lucide-react";
import LeftNav, { type NavModule } from "@/components/panels/LeftNav";
import InnerPanel from "@/components/panels/InnerPanel";
import RightPanel from "@/components/panels/RightPanel";
import FullPageModule from "@/components/panels/FullPageModule";
import MapErrorBoundary from "@/components/MapErrorBoundary";
import {
  enrichRecordGeo,
  buildMapGoto,
  fireMapGoto,
  getAssetName,
  type MapGotoDetail,
} from "@/components/helpers";

const MapView = dynamic(() => import("@/components/MapView"), {
  ssr: false,
  loading: () => (
    <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "#f0f2f1" }}>
      <div style={{ textAlign: "center" }}>
        <div style={{ width: 36, height: 36, border: "3px solid rgba(0,102,51,0.15)", borderTop: "3px solid #006633", borderRadius: "50%", animation: "spin 0.8s linear infinite", margin: "0 auto 8px" }} />
        <div style={{ fontSize: 11, color: "#6b8072" }}>Loading mapâ€¦</div>
      </div>
    </div>
  ),
});

// These modules open as a full-page overlay over the map
const FULLPAGE_MODULES: NavModule[] = ["dashboard", "highways", "analytics", "survey", "database", "gallery", "export"];

export default function Dashboard() {
  const [records, setRecords]       = useState<any[]>([]);
  const [isLoading, setIsLoading]   = useState(true);
  const [isSyncing, setIsSyncing]   = useState(false);
  const [sourceInfo, setSourceInfo] = useState("Loadingâ€¦");

  const [activeModule, setActiveModule]       = useState<NavModule>("assets");
  const [fullPageModule, setFullPageModule]   = useState<NavModule | null>(null);
  const [selectedRecord, setSelectedRecord]   = useState<any | null>(null);
  const [mapFocus, setMapFocus]               = useState<MapGotoDetail | null>(null);
  const [selectedRoad, setSelectedRoad]       = useState("all");
  const [lastSynced, setLastSynced]           = useState<Date | null>(null);

  const [innerOpen, setInnerOpen] = useState(true);
  const [rightOpen, setRightOpen] = useState(true);
  // Once the map has mounted, never unmount it (Leaflet crashes on remount)
  const [mapUnlocked, setMapUnlocked] = useState(false);

  const [toast, setToast] = useState<{ message: string; type: "success" | "error" | "info" } | null>(null);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(t);
  }, [toast]);

  useEffect(() => {
    if (!isLoading || records.length > 0) setMapUnlocked(true);
  }, [isLoading, records.length]);

  const fetchRecords = async (silent = false, force = false) => {
    if (!silent) setIsLoading(true);
    try {
      const url = force ? "/api/roads?refresh=1" : "/api/roads";
      const res = await fetch(url);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setRecords(data.records || []);
      setLastSynced(new Date());
      let src = "Local Cache";
      if (data.source === "backend")  src = "Server Cache";
      if (data.source === "server")   src = data.cached ? "Server (Cached)" : "Server Live";
      if (data.source === "supabase") src = "Server Live";
      if (data.fallback)              src = "Offline Cache";
      setSourceInfo(src);
    } catch (e: any) {
      setToast({ message: e.message, type: "error" });
    } finally {
      if (!silent) setIsLoading(false);
    }
  };

  // Two-phase load:
  // 1. Show local cache instantly (no spinner)
  // 2. When server responds, MERGE with local data so all records appear
  useEffect(() => {
    let localRecords: any[] = [];

    const load = async () => {
      // Phase 1 â€” instant local render
      try {
        const localRes = await fetch("/api/roads?fallback=1");
        if (localRes.ok) {
          const localData = await localRes.json();
          localRecords = localData.records || [];
          if (localRecords.length > 0) {
            setRecords(localRecords);
            setSourceInfo("Local Cache");
            setIsLoading(false);
          }
        }
      } catch (_) {}

      // Phase 2 â€” server data arrives; merge with local so nothing is lost
      try {
        const res = await fetch("/api/roads");
        if (res.ok) {
          const data = await res.json();
          const serverRecords: any[] = data.records || [];

          if (serverRecords.length > 0) {
            // Deduplicate: server records win on conflict (newest data)
            const seenIds = new Set(serverRecords.map((r: any) => String(r.id || r._id || "")));
            const localOnly = localRecords.filter(
              (r: any) => { const id = String(r.id || r._id || ""); return !id || !seenIds.has(id); }
            );
            const merged = [...serverRecords, ...localOnly];
            setRecords(merged);
            setLastSynced(new Date());
            let src = "Server Live";
            if (data.cached) src = "Server (Cached)";
            if (data.fallback) src = "Offline Cache";
            setSourceInfo(`${src} Â· ${merged.length} records`);
          }
        }
      } catch (_) {}

      setIsLoading(false);
    };
    load();
  }, []);


  useEffect(() => {
    if (typeof window !== "undefined" && "serviceWorker" in navigator) {
      if (process.env.NODE_ENV === "development") {
        // Unregister stale SW without reloading â€” reload was resetting map state mid-click
        navigator.serviceWorker.getRegistrations().then((registrations) => {
          for (const registration of registrations) {
            registration.unregister();
          }
        });
      } else {
        navigator.serviceWorker.register("/sw.js").then(
          (reg) => console.log("SW registered:", reg.scope),
          (err) => console.error("SW failed:", err)
        );
      }
    }
  }, []);

  const handleSync = async () => {
    setIsSyncing(true);
    setToast({ message: "Refreshing data from server...", type: "info" });
    try {
      await fetchRecords(true, true); // silent=true, force=true â€” bypass server cache
      setToast({ message: "Data refreshed successfully!", type: "success" });
    } catch (e: any) {
      setToast({ message: e.message, type: "error" });
    } finally {
      setIsSyncing(false);
    }
  };

  /** Select an asset and jump to THAT record's coordinates only. */
  const handleSelectRecord = (r: any) => {
    const enriched = enrichRecordGeo(r);
    const label = getAssetName(enriched);
    const focusBase = buildMapGoto(enriched);

    // 1) Leave Database / Survey overlay so the map is visible
    if (fullPageModule) {
      setFullPageModule(null);
      setActiveModule("assets");
      setInnerOpen(true);
    } else if (activeModule !== "assets" && activeModule !== "settings") {
      setActiveModule("assets");
      setInnerOpen(true);
    }

    if (selectedRoad !== "all" && enriched?.road_name && enriched.road_name !== selectedRoad) {
      setSelectedRoad("all");
    }

    setSelectedRecord(enriched);
    if (!rightOpen) setRightOpen(true);

    if (!focusBase) {
      setMapFocus(null);
      setToast({ message: "This asset has no map location (missing GPS).", type: "info" });
      return;
    }

    const focus: MapGotoDetail = { ...focusBase, label };

    setMapFocus(focus);
    setToast({
      message: `Showing on map: ${label}  Â·  ${focus.lat.toFixed(5)}, ${focus.lng.toFixed(5)}`,
      type: "success",
    });

    // 2) Fire go-to immediately (direct Leaflet + event)
    fireMapGoto(focus);
  };

  // Clicking a nav module:
  // - "assets" â†’ show inner panel (map mode)
  // - everything else â†’ open full-page overlay, hide inner panel
  const handleNavSelect = (m: NavModule) => {
    setActiveModule(m);
    if (FULLPAGE_MODULES.includes(m)) {
      setFullPageModule(m);
      setInnerOpen(false);   // hide inner panel while full-page is open
    } else {
      setFullPageModule(null);
      setInnerOpen(true);    // re-show inner panel for assets/settings
    }
  };

  const handleCloseFull = () => {
    setFullPageModule(null);
    setActiveModule("assets");
    setInnerOpen(true);
  };

  const visibleRecords = selectedRoad === "all"
    ? records
    : records.filter(r => r.road_name === selectedRoad);

  return (
    <div className="app-shell">

      {/* â”€â”€ Toast â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      {toast && (
        <div className="toast-container">
          <div className="toast-item" style={{ borderColor: toast.type === "success" ? "#006633" : toast.type === "error" ? "#dc2626" : "#1d6fa4" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              {toast.type === "success" && <CheckCircle size={15} color="#006633" />}
              {toast.type === "error"   && <AlertTriangle size={15} color="#dc2626" />}
              {toast.type === "info"    && <Info size={15} color="#1d6fa4" />}
              <span>{toast.message}</span>
            </div>
            <button className="toast-close" onClick={() => setToast(null)}><X size={13} /></button>
          </div>
        </div>
      )}

      {/* â”€â”€ Header â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <header className="app-header">
        <div className="header-logo-zone">
          <img src="/coat_of_arms.png" alt="Zimbabwe Coat of Arms" className="header-coat" />
        </div>
        <div className="header-title-zone">
          <div className="header-title-main">ROADS DEPARTMENT â€” ROADS CONDITION DASHBOARD</div>
          <div className="header-title-sub">Ministry of Transport &amp; Infrastructural Development Â· Republic of Zimbabwe</div>
        </div>
        <div className="header-actions">
          <div style={{ fontSize: 10, color: "rgba(255,255,255,0.65)", display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 1 }}>
            <span style={{ color: "rgba(255,255,255,0.5)", textTransform: "uppercase", fontSize: 8.5, letterSpacing: "0.6px" }}>Data Source</span>
            <span style={{ fontWeight: 600, color: "#fff" }}>{isLoading ? "Loadingâ€¦" : sourceInfo}</span>
            {lastSynced && <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 8 }}>Last update: {lastSynced.toLocaleTimeString()}</span>}
          </div>
          <button className="btn-sync" onClick={handleSync} disabled={isSyncing}>
            <RefreshCw size={13} className={isSyncing ? "spin-icon" : ""} />
            {isSyncing ? "Refreshingâ€¦" : "Refresh Data"}
          </button>
          <div className="user-chip">
            <div style={{ textAlign: "right" }}>
              <div style={{ fontWeight: 600, fontSize: 11, color: "#fff" }}>Admin User</div>
              <div style={{ fontSize: 9, color: "rgba(255,255,255,0.5)", textTransform: "uppercase" }}>Field Operator</div>
            </div>
            <div className="user-avatar">A</div>
          </div>
        </div>
      </header>

      {/* â”€â”€ Body â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <div className={`app-body${fullPageModule ? " fullpage-active" : ""}`}>

        {/* Left icon nav rail */}
        <LeftNav
          active={activeModule}
          onSelect={handleNavSelect}
          innerOpen={innerOpen}
          onToggleInner={() => {
            // only toggle if we're NOT in full-page mode
            if (!fullPageModule) setInnerOpen(o => !o);
          }}
        />

        {/* Inner panel â€” only shown for assets/settings, not during full-page */}
        {!fullPageModule && (
          <div className={`inner-panel${innerOpen ? "" : " collapsed"}`}>
            {isLoading ? (
              <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: "var(--text-muted)", fontSize: 12, flexDirection: "column", gap: 10 }}>
                <div style={{ width: 28, height: 28, border: "3px solid rgba(0,102,51,0.15)", borderTop: "3px solid #006633", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
                Loading dataâ€¦
              </div>
            ) : (
              <InnerPanel
                module={activeModule}
                records={records}
                selectedRecord={selectedRecord}
                onSelectRecord={handleSelectRecord}
                selectedRoad={selectedRoad}
                onRoadFilter={setSelectedRoad}
              />
            )}
          </div>
        )}

        {/* Inner panel edge toggle â€” only when no full-page module */}
        {!fullPageModule && (
          <button
            className="panel-toggle-btn"
            style={{ left: innerOpen ? `calc(var(--nav-w) + var(--inner-w))` : `var(--nav-w)` }}
            onClick={() => setInnerOpen(o => !o)}
            title={innerOpen ? "Collapse left panel" : "Expand left panel"}
          >
            {innerOpen ? <ChevronLeft size={12} /> : <ChevronRight size={12} />}
          </button>
        )}

        {/* Map zone (keep MapView mounted â€” remounting Leaflet causes container reuse errors) */}
        <div className="map-zone" style={{ position: "relative" }}>
          {!mapUnlocked ? (
            <div style={{ display: "flex", alignItems: "center", justifyContent: "center", width: "100%", height: "100%", background: "#f0f2f1", flexDirection: "column", gap: 10 }}>
              <div style={{ width: 36, height: 36, border: "3px solid rgba(0,102,51,0.15)", borderTop: "3px solid #006633", borderRadius: "50%", animation: "spin 0.8s linear infinite" }} />
              <div style={{ fontSize: 11, color: "#6b8072" }}>Loading telemetry dataâ€¦</div>
            </div>
          ) : (
            <MapErrorBoundary>
              <MapView
                records={visibleRecords}
                selectedRecord={selectedRecord}
                mapFocus={mapFocus}
                onSelectRecord={handleSelectRecord}
              />
            </MapErrorBoundary>
          )}

          {/* Full-page overlay â€” covers the map when a module is selected */}
          {fullPageModule && (
            <FullPageModule
              module={fullPageModule}
              records={records}
              onSelectRecord={handleSelectRecord}
              onClose={handleCloseFull}
              onRefresh={() => fetchRecords(true)}
              onToast={(msg, type) => setToast({ message: msg, type })}
              lastSynced={lastSynced}
            />
          )}
        </div>

        {/* Right panel edge toggle */}
        <button
          className="panel-toggle-btn right-toggle"
          style={{ right: rightOpen ? `var(--right-w)` : 0 }}
          onClick={() => setRightOpen(o => !o)}
          title={rightOpen ? "Collapse right panel" : "Expand right panel"}
        >
          {rightOpen ? <ChevronRight size={12} /> : <ChevronLeft size={12} />}
        </button>

        {/* Right analytics panel */}
        <div className={`right-panel${rightOpen ? "" : " collapsed"}`}>
          <RightPanel
            records={visibleRecords}
            selectedRecord={selectedRecord}
            onClose={() => setSelectedRecord(null)}
          />
        </div>

      </div>

      {/* â”€â”€ Footer â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€ */}
      <footer className="app-footer">
        <div className="footer-left">
          <img src="/coat_of_arms.png" alt="Zimbabwe Coat of Arms" className="footer-logo" />
          <div>
            <div className="footer-brand-name">Roads Department â€” Roads Condition Dashboard</div>
            <div className="footer-brand-sub">Ministry of Transport &amp; Infrastructural Development Â· Republic of Zimbabwe</div>
          </div>
        </div>
        <div className="footer-center">
          <span>Field Telemetry System v2.0</span>
          <div className="footer-divider" />
          <span>Survey Year: 2026</span>
          <div className="footer-divider" />
          <span>Highways: A1 Â· A2 Â· A3 Â· A4 Â· A5</span>
          <div className="footer-divider" />
          <span>{records.length} Records</span>
        </div>
        <div className="footer-right">
          <span style={{ display: "flex", alignItems: "center", gap: 5 }}>
            <span className="footer-status-dot" />
            System Operational
          </span>
          <div className="footer-divider" />
          <span>&copy; {new Date().getFullYear()} Roads Department, Zimbabwe. All rights reserved.</span>
        </div>
      </footer>

    </div>
  );
}
