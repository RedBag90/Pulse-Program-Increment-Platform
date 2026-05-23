"use client";

import { useState } from "react";
import { Activity, FileText, Layers, Target, type LucideIcon } from "lucide-react";
import { actionLabel, userLabel, initials } from "@/components/detail/initiative-labels";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

/** A single audit entry, pre-serialised on the server for the client boundary. */
export interface ActivityItem {
  id: string;
  action: string;
  /** ISO timestamp. */
  occurredAt: string;
  /** The acting user's id (resolved to a label via `userLabels`). */
  actorId?: string;
}

/** Coarse category used by the "Show everything" filter — the action's first segment. */
function category(action: string): string {
  return action.split(".")[0] ?? action;
}

/** A small lucide glyph per action category — purely decorative context. */
const CATEGORY_ICON: Record<string, LucideIcon> = {
  epic: Layers,
  kpi: Target,
  initiative: FileText,
};
function categoryIcon(action: string): LucideIcon {
  return CATEGORY_ICON[category(action)] ?? Activity;
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
 * Right-hand activity feed — an initiative's audit trail (Epic or Feature),
 * newest first, with a category filter. Read-only: comments are intentionally
 * out of scope.
 */
export function InitiativeActivitySidebar({
  events,
  userLabels = {},
}: {
  events: ActivityItem[];
  /** Resolved user-id → display label (email) map for the actor line. */
  userLabels?: Record<string, string>;
}) {
  const [filter, setFilter] = useState("all");
  const now = Date.now();

  const categories = [...new Set(events.map((e) => category(e.action)))].sort();
  const shown = filter === "all" ? events : events.filter((e) => category(e.action) === filter);

  return (
    <aside className="w-72 shrink-0 border-l bg-muted/20">
      <div className="space-y-2 border-b p-3">
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Aktivität
        </p>
        <select
          aria-label="Aktivität filtern"
          value={filter}
          onChange={(e) => setFilter(e.target.value)}
          className="w-full rounded-md border border-input bg-background px-2 py-1.5 text-sm shadow-xs focus:outline-none focus:ring-2 focus:ring-ring"
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
        <div className="flex flex-col items-center gap-2 p-8 text-center text-sm text-muted-foreground">
          <Activity className="h-5 w-5" />
          Keine Aktivität
        </div>
      ) : (
        <ul className="divide-y">
          {shown.map((e) => {
            const actor = e.actorId ? userLabel(e.actorId, userLabels) : null;
            const Icon = categoryIcon(e.action);
            return (
              <li key={e.id} className="flex gap-3 px-3 py-2.5 transition-colors hover:bg-muted/50">
                <Avatar size="sm" className="mt-0.5">
                  <AvatarFallback>{actor ? initials(actor) : "—"}</AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="text-sm leading-snug">
                    {actor && <span className="font-medium text-foreground">{actor}</span>}{" "}
                    <span className="text-muted-foreground">{actionLabel(e.action)}</span>
                  </p>
                  <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                    <Icon className="h-3 w-3 shrink-0" />
                    {relativeTime(e.occurredAt, now)}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
