"use client";

import { useEntityOptions } from "@/features/create/use-entity-options";
import { useUrlState } from "@/lib/hooks/use-url-state";
import { PeriodPicker } from "./period-picker";

interface ScopeOption {
  id: string;
  name?: string;
}

const SELECT =
  "h-9 rounded-md border border-input bg-card px-2 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring";

/**
 * Prominente Filterleiste für die Strategie/Ziele-Liste: **Zeitraum · Wertstrom ·
 * ART**. Alle drei schreiben URL-State via `useUrlState` (`router.replace`, kein
 * Scroll-Sprung): `?period=` / `?vs=` / `?art=` — der Loader (`loadStrategyTree`)
 * konsumiert sie server­seitig. VS/ART-Optionen laden selbst über die v1-APIs;
 * der Zeitraum nutzt den `PeriodPicker` im controlled/Filter-Modus.
 */
export function GoalScopeFilterBar({
  showValueStreams = true,
  showArts = true,
}: {
  /** VS = Portfolio-Inhalt — im Free-Tenant ausgeblendet (leeres Dropdown wäre tot). */
  showValueStreams?: boolean;
  /** ARTs = Programm-Inhalt — dito. */
  showArts?: boolean;
} = {}) {
  const { params, push } = useUrlState();
  const period = params.get("period");
  const vs = params.get("vs") ?? "";
  const art = params.get("art") ?? "";

  const valueStreams = useEntityOptions<ScopeOption>("/api/v1/value-streams", true);
  const arts = useEntityOptions<ScopeOption>("/api/v1/arts", true);

  return (
    <div className="flex flex-wrap items-end gap-3 rounded-lg border bg-card p-2.5">
      <Field label="Zeitraum">
        <div className="w-52">
          <PeriodPicker
            value={period}
            onChange={(key) => push({ period: key })}
            placeholder="Alle Zeiträume"
          />
        </div>
      </Field>
      {showValueStreams && (
        <Field label="Wertstrom">
          <select
            value={vs}
            onChange={(e) => push({ vs: e.target.value || null })}
            disabled={valueStreams.loading}
            aria-label="Nach Wertstrom filtern"
            className={SELECT}
          >
            <option value="">Alle Wertströme</option>
            {valueStreams.data.map((v) => (
              <option key={v.id} value={v.id}>
                {v.name ?? v.id}
              </option>
            ))}
          </select>
        </Field>
      )}
      {showArts && (
        <Field label="ART">
          <select
            value={art}
            onChange={(e) => push({ art: e.target.value || null })}
            disabled={arts.loading}
            aria-label="Nach ART filtern"
            className={SELECT}
          >
            <option value="">Alle ARTs</option>
            {arts.data.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name ?? a.id}
              </option>
            ))}
          </select>
        </Field>
      )}
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      {children}
    </label>
  );
}
