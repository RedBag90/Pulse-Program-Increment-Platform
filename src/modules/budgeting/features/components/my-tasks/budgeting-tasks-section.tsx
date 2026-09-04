import { Link } from "@/i18n/navigation";
import type {
  MyBudgetingTask,
  MyArtFundingTask,
} from "@/modules/budgeting/server/services/my-budgeting-tasks";

const EUR = (n: number) => `${Math.round(n).toLocaleString("de-DE")} €`;

/**
 * My-Tasks-Sektion für Gruppenmitglieder mit offener Budget-Verteilung.
 * Verschwindet automatisch, sobald die Gruppe eingereicht hat (der Loader liefert
 * dann nichts mehr). Rein präsentational.
 */
export function BudgetingTasksSection({
  tasks,
  funding = [],
}: {
  tasks: MyBudgetingTask[];
  /** ARTs, deren Budget steht und noch nicht verteilt ist. */
  funding?: MyArtFundingTask[];
}) {
  if (tasks.length === 0 && funding.length === 0) return null;

  return (
    <section className="border-b bg-surface-frame px-6 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Budgeting
      </h2>
      <ul className="mt-2 space-y-2">
        {funding.map((f) => (
          <li
            key={f.artId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3"
          >
            <div className="text-sm">
              <span className="font-medium">💶 {f.artName}</span> — das ART-Epic-Budget für{" "}
              <span className="font-medium">{f.cycleLabel}</span> steht:{" "}
              <span className="font-medium tabular-nums">{EUR(f.remaining)}</span> sind noch nicht
              verteilt.
            </div>
            <Link
              href={f.href}
              className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              Budget verteilen →
            </Link>
          </li>
        ))}
        {tasks.map((t) => (
          <li
            key={t.groupId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3"
          >
            <div className="text-sm">
              <span className="font-medium">💰 {t.groupName}</span> verteilt das Budget für{" "}
              <span className="font-medium">{t.cycleLabel}</span>.
              {t.deadline && (
                <span className="ml-1 text-xs text-muted-foreground">
                  Deadline: {t.deadline.toLocaleDateString("de-DE")}
                </span>
              )}
            </div>
            <Link
              href={t.href}
              className="rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800"
            >
              Budget verteilen →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
