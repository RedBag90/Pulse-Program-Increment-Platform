import { useLocale } from "next-intl";
import { formatDate, formatEUR } from "@/lib/formatting";
import { isLocale, routing } from "@/i18n/routing";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import type {
  MyBudgetingTask,
  MyArtFundingTask,
} from "@/modules/budgeting/server/services/my-budgeting-tasks";

/**
 * My-Tasks-Sektion für Gruppenmitglieder mit offener Budget-Verteilung.
 * Verschwindet automatisch, sobald die Gruppe eingereicht hat (der Loader liefert
 * dann nichts mehr). Rein präsentational.
 *
 * Trägt die Form ihrer Geschwister im Abschnitt „Meine Tasks" — siehe
 * `work/features/my-tasks/components/help-requests-section.tsx`.
 */
export function BudgetingTasksSection({
  tasks,
  funding = [],
}: {
  tasks: MyBudgetingTask[];
  /** ARTs, deren Budget steht und noch nicht verteilt ist. */
  funding?: MyArtFundingTask[];
}) {
  const t = useTranslations();
  const roh = useLocale();
  const locale = isLocale(roh) ? roh : routing.defaultLocale;
  if (tasks.length === 0 && funding.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {t("budgeting.ui.budgeting")}
      </h2>
      <ul className="mt-2 space-y-2">
        {funding.map((f) => (
          <li
            key={f.artId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card shadow-card px-4 py-3"
          >
            <div className="text-sm">
              {t.rich("budgeting.ui.artRahmenStehtNochNichtVerteilt", {
                art: f.artName,
                cycle: f.cycleLabel,
                amount: formatEUR(f.remaining, locale),
                b: (c) => <span className="font-medium">{c}</span>,
                num: (c) => <span className="font-medium tabular-nums">{c}</span>,
              })}
            </div>
            <Link
              href={f.href}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("budgeting.ui.budgetVerteilen")}
            </Link>
          </li>
        ))}
        {tasks.map((task) => (
          <li
            key={task.groupId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card shadow-card px-4 py-3"
          >
            <div className="text-sm">
              {t("budgeting.ui.distributesBudgetFor", {
                group: `💰 ${task.groupName}`,
                cycle: task.cycleLabel,
              })}
              {task.deadline && (
                <span className="ml-1 text-xs text-muted-foreground">
                  {t("budgeting.ui.deadline", { date: formatDate(task.deadline, "date", locale) })}
                </span>
              )}
            </div>
            <Link
              href={task.href}
              className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              {t("budgeting.ui.budgetVerteilen")}
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
