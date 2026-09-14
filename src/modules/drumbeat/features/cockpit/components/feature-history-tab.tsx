import {
  InitiativeActivitySidebar,
  type ActivityItem,
} from "@/components/detail/initiative-activity-sidebar";

interface Props {
  events: ActivityItem[];
  userLabels: Record<string, string>;
}

/**
 * History-Tab des Feature-Details. Mountet die bestehende
 * `InitiativeActivitySidebar` in der Hauptspalte — derselbe
 * Audit-Trail wie auf Epic-Detail, gefiltert auf das Feature.
 */
export function FeatureHistoryTab({ events, userLabels }: Props) {
  return (
    <section className="rounded-lg bg-card shadow-card">
      <InitiativeActivitySidebar events={events} userLabels={userLabels} />
    </section>
  );
}
