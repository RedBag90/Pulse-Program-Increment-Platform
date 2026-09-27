import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
import { Link } from "@/i18n/navigation";
import { formatDate } from "@/lib/formatting";
import { userLabel } from "@/components/detail/initiative-labels";
import type { MyPiFeedbackTask } from "@/modules/drumbeat/server/views/pi-feedback-view";

/**
 * My-Tasks-Sektion „Feedback angefragt": die PI-Feedback-Runden, in denen die
 * Person benannt ist. Offene zuerst, überfällige rot; abgeschickte bleiben 30
 * Tage stehen und lassen sich ändern, bis die Runde übernommen ist.
 * Rein präsentational — geladen im Kompositionsroot (`my-tasks/page.tsx`).
 */
export function PiFeedbackTasksSection({
  tasks,
  userLabels,
}: {
  tasks: MyPiFeedbackTask[];
  userLabels: Record<string, string>;
}) {
  const t = useTranslations();
  const locale = useLocale() as Locale;
  if (tasks.length === 0) return null;
  const offen = tasks.filter((x) => x.status === "pending").length;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-[0.1em] text-muted-foreground">
        {t("drumbeat.feedback.task.titel")}
        {offen > 0 && (
          <span className="ml-2 rounded-full bg-warning-surface px-2 py-0.5 text-label normal-case tracking-normal text-warning">
            {t("drumbeat.feedback.task.offen", { count: offen })}
          </span>
        )}
      </h2>
      <ul className="mt-2 space-y-2">
        {tasks.map((task) => {
          const erledigt = task.status === "submitted";
          return (
            <li
              key={task.requestId}
              className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-card px-4 py-3 shadow-card"
            >
              <div className={erledigt ? "text-sm text-muted-foreground" : "text-sm"}>
                <span className="font-medium">
                  {t("drumbeat.feedback.task.zeile", { pi: task.piName })}
                </span>
                <span className="ml-1 text-xs text-muted-foreground">
                  {t("drumbeat.feedback.task.kontext", {
                    art: task.artName,
                    von: userLabel(task.requestedBy, userLabels),
                  })}
                </span>
                {erledigt ? (
                  <span className="ml-2 text-xs">
                    {t("drumbeat.feedback.task.abgeschicktAm", {
                      datum: formatDate(task.submittedAt, "date", locale),
                    })}
                  </span>
                ) : (
                  task.dueDate && (
                    <span
                      className={
                        task.overdue
                          ? "ml-2 text-xs font-semibold text-destructive"
                          : "ml-2 text-xs tabular-nums text-muted-foreground"
                      }
                    >
                      {task.overdue
                        ? t("drumbeat.feedback.task.ueberfaellig", {
                            datum: formatDate(task.dueDate, "date", locale),
                          })
                        : t("drumbeat.feedback.fristBis", {
                            datum: formatDate(task.dueDate, "date", locale),
                          })}
                    </span>
                  )
                )}
              </div>
              {erledigt ? (
                !task.closed && (
                  <Link href={task.href} className="text-sm text-primary hover:underline">
                    {t("drumbeat.feedback.task.aendern")}
                  </Link>
                )
              ) : (
                <Link
                  href={task.href}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
                >
                  {t("drumbeat.feedback.task.geben")}
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
