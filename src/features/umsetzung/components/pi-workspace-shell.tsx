import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";
import { PiOverviewTab } from "@/features/umsetzung/components/pi-overview-tab";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import type { PiWorkspaceModel } from "@/server/views/pi-workspace";

const PI_WORKSPACE_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  // Tabs aus Roadmap-P2.B/P2.C — heute Platzhalter mit Sprung auf Bestands-Surfaces.
  { key: "plan", label: "Plan" },
  { key: "execution", label: "Execution" },
  { key: "objectives", label: "Objectives" },
  { key: "dependencies", label: "Dependencies" },
  { key: "impediments", label: "Impediments" },
  { key: "risks", label: "Risks" },
  { key: "demo", label: "Demo" },
  { key: "closure", label: "Closure" },
];

interface Props {
  model: PiWorkspaceModel;
  /** Aktiver Tab aus URL. */
  activeTab?: string;
}

/**
 * PI-Workspace-Shell. Routet die neun Tabs; in P2.A nur `overview` mit
 * Inhalt, die anderen sind Platzhalter mit Roadmap-Verweis und
 * Direkt-Link auf die bestehenden Surfaces.
 */
export function PiWorkspaceShell({ model, activeTab }: Props) {
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
      {active === "overview" ? <PiOverviewTab model={model} /> : <PlaceholderTab tab={active} />}
    </EntityDetailShell>
  );
}

const PLACEHOLDER: Record<string, { hint: string; href: string; linkLabel: string }> = {
  plan: {
    hint: "Plan-Tab zieht in Roadmap-P2.B den bestehenden PI-Planning-Board hierher.",
    href: "/pi-planning",
    linkLabel: "Zum heutigen PI-Planning",
  },
  execution: {
    hint: "Execution-Tab zeigt in Roadmap-P2.B ein Feature-Kanban gefiltert auf den PI.",
    href: "/implementation/features",
    linkLabel: "Zur Features-Uebersicht",
  },
  objectives: {
    hint: "Objectives-Tab inkl. Confidence-Vote zieht in Roadmap-P2.B hierher.",
    href: "/rte",
    linkLabel: "Zum RTE-Cockpit",
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
