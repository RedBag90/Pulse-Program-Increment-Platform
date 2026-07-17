import { AuditTimeline } from "@/components/detail/audit-timeline";

interface Props {
  events: { id: string; action: string; occurredAt: string }[];
}

/**
 * History-Tab — gleicher Inhalt wie `/team/[teamId]/history/page.tsx`.
 * Geteilt zwischen alter Sub-Route-Page und neuer Tab-Detail-Page.
 */
export function TeamHistoryTab({ events }: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">History</h2>
      <AuditTimeline events={events} />
    </section>
  );
}
