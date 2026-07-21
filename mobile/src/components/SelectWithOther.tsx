import type { CSSProperties } from "react";

type Option = { value: string; label: string };

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  className?: string;
  style?: CSSProperties;
  includeOther?: boolean;
};

/** Select that supports an "Other" choice with a free-text box (stored as other:…). */
export function SelectWithOther({
  value,
  onChange,
  options,
  className = "mobile-select",
  style,
  includeOther = true,
}: Props) {
  const isOther = value === "other" || value.startsWith("other:");
  const selectValue = isOther ? "other" : value;
  const otherText = value.startsWith("other:") ? value.slice(6) : value === "other" ? "" : "";
  const hasOtherOption = options.some((o) => o.value === "other");

  return (
    <div>
      <select
        value={selectValue}
        onChange={(e) => {
          const v = e.target.value;
          if (v === "other") onChange(otherText ? `other:${otherText}` : "other");
          else onChange(v);
        }}
        className={className}
        style={style}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
        {includeOther && !hasOtherOption && <option value="other">Other</option>}
      </select>
      {isOther && (
        <input
          type="text"
          className="mobile-input"
          style={{ marginTop: 6 }}
          placeholder="Please specify…"
          value={otherText}
          onChange={(e) => onChange(e.target.value ? `other:${e.target.value}` : "other")}
        />
      )}
    </div>
  );
}

export const AUTHORITY_OPTIONS: Option[] = [
  { value: "rdc", label: "RDC" },
  { value: "mot", label: "MOT" },
  { value: "uc", label: "UC (Urban Councils)" },
  { value: "rida", label: "RIDA" },
];

export const CONDITION_GFPM: Option[] = [
  { value: "good", label: "Good" },
  { value: "fair", label: "Fair" },
  { value: "poor", label: "Poor" },
  { value: "mixed", label: "Mixed" },
];

export const CONDITION_GFPM_CONSTRUCTION: Option[] = [
  ...CONDITION_GFPM,
  { value: "under_construction", label: "Under construction / rehabilitation" },
];
