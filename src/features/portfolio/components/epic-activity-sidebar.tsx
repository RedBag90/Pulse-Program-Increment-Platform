"use client";

import { useState } from "react";

/** A single audit entry, pre-serialised on the server for the client boundary. */
export interface ActivityItem {
  id: string;
  action: string;
  /** ISO timestamp. */
  occurredAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "initiative.created": "Initiative erstellt",
  "initiative.updated": "Initiative aktualisiert",
  "initiative.deleted": "Initiative gelöscht",
  "initiative.stage_gate.advanced": "Stage Gate geändert",
  "wsjf.scored": "WSJF bewertet",
  "kpi.created": "KPI erstellt",
  "kpi.updated": "KPI aktualisiert",
  "kpi.deleted": "KPI gelöscht",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

/** Coarse category used by the "Show everything" filter — the action's first segment. */
function category(action: string): string {
  return action.split(".")[0] ?? action;
}

function relativeTime(iso: string, now: number): string {
  const diffMs = now - new Date(iso).getTime();
  const min = Math.round(diffMs / 60_000);
  if (min < 1) return "gerade eben";
  if (min < 60) return `vor ${min} Minute${min === 1 ? "" : "n"}`;
  const hrs = Math.round(min / 60);
  if (hrs < 24) return `vor ${hrs} Stunde${hrs === 1 ? "" : "n"}`;
  const days = Math.round(hrs / 24);
  return `vor ${days} Tag${days === 1 ? "" : "en"}`;
}

/**
 * Right-hand activity feed — the Epic's audit trail, newest first, with a
 * category filter. Read-only: comments are intentionally out of scope.
 */
export function EpicActivitySidebar({ events }: { events: ActivityItem[] }) {
  const [filter, setFilter] = useState("all");
  const now = Date.now();

  const categories = [...new Set(events.map((e) => category(e.action)))].sort();
  const shown = filter === "all" ? events : events.filter((e) => category(e.action) === filter);

  return (
    <aside className="w-72 shrink-0 border-l bg-muted/30">
      <div className="border-b p-3">
        <select
          aria-label="Aktivität filtern"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded border border-input bg-background px-2 py-1.5 text-sm"
        >
          <option value="all">Alles anzeigen</option>
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>

      {shown.length === 0 ? (
        <p className="p-4 text-sm text-muted-foreground">Keine Aktivität</p>
      ) : (
        <ul className="divide-y">
          {shown.map((e) => (
            <li key={e.id} className="px-3 py-2.5">
              <p className="text-sm font-medium text-foreground">{actionLabel(e.action)}</p>
              <p className="text-xs text-muted-foreground">{relativeTime(e.occurredAt, now)}</p>
            </li>
          ))}
        </ul>
      )}
    </aside>
  );
}
