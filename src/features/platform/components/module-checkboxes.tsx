"use client";

import { MODULE_KEYS, MODULES } from "@/domain/modules";

/**
 * Modul-Entitlement-Auswahl (Checkbox-Gitter) — geteilt von Tenant-Anlage und
 * Modul-Editor. Rendert je Modul-Key eine Checkbox mit `name="modules"`, sodass
 * `formData.getAll("modules")` das Set liefert.
 */
export function ModuleCheckboxes({ selected }: { selected: readonly string[] }) {
  return (
    <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
      {MODULE_KEYS.map((key) => (
        <label
          key={key}
          className="flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs hover:bg-muted"
        >
          <input
            type="checkbox"
            name="modules"
            value={key}
            defaultChecked={selected.includes(key)}
            className="size-3.5"
          />
          <span className="truncate">{MODULES[key].label}</span>
        </label>
      ))}
    </div>
  );
}
