"use client";

import React from "react";

type Props = {
  children: React.ReactNode;
};

type State = {
  hasError: boolean;
  resetKey: number;
};

/**
 * Catches rare Leaflet remount races (HMR / Fast Refresh) and remounts the map once.
 */
export default class MapErrorBoundary extends React.Component<Props, State> {
  state: State = { hasError: false, resetKey: 0 };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error) {
    const msg = error?.message || "";
    if (
      msg.includes("Map container is being reused") ||
      msg.includes("Map container is already initialized")
    ) {
      try {
        (window as any).__motidMap?.remove();
      } catch {
        /* already gone */
      }
      (window as any).__motidMap = null;
      document.querySelectorAll(".leaflet-container").forEach((el) => {
        delete (el as any)._leaflet_id;
      });
      window.setTimeout(() => {
        this.setState((s) => ({ hasError: false, resetKey: s.resetKey + 1 }));
      }, 50);
    }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{ width: "100%", height: "100%", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f2f1" }}>
          <div style={{ fontSize: 11, color: "#6b8072" }}>Reloading map…</div>
        </div>
      );
    }
    return <div key={this.state.resetKey} style={{ width: "100%", height: "100%" }}>{this.props.children}</div>;
  }
}
