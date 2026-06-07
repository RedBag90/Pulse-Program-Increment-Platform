import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { PiOverviewTab } from "@/features/umsetzung/components/pi-overview-tab";
import { PiPlanTab } from "@/features/umsetzung/components/pi-plan-tab";
import {
  PiObjectivesTab,
  type ObjectiveRow,
} from "@/features/umsetzung/components/pi-objectives-tab";
import {
  PiExecutionTab,
  type ExecutionFeature,
} from "@/features/umsetzung/components/pi-execution-tab";
import {
  PiDependenciesTab,
  type PiDependencyEdge,
} from "@/features/umsetzung/components/pi-dependencies-tab";
import {
  PiImpedimentsTab,
  type PiImpedimentRow,
} from "@/features/umsetzung/components/pi-impediments-tab";
import {
  PiClosureTab,
  type ClosureOpenImpediment,
} from "@/features/umsetzung/components/pi-closure-tab";
import type { PlanningModel } from "@/server/views/pi-planning";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import type { PiWorkspaceModel } from "@/server/views/pi-workspace";

const PI_WORKSPACE_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "plan", label: "Plan" },
  { key: "execution", label: "Execution" },
  { key: "objectives", label: "Objectives" },
  // Tabs aus Roadmap-P2.C — heute Platzhalter.
  { key: "dependencies", label: "Dependencies" },
  { key: "impediments", label: "Impediments" },
  { key: "risks", label: "Risks" },
  { key: "demo", label: "Demo" },
  { key: "closure", label: "Closure" },
];

interface PlanTabData {
  artId: string;
  canEdit: boolean;
  view: "board" | "table";
  model: PlanningModel;
  currentCycleKey: string;
}

interface ObjectivesTabData {
  rows: ObjectiveRow[];
  teams: { id: string; name: string; artId: string }[];
  canVote: boolean;
  canCreate: boolean;
}

interface ExecutionTabData {
  features: ExecutionFeature[];
  canTransition: boolean;
}

interface DependenciesTabData {
  edges: PiDependencyEdge[];
}

interface ImpedimentsTabData {
  artId: string | null;
  rows: PiImpedimentRow[];
  canCreate: boolean;
  canEscalate: boolean;
  canResolve: boolean;
}

interface ClosureTabData {
  status: string;
  systemDemoAt: string | null;
  inspectAdaptAt: string | null;
  retrospectiveNotes: string | null;
  issues: string[];
  openImpediments: ClosureOpenImpediment[];
}

interface Props {
  model: PiWorkspaceModel;
  activeTab?: string;
  planTab: PlanTabData | null;
  objectivesTab: ObjectivesTabData;
  executionTab: ExecutionTabData;
  dependenciesTab: DependenciesTabData;
  impedimentsTab: ImpedimentsTabData;
  closureTab: ClosureTabData;
}

/**
 * PI-Workspace-Shell. Routet die neun Tabs; Overview/Plan/Execution/
 * Objectives sind aus P2.A/P2.B befuellt, die uebrigen vier sind
 * Platzhalter (P2.C/P4/P5).
 */
export function PiWorkspaceShell({
  model,
  activeTab,
  planTab,
  objectivesTab,
  executionTab,
  dependenciesTab,
  impedimentsTab,
  closureTab,
}: Props) {
  const active = resolveTab(PI_WORKSPACE_TABS, activeTab);

  return (
    <EntityDetailShell
      backHref="/umsetzung"
      backLabel="Zurueck zum Hub"
      title={model.name}
      tabs={PI_WORKSPACE_TABS}
      activeTab={active}
      basePath={`/umsetzung/pi/${model.id}`}
    >
      {active === "overview" && <PiOverviewTab model={model} />}

      {active === "plan" &&
        (planTab ? (
          <PiPlanTab
            piId={model.id}
            artId={planTab.artId}
            canEdit={planTab.canEdit}
            features={planTab.model.features}
            pis={planTab.model.pis}
            capacity={planTab.model.capacity}
            blockers={planTab.model.blockers}
            currentCycleKey={planTab.currentCycleKey}
            view={planTab.view}
          />
        ) : (
          <PlaceholderTab tab="plan" />
        ))}

      {active === "execution" && (
        <PiExecutionTab
          features={executionTab.features}
          canTransition={executionTab.canTransition}
        />
      )}

      {active === "objectives" && (
        <PiObjectivesTab
          piId={model.id}
          rows={objectivesTab.rows}
          teams={objectivesTab.teams}
          canVote={objectivesTab.canVote}
          canCreate={objectivesTab.canCreate}
        />
      )}

      {active === "dependencies" && <PiDependenciesTab edges={dependenciesTab.edges} />}

      {active === "impediments" && (
        <PiImpedimentsTab
          artId={impedimentsTab.artId}
          rows={impedimentsTab.rows}
          canCreate={impedimentsTab.canCreate}
          canEscalate={impedimentsTab.canEscalate}
          canResolve={impedimentsTab.canResolve}
        />
      )}

      {active === "closure" && (
        <PiClosureTab
          piId={model.id}
          piName={model.name}
          status={closureTab.status}
          systemDemoAt={closureTab.systemDemoAt}
          inspectAdaptAt={closureTab.inspectAdaptAt}
          retrospectiveNotes={closureTab.retrospectiveNotes}
          issues={closureTab.issues}
          openImpediments={closureTab.openImpediments}
        />
      )}

      {(active === "risks" || active === "demo") && <PlaceholderTab tab={active} />}
    </EntityDetailShell>
  );
}

const PLACEHOLDER: Record<string, { hint: string; href: string; linkLabel: string }> = {
  plan: {
    hint: "Dieser PI hat keinen ART zugeordnet — Plan-Tab nicht verfuegbar.",
    href: "/pi-planning",
    linkLabel: "Zum heutigen PI-Planning",
  },
  dependencies: {
    hint: "Dependencies-Tab (PI-scoped) folgt in Roadmap-P2.C.",
    href: "/dependencies",
    linkLabel: "Zur globalen Dependencies-Liste",
  },
  impediments: {
    hint: "Impediments-Tab (PI-scoped) folgt in Roadmap-P2.C.",
    href: "/impediments",
    linkLabel: "Zur globalen Impediments-Liste",
  },
  risks: {
    hint: "Risk-Register kommt mit Roadmap-P5.",
    href: "/impediments",
    linkLabel: "Heute Risks via Impediments",
  },
  demo: {
    hint: "System-Demo-Tab kommt mit Roadmap-P4.",
    href: "/rte",
    linkLabel: "Heute via RTE-Cockpit",
  },
  closure: {
    hint: "Closure-Tab uebernimmt in Roadmap-P2.C den bestehenden Closure-Wizard.",
    href: "/rte",
    linkLabel: "Zum RTE-Cockpit",
  },
};

function PlaceholderTab({ tab }: { tab: string }) {
  const info = PLACEHOLDER[tab];
  if (!info) return null;
  return (
    <section className="rounded-lg border bg-card p-6">
      <p className="text-sm text-muted-foreground">{info.hint}</p>
      <Link
        href={info.href as never}
        className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
      >
        {info.linkLabel} <ArrowRight className="size-3" />
      </Link>
    </section>
  );
}
