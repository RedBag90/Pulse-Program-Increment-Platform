import { Link } from "@/i18n/navigation";
import type { MyBudgetingTask } from "@/modules/budgeting/server/services/my-budgeting-tasks";

/**
 * My-Tasks-Sektion für Gruppenmitglieder mit offener Budget-Verteilung.
 * Verschwindet automatisch, sobald die Gruppe eingereicht hat (der Loader liefert
 * dann nichts mehr). Rein präsentational.
 */
export function BudgetingTasksSection({ tasks }: { tasks: MyBudgetingTask[] }) {
  if (tasks.length === 0) return null;

  return (
    <section className="border-b bg-surface-frame px-6 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Budgeting</h2>
      <ul className="mt-2 space-y-2">
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
