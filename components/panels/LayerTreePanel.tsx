"use client";

import { Layers, Eye, EyeOff } from "lucide-react";
import { getCategoryKey } from "@/components/helpers";
import {
  OVERLAY_GROUPS,
  countByLayer,
} from "@/lib/mapLayers";

interface LayerTreePanelProps {
  records: any[];
  visibleLayers: Record<string, boolean>;
  onToggleLayer: (key: string) => void;
  onSetGroupVisible: (keys: string[], visible: boolean) => void;
  onSetAllVisible: (visible: boolean) => void;
}

export default function LayerTreePanel({
  records,
  visibleLayers,
  onToggleLayer,
  onSetGroupVisible,
  onSetAllVisible,
}: LayerTreePanelProps) {
  const counts = countByLayer(records, getCategoryKey);
  const overlayKeys = OVERLAY_GROUPS.flatMap((group) => group.items.map((item) => item.key));
  const visibleCount = overlayKeys.filter((key) => visibleLayers[key] !== false).length;

  return (
    <div className="layer-tree-shell">
      <div className="inner-panel-header">
        <div className="inner-panel-title">
          <Layers size={15} className="inner-panel-title-icon" />
          Map Layers
        </div>
        <span style={{ fontSize: 10, color: "var(--text-muted)" }}>
          {visibleCount}/{overlayKeys.length} on
        </span>
      </div>

      <div className="layer-tree-toolbar">
        <button type="button" className="layer-tree-tool" onClick={() => onSetAllVisible(true)}>
          <Eye size={12} /> Show all
        </button>
        <button type="button" className="layer-tree-tool" onClick={() => onSetAllVisible(false)}>
          <EyeOff size={12} /> Hide all
        </button>
      </div>

      <div className="layer-tree">
        {OVERLAY_GROUPS.map((group) => {
          const keys = group.items.map((item) => item.key);
          const onCount = keys.filter((key) => visibleLayers[key] !== false).length;
          const allOn = onCount === keys.length;
          return (
            <section key={group.id} className="layer-tree-group">
              <div className="layer-tree-group-head">
                <span>{group.label}</span>
                <button
                  type="button"
                  className="layer-tree-group-toggle"
                  onClick={() => onSetGroupVisible(keys, !allOn)}
                  title={allOn ? `Hide ${group.label}` : `Show ${group.label}`}
                >
                  {onCount}/{keys.length}
                </button>
              </div>
              <div className="layer-tree-items">
                {group.items.map((item) => {
                  const checked = visibleLayers[item.key] !== false;
                  const count = counts[item.key] || 0;
                  return (
                    <label key={item.key} className={`layer-tree-item${checked ? "" : " off"}`}>
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => onToggleLayer(item.key)}
                      />
                      <span className="layer-tree-emoji" aria-hidden="true">{item.emoji}</span>
                      <span className="layer-tree-label">{item.label}</span>
                      <span className="layer-tree-count">{count}</span>
                    </label>
                  );
                })}
              </div>
            </section>
          );
        })}
      </div>

      <div className="layer-tree-footer">
        Drawing with Leaflet until GeoServer workspace <code>road_condition</code> is connected.
      </div>
    </div>
  );
}
