import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";

/**
 * **Die Kopfzeile einer Meeting-Ansicht** — welcher Termin, in welchem
 * Rhythmus, welche Frage er beantwortet, und der Weg zur Agenda im Wiki
 * („Welche Termine es braucht": wer dabei ist, was jeder vorbereitet).
 *
 * Der Wiki-Anker ist der Schlüssel des Events (`/wiki/termine#<key>`). Work
 * importiert das Wiki nicht (ADR-0017); die drei Schlüssel stehen hier, und
 * ein Test hält sie gegen die Events des Wikis.
 */
export type MeetingKey =
  | "strategic-portfolio-review"
  | "portfolio-sync"
  | "participatory-budgeting";

const TEXT: Record<MeetingKey, { name: string; cadence: string; question: string }> = {
  "strategic-portfolio-review": {
    name: "work.overview.meetingReviewName",
    cadence: "work.overview.meetingReviewCadence",
    question: "work.overview.meetingReviewQuestion",
  },
  "portfolio-sync": {
    name: "work.overview.meetingSyncName",
    cadence: "work.overview.meetingSyncCadence",
    question: "work.overview.meetingSyncQuestion",
  },
  "participatory-budgeting": {
    name: "work.overview.meetingBudgetingName",
    cadence: "work.overview.meetingBudgetingCadence",
    question: "work.overview.meetingBudgetingQuestion",
  },
};

export function MeetingHeader({ meeting }: { meeting: MeetingKey }) {
  const t = useTranslations();
  const text = TEXT[meeting];
  return (
    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 rounded-lg border bg-muted/20 px-4 py-3">
      <div className="space-y-0.5">
        <p className="flex flex-wrap items-baseline gap-2">
          <span className="font-heading text-base font-semibold">{t(text.name)}</span>
          <span className="rounded-full bg-muted px-2 py-0.5 font-mono text-label uppercase tracking-[0.1em] text-muted-foreground">
            {t(text.cadence)}
          </span>
        </p>
        <p className="text-sm text-muted-foreground">{t(text.question)}</p>
      </div>
      <Link
        href={`/wiki/termine#${meeting}` as never}
        className="text-sm text-primary hover:underline"
      >
        {t("work.overview.meetingWerIstDabei")}
      </Link>
    </div>
  );
}
