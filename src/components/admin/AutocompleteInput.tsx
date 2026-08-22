"use client";

import { useRef, useState, type KeyboardEvent } from "react";
import { Search } from "lucide-react";

type Option = { value: string; label: string; searchText?: string };

// Один поле-автоподсказка: печатаешь — сразу показывается выпадающий
// список совпадений, кликаешь по варианту — он выбирается. Заменяет
// связку "строка поиска + обычный select".
export default function AutocompleteInput({
  value,
  onChange,
  options,
  placeholder = "— выбрать —",
  pinnedValues = [],
  disabled = false,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  /** Значения, которые остаются в списке независимо от текста поиска (например "Аукцион"). */
  pinnedValues?: string[];
  disabled?: boolean;
}) {
  const [query, setQuery] = useState(() => options.find((o) => o.value === value)?.label ?? "");
  const [open, setOpen] = useState(false);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const q = query.trim().toLowerCase();
  const filtered = options.filter(
    (o) => pinnedValues.includes(o.value) || !q || (o.searchText ?? o.label).toLowerCase().includes(q)
  );

  function selectOption(o: Option) {
    onChange(o.value);
    setQuery(o.label);
    setOpen(false);
  }

  function handleChange(v: string) {
    setQuery(v);
    setOpen(true);
    if (value) onChange("");
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Escape") {
      setOpen(false);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (filtered.length === 1) selectOption(filtered[0]);
    }
  }

  return (
    <div className="relative">
      <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
      <input
        value={query}
        onChange={(e) => handleChange(e.target.value)}
        onFocus={(e) => {
          if (closeTimer.current) clearTimeout(closeTimer.current);
          setOpen(true);
          e.target.select();
        }}
        onBlur={() => {
          closeTimer.current = setTimeout(() => setOpen(false), 150);
        }}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        disabled={disabled}
        className="w-full rounded-md border border-border bg-surface-2 py-2 pl-8 pr-3 text-sm outline-none focus:border-accent disabled:opacity-60"
      />
      {open && filtered.length > 0 && (
        <ul className="absolute z-20 mt-1 max-h-56 w-full overflow-auto rounded-md border border-border bg-surface shadow-lg">
          {filtered.map((o) => (
            <li key={o.value}>
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => selectOption(o)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-surface-2"
              >
                {o.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
