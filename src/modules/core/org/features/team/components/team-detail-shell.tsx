import type { ReactNode } from "react";
import {
  EntityDetailShell,
  resolveTab,
  type DetailTab,
} from "@/components/detail/entity-detail-shell";

export const TEAM_TABS: readonly DetailTab[] = [
  { key: "overview", label: "Overview" },
  { key: "settings", label: "Settings" },
  { key: "history", label: "History" },
];

export function resolveTeamTab(raw: string | undefined): string {
  return resolveTab(TEAM_TABS, raw);
}

interface Props {
  teamId: string;
  teamName: string;
  artId: string;
  artName: string;
  activeTab: string;
  headerActions?: ReactNode;
  children: ReactNode;
}

/**
 * Tab-Detail-Shell fuer Team — duenne Schicht ueber `EntityDetailShell`.
 * Parallel zur bestehenden Section-Sub-Nav-Variante (`/team/[teamId]/settings`
 * etc.). Wenn sich diese Form durchsetzt, wird die alte Variante in einem
 * Folge-PR durch Redirects ersetzt.
 */
export function TeamDetailShell({
  teamId,
  teamName,
  artId,
  artName,
  activeTab,
  headerActions,
  children,
}: Props) {
  return (
    <EntityDetailShell
      backHref={`/art/${artId}/teams`}
      backLabel={`${artName} — Teams`}
      title={teamName}
      tabs={TEAM_TABS}
      activeTab={activeTab}
      basePath={`/team/${teamId}/v2`}
      headerActions={headerActions}
    >
      {children}
    </EntityDetailShell>
  );
}
