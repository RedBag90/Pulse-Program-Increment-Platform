"use client";

import { Label } from "@/components/ui/label";
import { useEntityOptions, optionsEndpoint, type ParentKind } from "./use-entity-options";

const SELECT_CLASS =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50";

interface EntityOption {
  id: string;
  name?: string;
  title?: string;
}

interface EntitySelectProps {
  /** Parent kind — drives the endpoint and the cascading params. */
  kind: ParentKind;
  /** Form field name submitted with the dialog form. */
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  /** Cascading parent ids; the select stays idle until the needed one is set. */
  params?: { artId?: string; featureId?: string };
  /** Whether options carry their display text on `name` or on `title`. */
  labelField: "name" | "title";
  required?: boolean;
  disabled?: boolean;
}

/**
 * A `<select>` that loads its own options from the v1 API. Cascading parent
 * pickers are built by composition: the upstream select's value flows into a
 * downstream select's `params`, which stays idle until that id is present.
 */
export function EntitySelect({
  kind,
  name,
  label,
  value,
  onChange,
  params,
  labelField,
  required,
  disabled,
}: EntitySelectProps) {
  const endpoint = optionsEndpoint(kind, params);
  const { data, loading, error } = useEntityOptions<EntityOption>(
    endpoint,
    !disabled && endpoint !== null,
  );

  return (
    <div className="space-y-1.5">
      <Label htmlFor={`entity-${name}`}>
        {label} {required && <span className="text-destructive">*</span>}
      </Label>
      <select
        id={`entity-${name}`}
        name={name}
        required={required}
        value={value}
        disabled={disabled || loading}
        onChange={(e) => onChange(e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">{loading ? "Loading…" : `Select ${label.toLowerCase()}…`}</option>
        {data.map((option) => (
          <option key={option.id} value={option.id}>
            {option[labelField] ?? option.id}
          </option>
        ))}
      </select>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
