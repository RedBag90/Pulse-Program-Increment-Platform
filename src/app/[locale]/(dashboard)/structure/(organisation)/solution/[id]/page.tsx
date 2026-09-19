import { notFound, redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { listAuditHistory } from "@/server/services/audit-history";
import { loadSolutionDetail } from "@/modules/core/org/server/views/solution-detail";
import { loadSolutionEpics, loadSolutionFeatures } from "@/modules/work/server/views/solution-grow";
import { HorizonBadge } from "@/modules/core/org/features/solution/components/horizon-badge";
import { SolutionLifecycleBar } from "@/modules/core/org/features/solution/components/solution-lifecycle-bar";
import { SolutionGrowRunTiles } from "@/modules/core/org/features/solution/components/solution-grow-run-tiles";
import { listRtbItems } from "@/modules/budgeting/server/services/rtb-item-service";
import { RtbSection } from "@/modules/budgeting/features/components/rtb/rtb-section";
import { sumRtbAnnual } from "@/modules/budgeting/domain/rtb-interval";
import { SolutionEditButton } from "@/modules/core/org/features/solution/components/solution-edit-button";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { AuditTimeline } from "@/components/detail/audit-timeline";
import { SolutionProductManager } from "@/modules/core/org/features/solution/components/solution-product-manager";
import { listTenantApprovers } from "@/modules/work/server/services/tenant-approvers";
import { listTenantUserLabels } from "@/server/services/tenant-users";
import { STAGE_SHORT } from "@/components/detail/initiative-labels";
import { formatCompactEUR } from "@/lib/formatting";

const CORE_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "history", label: "Verlauf" },
];

/**
 * Der Arbeits-Reiter steht zwischen Overview und Verlauf — aber nur mit
 * **Work**. Er liest Epics, Business Cases und Features; ohne das Modul gibt es
 * das alles nicht, und ein leerer Reiter sähe aus wie ein Datenfehler
 * (ADR-0022).
 *
 * Der Schlüssel bleibt `epics`, damit gespeicherte Links weiter funktionieren —
 * die Beschriftung nennt jetzt beides.
 */
const WORK_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "epics", label: "Epics & Features" },
  { key: "history", label: "Verlauf" },
];

interface Props {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/**
 * Solution-Detail — dieselbe `EntityDetailShell` wie Epic, Feature und Value
 * Stream. Der Lifecycle sitzt tab-unabhängig im Sub-Header, weil der
 * Horizont-Wechsel der Vorgang dieser Fläche ist; die Reiter tragen Ökonomie,
 * zugeordnete Epics und den Audit-Verlauf.
 *
 * Kompositions-Wurzel über zwei Modulen (ADR-0013): Grow und Lifecycle kommen
 * aus **Work**, die Betriebskosten (Run) aus **Budgeting**. Ohne dessen
 * Entitlement degradiert die Run-Kachel, statt zu fehlen.
 */
export default async function SolutionDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const { tab } = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadSolutionDetail(db, principal.tenantId, id);
  if (!model) notFound();

  const canManage = hasCapability(principal, "solution.manage", { tenantId: principal.tenantId });
  const [approvers, userLabels] = await Promise.all([
    listTenantApprovers(db, principal.tenantId),
    listTenantUserLabels(db, principal.tenantId),
  ]);
  const budgetingEnabled = principal.enabledModules.includes("budgeting");
  const workEnabled = principal.enabledModules.includes("work");
  const TABS = workEnabled ? WORK_TABS : CORE_TABS;
  const activeTab = resolveTab(TABS, tab);
  // Grow und die Primaer-Epics stammen aus Work; ohne das Modul bleibt der
  // Strukturknoten uebrig — Name, Wertstrom, ART, Horizont, Verantwortliche.
  const [workSide, solutionFeatures] = workEnabled
    ? await Promise.all([
        loadSolutionEpics(db, principal.tenantId, model.id),
        loadSolutionFeatures(db, principal.tenantId, model.id),
      ])
    : [null, []];
  /**
   * **Hier wird nichts mehr gepflegt** (2026-09-19). Betriebspositionen gehören
   * dem Wertstrom, und er hat dafür einen Ort: den Reiter „Einrichten" seiner
   * Geldfläche. Zwei Pflegeorte für dieselben Zeilen hiessen zwei Stellen, an
   * denen Rechte, Formular und Wortwahl auseinanderlaufen können.
   *
   * Mit dem Schreibweg ist auch die Rechteprüfung entfallen — sie holte eigens
   * den Finance-Verantwortlichen des Wertstroms und stand damit neben der
   * Prüfung, die der Service ohnehin macht (`assertRtbManage`).
   */

  const [history, rtbItems] = await Promise.all([
    listAuditHistory(db, principal.tenantId, "solution", id),
    budgetingEnabled
      ? listRtbItems(db, principal.tenantId, { solutionId: id })
      : Promise.resolve(null),
  ]);
  const run = rtbItems ? sumRtbAnnual(rtbItems) : null;
  const events = history.map((e) => ({
    id: e.id,
    action: e.action,
    occurredAt: e.occurredAt.toISOString(),
  }));

