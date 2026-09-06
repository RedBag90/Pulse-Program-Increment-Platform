import type { ReactNode } from "react";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SectionLabel } from "@/components/ui/section-label";
import { userLabel, initials } from "@/components/detail/initiative-labels";
import { formatCompactEUR } from "@/lib/formatting";
import type { EpicBudgetStandingView } from "@/modules/work/server/views/epic-detail";

function Fact({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="min-w-0">
      <SectionLabel>{label}</SectionLabel>
      <div className="mt-0.5 truncate text-sm font-medium">{children}</div>
    </div>
  );
}

const fmtDay = (d: Date) =>
  d.toLocaleDateString("de-DE", { day: "numeric", month: "short", year: "numeric" });

/**
 * Die Budget-Zelle: **habe ich Geld, und für wann?**
 *
 * Oben der Betrag im *geltenden* Rahmen samt Zeitraum — die Antwort auf „darf
 * ich jetzt ausgeben?". Darunter klein die Gesamtsumme über alle Zyklen. Bei den
 * übrigen Zuständen tritt der Zustandssatz an die Stelle des Betrags: eine
 * Zuteilung in einem künftigen oder abgelaufenen Rahmen ist etwas anderes als
 * verfügbares Geld, und ein blosses „Budget erhalten" verwischte das.
 */
function BudgetFact({ standing }: { standing: EpicBudgetStandingView | null }) {
  if (standing == null || standing.state === "none") {
    return (
      <Fact label="Budget">
        <span className="text-muted-foreground">Kein Budget</span>
      </Fact>
    );
  }

  const total =
    standing.cycleCount > 1
      ? `gesamt ${formatCompactEUR(standing.totalAmount)} über ${standing.cycleCount} Zyklen`
      : null;

  if (standing.state === "applies") {
    const p = standing.currentPeriod;
    return (
      <div className="min-w-0">
        <SectionLabel>Budget</SectionLabel>
        <div className="mt-0.5 truncate text-sm font-medium tabular-nums">
          {formatCompactEUR(standing.currentAmount)}
        </div>
        {p?.start && p.end && (
          <div className="truncate text-[11px] text-muted-foreground tabular-nums">
            {fmtDay(p.start)} – {fmtDay(p.end)}
          </div>
        )}
        {total && <div className="truncate text-[11px] text-muted-foreground">{total}</div>}
      </div>
    );
  }

  const hint =
    standing.state === "upcoming"
      ? standing.startsAt
        ? `zugeteilt, gilt ab ${fmtDay(standing.startsAt)}`
        : "zugeteilt, Rahmen noch in Ausarbeitung"
      : "Rahmen abgelaufen";
  return (
    <div className="min-w-0">
      <SectionLabel>Budget</SectionLabel>
      <div className="mt-0.5 truncate text-sm font-medium tabular-nums text-muted-foreground">
        {formatCompactEUR(standing.totalAmount)}
      </div>
      <div className="truncate text-[11px] text-muted-foreground">{hint}</div>
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
  budgetStanding,
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
  /** `null` = Budgeting-Modul aus. */
  budgetStanding: EpicBudgetStandingView | null;
}) {
  const ownerName = ownerId ? userLabel(ownerId, userLabels) : null;
  return (
    <div className="grid grid-cols-2 gap-x-5 gap-y-3 rounded-lg border bg-card p-3.5 shadow-xs sm:grid-cols-3 lg:grid-cols-7">
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
      <BudgetFact standing={budgetStanding} />
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
