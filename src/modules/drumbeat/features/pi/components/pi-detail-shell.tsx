import type { ReactNode } from "react";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";

export const PI_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "dependencies", label: "Dependencies" },
];

export function resolvePiTab(raw: string | undefined): string {
  return resolveTab(PI_TABS, raw);
}

interface Props {
  piId: string;
  piName: string;
  timelineName: string;
  activeTab: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

/**
 * Tab-Detail-Shell fuer PI — parallel zur Section-Sub-Nav-Variante
 * (`/pi/[piId]` Root + `/pi/[piId]/dependencies`).
 */
export function PiDetailShell({
  piId,
  piName,
  timelineName,
  activeTab,
  headerActions,
  children,
}: Props) {
  return (
    <EntityDetailShell
      backHref="/structure?tab=timeline"
      backLabel={`Timeline — ${timelineName}`}
      title={piName}
      tabs={PI_TABS}
      activeTab={activeTab}
      basePath={`/pi/${piId}/v2`}
      headerActions={headerActions}
    >
      {children}
    </EntityDetailShell>
  );
}
