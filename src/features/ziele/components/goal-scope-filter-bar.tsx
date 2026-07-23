"use client";

import { useEntityOptions } from "@/features/create/use-entity-options";
import { useUrlState } from "@/lib/hooks/use-url-state";

interface ScopeOption {
  id: string;
  name?: string;
}

/**
 * VS/ART-Filter für die Strategie/Ziele-Liste (Epic 6a). Zwei `<select>`
 * „Alle Wertströme"/„Alle ARTs" schreiben `?vs=`/`?art=` via `useUrlState`
 * (`router.replace`, kein Scroll-Sprung). Optionen kommen selbstladend aus
 * den v1-APIs (`/api/v1/value-streams`, `/api/v1/arts`) über denselben Hook
 * wie die Drawer-Picker — keine Model-Prop nötig.
 */
export function GoalScopeFilterBar() {
  const { params, push } = useUrlState();
  const vs = params.get("vs") ?? "";
  const art = params.get("art") ?? "";

  const valueStreams = useEntityOptions<ScopeOption>("/api/v1/value-streams", true);
  const arts = useEntityOptions<ScopeOption>("/api/v1/arts", true);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <select
        value={vs}
        onChange={(e) => push({ vs: e.target.value || null })}
        disabled={valueStreams.loading}
        aria-label="Nach Wertstrom filtern"
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Alle Wertströme</option>
        {valueStreams.data.map((v) => (
          <option key={v.id} value={v.id}>
            {v.name ?? v.id}
          </option>
        ))}
      </select>
      <select
        value={art}
        onChange={(e) => push({ art: e.target.value || null })}
        disabled={arts.loading}
        aria-label="Nach ART filtern"
        className="rounded-md border border-input bg-card px-2 py-1.5 text-sm"
      >
        <option value="">Alle ARTs</option>
        {arts.data.map((a) => (
          <option key={a.id} value={a.id}>
            {a.name ?? a.id}
          </option>
        ))}
      </select>
    </div>
  );
}