  return (
    <EntityDetailShell
      backHref="/structure/solutions"
      backLabel="Zurück zu den Solutions"
      title={model.name}
      badge={
        <HorizonBadge horizon={model.horizon} investmentMode={model.investmentMode} withHelp />
      }
      tabs={TABS}
      activeTab={activeTab}
      basePath={`/structure/solution/${model.id}`}
      {...(canManage ? { headerActions: <SolutionEditButton model={model} /> } : {})}
      subHeader={<SolutionLifecycleBar model={model} canManage={canManage} />}
    >
      {activeTab === "overview" && (
        <div className="space-y-6">
          <SolutionProductManager
            solutionId={model.id}
            productManagerId={model.productManagerId}
            users={approvers}
            userLabels={userLabels}
            canManage={canManage || model.productManagerId === principal.id}
          />
          {(workSide || rtbItems) && (
            <SolutionGrowRunTiles
              grow={workSide?.grow ?? null}
              run={run}
              runItemCount={rtbItems?.filter((i) => i.active).length ?? 0}
            />
          )}
          {rtbItems && (
            <RtbSection
              valueStreamId={model.valueStreamId}
              items={rtbItems}
              canManage={false}
              solutionId={model.id}
              /*
                Beides nur, damit die Spalte den **ART** benennen kann, auf dem
                das Geld dieser Solution landet — vorher stand dort „—", weil
                die Fläche weder ARTs noch Solutions kannte. Zusätzliche
                Abfragen kostet das nicht: `loadSolutionDetail` trägt beides.
              */
              arts={
                model.artId != null && model.artName != null
                  ? [{ id: model.artId, name: model.artName }]
                  : []
              }
              solutions={[{ id: model.id, name: model.name, artId: model.artId }]}
            />
          )}
        </div>
      )}

      {activeTab === "epics" && (
        <section className="space-y-3">
          <h2 className="text-lg font-medium">Zugeordnete Epics (Primär)</h2>
          <p className="text-sm text-muted-foreground">
            Diese Epics erben den Horizont der Solution — bis ihr Business Case freigegeben ist. Ab
            dann tragen sie ihn selbst, vom Tag der Freigabe, und folgen einem späteren Wechsel der
            Solution nicht mehr. Sie können deshalb in einem anderen Horizont stehen als das
            Produkt; das ist kein Fehler, sondern die Zusicherung, dass ein Horizont-Wechsel die
            Vergangenheit nicht umschreibt.
          </p>
          {(workSide?.epics.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">
              Noch keine Epics dieser Solution zugeordnet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {(workSide?.epics ?? []).map((e) => (
                <li
                  key={e.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <Link href={`/portfolio/epics/${e.id}`} className="font-medium hover:underline">
                    {e.title}
                  </Link>
                  <span className="flex items-center gap-3">
                    <span className="rounded-sm bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                      {STAGE_SHORT[e.stageGate as keyof typeof STAGE_SHORT] ?? e.stageGate}
                    </span>
                    {/* `null` = Business Case noch nicht freigegeben. Ein Strich
                        statt einer Null: „noch keine belastbare Zahl" ist etwas
                        anderes als „kostet nichts". */}
                    <span className="tabular-nums text-muted-foreground">
                      {e.cost != null && e.cost > 0 ? formatCompactEUR(e.cost) : "—"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}

          <h2 className="pt-4 text-lg font-medium">Direkt zugeordnete Features</h2>
          <p className="text-sm text-muted-foreground">
            Features, die ihre Solution <strong className="font-medium">selbst</strong> tragen — ein
            Feature wird in genau eine Solution geliefert. Features, die sie nur über ihr Epic
            erben, stehen nicht hier: sie hängen unter einem Epic aus der Liste darüber. Diese
            Zeilen tragen <strong className="font-medium">kein Geld</strong>; Grow ist die Summe der
            Umsetzungskosten der Primär-Epics, ein Feature hat keinen Business Case.
          </p>
          {solutionFeatures.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Kein Feature ist dieser Solution direkt zugeordnet.
            </p>
          ) : (
            <ul className="divide-y rounded-lg border">
              {solutionFeatures.map((f) => (
                <li
                  key={f.id}
                  className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                >
                  <Link href={`/feature/${f.id}`} className="font-medium hover:underline">
                    {f.title}
                  </Link>
                  <span className="flex items-center gap-3 text-xs text-muted-foreground">
                    {f.artName && <span>{f.artName}</span>}
                    {/* Kein Epic ist hier kein fehlender Wert, sondern eine Aussage. */}
                    <span>{f.epic ? f.epic.title : "eigenständig"}</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {activeTab === "history" && (
        <section>
          <h2 className="mb-3 text-lg font-medium">Verlauf</h2>
          <AuditTimeline events={events} />
        </section>
      )}
    </EntityDetailShell>
  );
}
