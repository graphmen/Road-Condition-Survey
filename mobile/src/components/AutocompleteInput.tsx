import { useMemo, useRef, useState } from "react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  suggestions: string[];
  placeholder?: string;
  className?: string;
  required?: boolean;
  id?: string;
};

/** Text input with type-ahead suggestions from previously saved values. */
export function AutocompleteInput({
  value,
  onChange,
  suggestions,
  placeholder,
  className = "mobile-input",
  required,
  id,
}: Props) {
  const [open, setOpen] = useState(false);
  const blurTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const filtered = useMemo(() => {
    const q = value.trim().toLowerCase();
    const uniq = Array.from(new Set(suggestions.map((s) => s.trim()).filter(Boolean)));
    if (!q) return uniq.slice(0, 8);
    return uniq.filter((s) => s.toLowerCase().includes(q) && s.toLowerCase() !== q).slice(0, 8);
  }, [suggestions, value]);

  return (
    <div style={{ position: "relative" }}>
      <input
        id={id}
        type="text"
        className={className}
        value={value}
        placeholder={placeholder}
        required={required}
        autoComplete="off"
        onChange={(e) => {
          onChange(e.target.value);
          setOpen(true);
        }}
        onFocus={() => {
          if (blurTimer.current) clearTimeout(blurTimer.current);
          setOpen(true);
        }}
        onBlur={() => {
          blurTimer.current = setTimeout(() => setOpen(false), 150);
        }}
      />
      {open && filtered.length > 0 && (
        <div
          style={{
            position: "absolute",
            zIndex: 40,
            left: 0,
            right: 0,
            top: "100%",
            marginTop: 2,
            background: "var(--bg-card)",
            border: "1px solid var(--border-color)",
            borderRadius: "var(--radius-sm)",
            boxShadow: "0 6px 16px rgba(0,0,0,0.12)",
            maxHeight: 160,
            overflowY: "auto",
          }}
        >
          {filtered.map((s) => (
            <button
              key={s}
              type="button"
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                onChange(s);
                setOpen(false);
              }}
              style={{
                display: "block",
                width: "100%",
                textAlign: "left",
                padding: "8px 10px",
                border: "none",
                background: "transparent",
                fontSize: 12,
                color: "var(--text-primary)",
                cursor: "pointer",
              }}
            >
              {s}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
