import type { ReactNode } from "react";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";

export const ART_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "pi", label: "Program Increments" },
  { key: "settings", label: "Settings" },
  { key: "history", label: "History" },
];

export function resolveArtTab(raw: string | undefined): string {
  return resolveTab(ART_TABS, raw);
}

interface Props {
  artId: string;
  artName: string;
  valueStreamName: string;
  activeTab: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

/**
 * Tab-Detail-Shell fuer ART — parallel zur Section-Sub-Nav-Variante
 * (`/art/[artId]` + Sub-Routes teams, pi, impediments, settings, history).
 */
export function ArtDetailShell({
  artId,
  artName,
  valueStreamName,
  activeTab,
  headerActions,
  children,
}: Props) {
  return (
    <EntityDetailShell
      backHref="/structure?tab=arts"
      backLabel={`Value Stream — ${valueStreamName}`}
      title={artName}
      tabs={ART_TABS}
      activeTab={activeTab}
      basePath={`/art/${artId}/v2`}
      headerActions={headerActions}
    >
      {children}
    </EntityDetailShell>
  );
}
