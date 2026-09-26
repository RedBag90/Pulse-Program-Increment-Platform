import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { getEpicCycleAllocations } from "@/modules/budgeting/server/services/epic-allocation";
import { getValueStreamChangeBudgets } from "@/modules/budgeting/server/services/value-stream-change-budget";
import {
  FundingBar,
  FundingLegend,
  summe,
} from "@/modules/work/features/portfolio/overview/blocks/funding-snapshot-table";
import { Page, PageHeader } from "@/components/layout";
import { Stat, StatStrip } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { formatEUR } from "@/lib/formatting";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { Landmark } from "lucide-react";

/**
 * Die Wertströme aus Budget-Sicht — der Einstieg in die Fläche, auf der ein
 * ART-Epic-Budget entsteht und der Zuspruch aufgeteilt wird.
 *
 * Löst `/budgeting/run-the-business` ab, das dieselben Positionen zeigte, aber
 * ohne Detailebene und ohne Nav-Eintrag.
 *
 * **Die Anatomie kommt von `/structure/rollen`**, nicht von `/structure`
 * selbst: dort ist „dieselbe Fläche, zwei Darstellungen" aus den geteilten
 * Bauteilen gebaut — `PageHeader`, `StatStrip`, `EmptyState` —, während
 * `/structure` seine Tabelle und sein Werkzeugband von Hand rollt. Das
 * Zielbild war `/structure`; die saubere Vorlage ist die Schwesterseite.
 *
 * **Was die Seite bisher wegwarf**, obwohl sie es geladen hatte: die ARTs
 * jedes Wertstroms (`listValueStreams` lädt sie mit) und die
 * Halbjahres-Aufteilung. `getValueStreamBudgetTotals` ist wörtlich ein
 * `Object.fromEntries(…b.total)` über `getValueStreamBudgets` — dieselbe
 * `cache()`-Arbeit, nur ohne die Achse. Jetzt wird die vollständige Form
 * gelesen; eine zusätzliche Abfrage kostet das nicht.
 *
 * **Und die Schranke, die fehlte:** ohne das Budgeting-Modul steht **kein**
 * Betrag da, nicht `0 €`. `/structure` unterscheidet das seit jeher
 * (`money === null` heisst „nicht gemessen"); hier las sich jeder Wertstrom
 * ohne Zuteilung wie einer mit null Euro.
 *
 * **Seit September 2026 dieselben Zahlen wie der Funding-Snapshot** der
 * Portfolio-Übersicht: das Veränderungsgeld der **geltenden Budget-Kachel**
 * (nicht des Kalender-Halbjahrs) — Portfolio-Epics plus ART-Rahmen, der Rahmen
 * aufgeteilt in an ART-Epics / für ART-eigene Arbeit / noch nicht vergeben.
 * Vorher stand hier nur das Portfolio-Geld, und daneben eine Summe über alle
 * Halbjahre. Den Balken liefert das Snapshot-Bauteil aus Work — der App-Baum
 * darf beide Module zusammensetzen (ADR-0013).
 */

export default async function BudgetingValueStreamsPage() {
  const t = await getTranslations();
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const budgetingEnabled = principal.enabledModules.includes("budgeting");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [valueStreams, cycle] = await Promise.all([
    listValueStreams(db, principal.tenantId),
    budgetingEnabled
      ? getEpicCycleAllocations(db, principal.tenantId, new Date())
      : Promise.resolve({ cycleKey: null }),
  ]);
  // Ohne geltende Kachel gibt es kein Veränderungsgeld — und keinen Betrag.
  const cycleKey = cycle.cycleKey;
  const change = cycleKey
    ? await getValueStreamChangeBudgets(db, principal.tenantId, cycleKey)
    : [];

  const changeOf = new Map(change.map((c) => [c.valueStreamId, c]));
  const artCount = valueStreams.reduce((sum, vs) => sum + vs.arts.length, 0);
  const cycleTotal = change.reduce((sum, c) => sum + summe(c), 0);
  const max = Math.max(...change.map(summe), 1);

  return (
    <Page>
      <PageHeader
        eyebrow={t("budgeting.page.participatoryBudgeting")}
        title={t("budgeting.ui.valueStreams")}
        subtitle={t("budgeting.ui.valueStreamsSubtitle")}
      />

      {valueStreams.length === 0 ? (
        <EmptyState
          icon={<Landmark className="size-6" />}
          title={t("budgeting.ui.noValueStreams")}
        />
      ) : (
        <>
          {/* Die Kennzahlen stehen über der **ungefilterten** Menge — dieselbe
              Trennung wie im Rollenverzeichnis: die Liste zeigt, was gesucht
              wurde, die Leiste, worüber gesprochen wird. */}
          <StatStrip>
            <Stat label={t("budgeting.ui.wertstroeme")} value={valueStreams.length} />
            <Stat label={t("budgeting.ui.arts")} value={artCount} />
            {cycleKey && (
              <Stat
                label={t("budgeting.ui.zugeteiltImHalbjahr", { cycle: halfYearLabel(cycleKey) })}
                value={formatEUR(cycleTotal)}
              />
            )}
          </StatStrip>

          {cycleKey && <FundingLegend />}

          <ul className="divide-y rounded-lg border">
            {valueStreams.map((vs) => {
              const row = changeOf.get(vs.id);
              return (
                <li
                  key={vs.id}
                  data-vs={vs.id}
                  className="flex flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3"
                >
                  <div className="min-w-0 sm:w-56">
                    <Link
                      href={`/budgeting/value-streams/${vs.id}`}
                      className="font-medium hover:underline"
                    >
                      {vs.name}
                    </Link>
                    <p className="text-meta text-muted-foreground">
                      {vs.arts.length === 1
                        ? t("budgeting.ui.artEinzahl")
                        : t("budgeting.ui.artsAnzahl", { n: vs.arts.length })}
                    </p>
                  </div>
                  {cycleKey && (
                    <>
                      <div className="order-last min-w-0 basis-full sm:order-none sm:basis-0 sm:flex-1">
                        {row && <FundingBar row={row} max={max} />}
                      </div>
                      <p className="ml-auto text-right text-sm font-medium tabular-nums sm:ml-0">
                        {formatEUR(row ? summe(row) : 0)}
                      </p>
                    </>
                  )}
                </li>
              );
            })}
          </ul>

          {!budgetingEnabled && (
            <p className="text-sm text-muted-foreground">{t("budgeting.ui.ohneBudgetingModul")}</p>
          )}
        </>
      )}
    </Page>
  );
}
