import { getLocale, getTranslations } from "next-intl/server";
import { notFound, redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { loadPeriodDetail } from "@/modules/budgeting/server/views/period-detail";
import { loadDistributionOverview } from "@/modules/budgeting/server/views/distribution-overview";
import { loadPeriodValueStreams } from "@/modules/budgeting/server/views/period-valuestreams";
import { PeriodSetupTab } from "@/modules/budgeting/features/components/period/period-setup-tab";
import { PeriodDistributionTab } from "@/modules/budgeting/features/components/period/period-distribution-tab";
import { PeriodResultTab } from "@/modules/budgeting/features/components/period/period-result-tab";
import { PeriodPhaseRail } from "@/modules/budgeting/features/components/period/period-phase-rail";
import { DeletePeriodButton } from "@/modules/budgeting/features/components/period/delete-period-button";
import { cycleMoneyAtStake } from "@/modules/budgeting/server/services/cycle-money";
import {
  periodPhases,
  PERIOD_TABS,
  type PeriodTab,
} from "@/modules/budgeting/domain/period-phases";
import type { RoundStatus } from "@/modules/budgeting/domain/round-status";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { halfYearLabel } from "@/modules/core/kernel/domain/calendar";
import { periodName } from "@/modules/budgeting/features/components/period/period-name";
import type { Locale } from "@/i18n/routing";

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

const STATUS_LABEL: Record<string, string> = {
  draft: "Entwurf",
  running: "läuft",
  decided: "entschieden",
  closed: "abgeschlossen",
};

// Aus `PERIOD_TABS` abgeleitet, damit die Phasen-Leiste nicht auf einen Reiter
// zeigen kann, den es hier nicht gibt.
const TAB_LABELS: Record<PeriodTab, string> = {
  setup: "Setup",
  verteilung: "Verteilung",
  ergebnis: "Ergebnis",
};
const TABS: readonly DetailTab[] = PERIOD_TABS.map((key) => ({ key, label: TAB_LABELS[key] }));

/**
 * Kachel-Detail — die **einzige** Fläche des Budgeting-Ablaufs: Setup,
 * Verteilung und Ergebnis samt Einfrieren. Die Phasen-Leiste im Sub-Header
 * beantwortet tab-unabhängig „wo stehe ich" und verlinkt auf den Reiter, der
 * den Schritt trägt.
 *
 * Vorher lagen Finalisierung, abgeleitete Budgets und Snapshot über drei
 * Reiter und zwei weitere Nav-Einträge verteilt.
 */
export default async function BudgetingPeriodDetailPage({ params, searchParams }: Props) {
  const t = await getTranslations();
  const locale = (await getLocale()) as Locale;
  const { id } = await params;
  const { tab } = await searchParams;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadPeriodDetail(db, principal, id);
  if (!model) notFound();

  const activeTab = resolveTab(TABS, tab) as PeriodTab;
  const basePath = `/budgeting/periods/${id}`;
  const closed = model.round.status === "closed";

  // Die Verteilungs-Matrix speist beide hinteren Reiter **und** die Phasen —
  // deshalb immer laden; die abgeleiteten Budgets erst, wenn es sie gibt.
  const [overview, valueStreams, revision, geldAufDemSpiel] = await Promise.all([
    loadDistributionOverview(db, principal, id),
    closed ? loadPeriodValueStreams(db, principal.tenantId, id) : Promise.resolve(null),
    db.budgetPlanRevision.findFirst({
      where: { tenantId: principal.tenantId, cycleKey: model.round.cycleKey },
      select: { id: true },
    }),
    // Was das Löschen mitnimmt — der Dialog nennt es vorher.
    model.canManage
      ? cycleMoneyAtStake(db, principal.tenantId, model.round.cycleKey)
      : Promise.resolve(null),
  ]);

  const phases = periodPhases({
    status: model.round.status as RoundStatus,
    poolTotal: model.round.poolTotal,
    hasTimeframe: model.round.startDate != null && model.round.endDate != null,
    // Epics **und** Run-the-Business-Positionen. Die Leiste sagte sonst „Erst
    // mit Kandidaten auf der PB-Liste", waehrend der Knopf im Reiter darunter
    // laengst darf — dieselbe Halbwahrheit, die `period-setup-tab` hatte.
    candidateCount: model.epicCandidates.length + model.rtbCandidates.length,
    staffedGroupCount: model.groups.filter((g) => g.members.length > 0).length,
    groupCount: overview?.groups.length ?? model.groups.length,
    submittedCount: overview?.submittedCount ?? 0,
    hasRevision: revision != null,
  });

  const canCapture = authorize(
    "budget_plan.revision.capture",
    { tenantId: principal.tenantId },
    principal,
  ).allow;

  // Der Titel ist der **Zeitraum**, nicht das Halbjahr des Starts — siehe
  // `periodName`. Der `cycleLabel` weiter unten bleibt das Halbjahr: er
  // benennt das Zuteilungsfenster, nicht die Kachel.
  const titel = periodName(
    model.round.startDate,
    model.round.endDate,
    halfYearLabel(model.round.cycleKey),
    locale,
  );

  return (
    <EntityDetailShell
      backHref="/budgeting/periods"
      backLabel="Budgeting-Zeiträume"
      title={titel}
      badge={STATUS_LABEL[model.round.status] ?? model.round.status}
      tabs={TABS}
      activeTab={activeTab}
      basePath={basePath}
      headerActions={
        model.canManage ? (
          <DeletePeriodButton
            id={id}
            atStake={geldAufDemSpiel}
            cycleLabel={halfYearLabel(model.round.cycleKey)}
          />
        ) : undefined
      }
      subHeader={<PeriodPhaseRail phases={phases} basePath={basePath} />}
    >
      {activeTab === "setup" && <PeriodSetupTab model={model} />}

      {activeTab === "verteilung" &&
        (overview ? (
          <PeriodDistributionTab model={overview} basePath={basePath} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {t("budgeting.page.keineVerteilungsdaten")}
          </p>
        ))}

      {activeTab === "ergebnis" &&
        (overview ? (
          <PeriodResultTab
            model={overview}
            valueStreams={valueStreams}
            cycleKey={model.round.cycleKey}
            cycleLabel={halfYearLabel(model.round.cycleKey)}
            canCapture={canCapture}
            hasRevision={revision != null}
          />
        ) : (
          <p className="text-sm text-muted-foreground">{t("budgeting.page.keinErgebnis")}</p>
        ))}
    </EntityDetailShell>
  );
}
