import { Link } from "@/i18n/navigation";
import type { PeriodPhase } from "@/modules/budgeting/domain/period-phases";

const SUBLABEL: Record<PeriodPhase["state"], string> = {
  done: "erledigt",
  current: "dran",
  open: "offen",
  blocked: "gesperrt",
};

/**
 * Die Phasen-Leiste einer Kachel — sitzt tab-unabhängig im Sub-Header und
 * beantwortet „wo stehe ich".
 *
 * Ihre Vorgängerin (`ProcessRail`) leitete ihren Zustand aus einem tenant-weiten
 * „aktiven Zyklus" ab und verlinkte auf Routen, die inzwischen Redirects sind.
 * Diese hier kennt nur **diese** Kachel und springt auf den Reiter, der den
 * Schritt trägt.
 */
export function PeriodPhaseRail({ phases, basePath }: { phases: PeriodPhase[]; basePath: string }) {
  return (
    <nav aria-label="Zeitraum — Phasen" className="flex overflow-x-auto rounded-lg border bg-card">
      {phases.map((p, i) => {
        const blocked = p.state === "blocked";
        return (
          <Link
            key={p.key}
            href={`${basePath}?tab=${p.tab}`}
            title={p.blockedBy}
            aria-current={p.state === "current" ? "step" : undefined}
            className={`flex min-w-[128px] flex-1 items-center gap-2.5 px-3 py-2.5 transition-colors hover:bg-muted/50 ${
              i > 0 ? "border-l" : ""
            } ${p.state === "current" ? "bg-primary/5" : ""} ${blocked ? "opacity-60" : ""}`}
          >
            <span
              className={`grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-bold ${
                p.state === "done"
                  ? "bg-emerald-500 text-white"
                  : p.state === "current"
                    ? "border-[1.5px] border-primary bg-primary/10 text-primary"
                    : "border-[1.5px] border-dashed border-border text-muted-foreground"
              }`}
            >
              {p.state === "done" ? "✓" : i + 1}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[12px] font-medium">{p.label}</span>
              <span className="text-[10px] text-muted-foreground">{SUBLABEL[p.state]}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
