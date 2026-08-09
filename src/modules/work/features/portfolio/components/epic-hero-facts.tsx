import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionLabel } from "@/components/ui/section-label";
import { userLabel, initials } from "@/components/detail/initiative-labels";
import { formatCompactEUR } from "@/lib/formatting";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-0.5 truncate text-sm font-medium">{children}</div>
    </div>
  );
}

function fmtWindow(start: Date | null, end: Date | null): string {
  const f = (d: Date) => d.toLocaleDateString("de-DE", { month: "short", year: "numeric" });
  if (start && end) return `${f(start)} – ${f(end)}`;
  if (start || end) return f((start ?? end) as Date);
  return "—";
}

/**
 * Kernfakten-Band im Epic-Sub-Header (Owner, Value Stream, PI-Fenster, Kosten,
 * Nutzen, KPI-Fortschritt) — gibt der Detail-Seite eine Spine, ohne den mit dem
 * Feature-Detail geteilten Shell zu verändern. Reine Server-Komponente.
 */
export function EpicHeroFacts({
  ownerId,
  userLabels,
  valueStreamName,
  planStart,
  planEnd,
  istStart,
  istEnd,
  recurringBenefit,
  implementationCost,
  kpiCount,
  kpiAvgPct,
}: {
  ownerId: string | null;
  userLabels: Record<string, string>;
  valueStreamName: string | null;
  planStart: Date | null;
  planEnd: Date | null;
  istStart: Date | null;
  istEnd: Date | null;
  recurringBenefit: number;
  implementationCost: number;
  kpiCount: number;
  kpiAvgPct: number | null;
}) {
  const ownerName = ownerId ? userLabel(ownerId, userLabels) : null;
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:grid-cols-3 lg:grid-cols-6">
      <Fact label="Owner">
        {ownerName ? (
          <span className="flex items-center gap-1.5">
            <Avatar size="sm">
              <AvatarFallback>{initials(ownerName)}</AvatarFallback>
            </Avatar>
            <span className="truncate">{ownerName}</span>
          </span>
        ) : (
          <span className="text-muted-foreground">Nicht zugewiesen</span>
        )}
      </Fact>
      <Fact label="Value Stream">{valueStreamName ?? "—"}</Fact>
      <div className="min-w-0">
        <SectionLabel>PI-Fenster</SectionLabel>
        <div className="mt-0.5 space-y-0.5 text-xs">
          <div className="flex items-baseline gap-1.5">
            <span className="w-6 shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
              Plan
            </span>
            <span className="truncate font-medium tabular-nums">
              {fmtWindow(planStart, planEnd)}
            </span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="w-6 shrink-0 text-[10px] tracking-wide text-muted-foreground uppercase">
              Ist
            </span>
            <span className="truncate font-medium tabular-nums">{fmtWindow(istStart, istEnd)}</span>
          </div>
        </div>
      </div>
      <Fact label="Kosten">
        <span className="tabular-nums">
          {implementationCost > 0 ? formatCompactEUR(implementationCost) : "—"}
        </span>
      </Fact>
      <Fact label="Nutzen p.a.">
        <span className="tabular-nums text-emerald-600 dark:text-emerald-400">
          {recurringBenefit > 0 ? formatCompactEUR(recurringBenefit) : "—"}
        </span>
      </Fact>
      <Fact label="KPIs">
        {kpiCount === 0 ? (
          "—"
        ) : (
          <span className="tabular-nums">
            {kpiCount}
            {kpiAvgPct != null ? ` · ${kpiAvgPct} %` : ""}
          </span>
        )}
      </Fact>
    </div>
  );
}
