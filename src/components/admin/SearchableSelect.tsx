"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

type Option = { value: string; label: string; searchText?: string };

export default function SearchableSelect({
  value,
  onChange,
  options,
  placeholder = "— выбрать —",
  searchPlaceholder = "Поиск…",
  pinnedValues = [],
  disabled = false,
  required = false,
  className,
}: {
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  placeholder?: string;
  searchPlaceholder?: string;
  /** Значения, которые остаются в списке независимо от поиска (например "Аукцион"). */
  pinnedValues?: string[];
  disabled?: boolean;
  required?: boolean;
  className?: string;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => (o.searchText ?? o.label).toLowerCase().includes(q) || pinnedValues.includes(o.value) || o.value === value
    );
  }, [options, search, pinnedValues, value]);

  return (
    <div className={className}>
      <div className="relative mb-1.5">
        <Search size={13} className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={searchPlaceholder}
          disabled={disabled}
          className="w-full rounded-md border border-border bg-surface-2 py-1.5 pl-8 pr-3 text-xs outline-none focus:border-accent disabled:opacity-60"
        />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="w-full rounded-md border border-border bg-surface-2 px-3 py-2 text-sm outline-none focus:border-accent disabled:opacity-60"
      >
        <option value="">{placeholder}</option>
        {filtered.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
    </div>
  );
}
