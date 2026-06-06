import { RteHero } from "@/features/rte/components/rte-hero";
import { RteTodayCards } from "@/features/rte/components/rte-today-cards";
import { RteTeamRagGrid } from "@/features/rte/components/rte-team-rag-grid";
import { RteEpicRollup } from "@/features/rte/components/rte-epic-rollup";
import type { RteCockpitModel } from "@/server/views/rte-cockpit";

interface Props {
  model: RteCockpitModel;
}

/**
 * Cockpit-Layout. Server-rendert; alle CTAs sind Links in die
 * bestehenden Listen / Drawer. Kein Mutations-State auf dieser Seite.
 */
export function RteCockpitShell({ model }: Props) {
  return (
    <main className="space-y-6 p-6 md:p-8">
      <RteHero hero={model.hero} />
      <RteTodayCards today={model.today} hero={model.hero} />
      <RteTeamRagGrid teams={model.teams} />
      <RteEpicRollup rows={model.epicRollup} />
    </main>
  );
}
