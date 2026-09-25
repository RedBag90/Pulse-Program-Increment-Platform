import { getTranslations } from "next-intl/server";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listValueStreams } from "@/modules/core/org/server/services/value-stream";
import { getValueStreamBudgets } from "@/modules/budgeting/server/services/budgeting";
import { Page, PageHeader } from "@/components/layout";
import { Stat, StatStrip } from "@/components/ui/stat";
import { EmptyState } from "@/components/ui/empty-state";
import { formatEUR } from "@/lib/formatting";
import { halfYearKey, halfYearLabel } from "@/modules/core/kernel/domain/calendar";
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
 */

export default async function BudgetingValueStreamsPage() {
  const t = await getTranslations();
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const budgetingEnabled = principal.enabledModules.includes("budgeting");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const [valueStreams, budgets] = await Promise.all([
    listValueStreams(db, principal.tenantId),
    budgetingEnabled
      ? getValueStreamBudgets(db, principal.tenantId)
      : Promise.resolve({ periods: [], valueStreams: [] }),
  ]);

  const budgetOf = new Map(budgets.valueStreams.map((b) => [b.valueStreamId, b]));
  const cycleKey = halfYearKey(new Date());
  const artCount = valueStreams.reduce((sum, vs) => sum + vs.arts.length, 0);
  const cycleTotal = budgets.valueStreams.reduce((sum, b) => sum + (b.byPeriod[cycleKey] ?? 0), 0);

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
            {budgetingEnabled && (
              <Stat
                label={t("budgeting.ui.zugeteiltImHalbjahr", { cycle: halfYearLabel(cycleKey) })}
                value={formatEUR(cycleTotal)}
              />
            )}
          </StatStrip>

          <ul className="divide-y rounded-lg border">
            {valueStreams.map((vs) => {
              const budget = budgetOf.get(vs.id);
              return (
                <li key={vs.id} className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3">
                  <div className="min-w-0 flex-1">
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
                  {budgetingEnabled && (
                    <div className="text-right text-sm tabular-nums">
                      <p className="font-medium">{formatEUR(budget?.byPeriod[cycleKey] ?? 0)}</p>
                      <p className="text-meta text-muted-foreground">
                        {formatEUR(budget?.total ?? 0)} {t("budgeting.ui.zugeteiltInsgesamt")}
                      </p>
                    </div>
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
