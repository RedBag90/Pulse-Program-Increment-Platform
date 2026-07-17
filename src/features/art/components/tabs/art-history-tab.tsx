import { AuditTimeline } from "@/components/detail/audit-timeline";

interface Props {
  events: { id: string; action: string; occurredAt: string }[];
}

export function ArtHistoryTab({ events }: Props) {
  return (
    <section className="space-y-4">
      <h2 className="text-xl font-semibold tracking-tight">History</h2>
      <AuditTimeline events={events} />
    </section>
  );
}
