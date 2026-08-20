import { Link } from "@/i18n/navigation";
import type { ProcessStep } from "@/modules/budgeting/server/views/process-rail";

const STATE_SUBLABEL = {
  done: "erledigt",
  active: "offen",
  todo: "offen",
  blocked: "blockiert",
} as const;

/**
 * Prozess-Leiste der Budget-Runde: fünf Schritte mit Zustand (erledigt / offen /
 * blockiert) und Deep-Link. Rein präsentational; die Zustände kommen aus
 * `buildProcessRail`.
 */
export function ProcessRail({ steps }: { steps: ProcessStep[] }) {
  const activeIdx = steps.findIndex((s) => !s.done && !s.blocked);

  return (
    <nav
      aria-label="Budget-Runde — Fortschritt"
      className="flex overflow-x-auto rounded-lg border bg-card"
    >
      {steps.map((s, i) => {
        const state = s.done ? "done" : s.blocked ? "blocked" : i === activeIdx ? "active" : "todo";
        return (
          <Link
            key={s.key}
            href={s.href}
            className={`relative flex min-w-[132px] flex-1 items-center gap-3 px-4 py-3 transition-colors hover:bg-muted/50 ${
              i > 0 ? "border-l" : ""
            } ${state === "active" ? "shadow-[inset_0_0_0_1.5px_var(--color-primary,theme(colors.primary.DEFAULT))]" : ""}`}
          >
            <span
              className={`grid size-6 shrink-0 place-items-center rounded-full text-xs font-bold ${
                state === "done"
                  ? "bg-emerald-500 text-white"
                  : state === "blocked"
                    ? "border-[1.5px] border-amber-500 bg-amber-50 text-amber-700 dark:bg-amber-950/50"
                    : state === "active"
                      ? "border-[1.5px] border-primary bg-primary/10 text-primary"
                      : "border-[1.5px] border-dashed border-border text-muted-foreground"
              }`}
            >
              {s.done ? "✓" : s.blocked ? "!" : i + 1}
            </span>
            <span className="flex flex-col leading-tight">
              <span className="text-[13px] font-medium">{s.label}</span>
              <span className="text-[11px] text-muted-foreground">{STATE_SUBLABEL[state]}</span>
            </span>
          </Link>
        );
      })}
    </nav>
  );
}
