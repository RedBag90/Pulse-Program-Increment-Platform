import { useTranslations } from "next-intl";
import { formatCompactEUR } from "@/lib/formatting";
import { cn } from "@/lib/utils";
import type { StructureMoney } from "@/modules/core/org/server/views/structure-overview";

/**
 * Die drei Zahlen an einem Strukturknoten — und **warum sie fehlen**, wenn sie
 * fehlen.
 *
 * Bis September 2026 stand für drei verschiedene Sachverhalte derselbe Strich:
 * der Knoten hat gar kein Epic, seine Epics haben keinen freigegebenen Business
 * Case, oder die freigegebenen Zahlen ergeben tatsächlich 0 €. Das erste ist
 * eine Lücke in der Struktur, das zweite eine im Verfahren — zwei verschiedene
 * Aufgaben für zwei verschiedene Leute.
 *
 * `money === null` heisst etwas Viertes: **nicht gemessen**, weil der Mandant
 * das Modul nicht gebucht hat. Dann steht gar nichts da, keine 0 €.
 *
 * **Drei Schalter, weil es drei Herkünfte sind:** die Epic-Zahl kommt aus Work,
 * der Betrieb aus Budgeting, und der Investbetrag aus beiden — Work kennt die
 * Epics, die Zuteilung liegt in Budgeting. Sie zusammenzufassen hiesse, einem
 * Mandanten ohne Budgeting auch seine Epic-Zahl zu nehmen.
 */
export function StructureFigures({
  money,
  showEpics,
  showInvest,
  showRun,
  className,
}: {
  money: StructureMoney | null;
  showEpics: boolean;
  showInvest: boolean;
  showRun: boolean;
  className?: string;
}) {
  const t = useTranslations();
  if (money == null || (!showEpics && !showInvest && !showRun)) return null;
  return (
    <span
      className={
        className ??
        "flex flex-wrap items-baseline gap-x-3 gap-y-0.5 text-meta tabular-nums text-muted-foreground"
      }
    >
      {showEpics && (
        <span>
          {money.epicCount === 0 ? (
            <em className="not-italic opacity-80" title={t("org.ui.diesemKnotenIstKein")}>
              {t("org.ui.keinEpic")}
            </em>
          ) : (
            <>
              <b className="font-semibold text-foreground">{money.epicCount}</b> {t("org.ui.epics")}
            </>
          )}
        </span>
      )}
      {showInvest && money.epicCount > 0 && (
        <span>
          {money.grow > 0 ? (
            <>
              {t("org.ui.grow")}{" "}
              <b className="font-semibold text-foreground">{formatCompactEUR(money.grow)}</b>
            </>
          ) : (
            <em className="not-italic opacity-80" title={t("org.ui.inDiesemHalbjahrIst")}>
              {t("org.ui.nichtZugeteilt")}
            </em>
          )}
        </span>
      )}
      {showRun && (
        <span>
          {money.run > 0 ? (
            <>
              {t("org.ui.run")}{" "}
              <b className="font-semibold text-foreground">{formatCompactEUR(money.run)}</b>
            </>
          ) : (
            <em className="not-italic opacity-80">{t("org.ui.keinRun")}</em>
          )}
        </span>
      )}
    </span>
  );
}

/** „1" in Bernstein — offene Angaben an diesem Knoten, Namen im Titel. */
export function GapBadge({ gaps, className }: { gaps: readonly string[]; className?: string }) {
  const t = useTranslations();
  if (gaps.length === 0) return null;
  return (
    <span
      className={cn(
        "shrink-0 rounded-full bg-warning-surface px-1.5 text-label font-semibold text-warning",
        className,
      )}
      title={gaps.join(", ")}
    >
      {gaps.length}
      <span className="sr-only">
        {" "}
        {t("org.ui.strukturOffeneAngaben", { list: gaps.join(", ") })}
      </span>
    </span>
  );
}

/**
 * Dieselben drei Aussagen als **Tabellenzellen** — dasselbe Vokabular, andere
 * Form. Beide Darstellungen der Fläche lesen es aus dieser einen Datei, damit
 * „kein Epic" nicht an einer Stelle „—" heisst.
 */
export function EpicsCell({ money }: { money: StructureMoney | null }) {
  const t = useTranslations();
  if (money == null) return <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>;
  return (
    <td className="px-3 py-1.5 text-right tabular-nums">
      {money.epicCount === 0 ? (
        <span className="text-meta text-muted-foreground">{t("org.ui.keinEpic")}</span>
      ) : (
        money.epicCount
      )}
    </td>
  );
}

export function GrowCell({ money }: { money: StructureMoney | null }) {
  const t = useTranslations();
  if (money == null) return <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>;
  if (money.epicCount === 0)
    return (
      <td className="px-3 py-1.5 text-right text-meta text-muted-foreground">
        <span title={t("org.ui.diesemKnotenIstKein")}>{t("org.ui.keinEpic")}</span>
      </td>
    );
  if (money.grow === 0)
    return (
      <td className="px-3 py-1.5 text-right text-meta text-muted-foreground">
        <span title={t("org.ui.inDiesemHalbjahrIst")}>{t("org.ui.nichtZugeteilt")}</span>
      </td>
    );
  return <td className="px-3 py-1.5 text-right tabular-nums">{formatCompactEUR(money.grow)}</td>;
}

export function RunCell({ money }: { money: StructureMoney | null }) {
  if (money == null || money.run === 0)
    return <td className="px-3 py-1.5 text-right text-muted-foreground">—</td>;
  return <td className="px-3 py-1.5 text-right tabular-nums">{formatCompactEUR(money.run)}</td>;
}
