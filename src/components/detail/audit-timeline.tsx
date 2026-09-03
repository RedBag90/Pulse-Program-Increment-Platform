/** A single audit entry, pre-serialised on the server for the client boundary. */
export interface AuditTimelineItem {
  id: string;
  action: string;
  /** ISO timestamp. */
  occurredAt: string;
}

const ACTION_LABELS: Record<string, string> = {
  "value_stream.created": "Value Stream erstellt",
  "value_stream.updated": "Value Stream aktualisiert",
  "value_stream.guardrails.updated": "Guardrail-Ziele geändert",
  "art.epic_allocation.set": "ART-Rahmen verteilt",
  "value_stream.deleted": "Value Stream gelöscht",
  "art.created": "ART erstellt",
  "art.updated": "ART aktualisiert",
  "art.deleted": "ART gelöscht",
  "team.created": "Team erstellt",
  "team.updated": "Team aktualisiert",
  "team.deleted": "Team gelöscht",
  "solution.created": "Solution erstellt",
  "solution.updated": "Solution aktualisiert",
  "solution.deleted": "Solution gelöscht",
  "solution.promoted": "Nach H1 befördert",
  "solution.lifecycle.changed": "Lifecycle geändert",
  "solution.investment_mode.changed": "Investitionsmodus geändert",
  // Historisch — die Run-Baseline gibt es nicht mehr, alte Zeilen schon.
  "solution.run.updated": "Run-Baseline geändert",
};

function actionLabel(action: string): string {
  return ACTION_LABELS[action] ?? action.replace(/[._]/g, " ");
}

/**
 * Read-only audit trail for a Capacity-Planning entity, newest first — backs
 * the Verlauf tab of the Value Stream / ART / Team detail pages.
 */
export function AuditTimeline({ events }: { events: AuditTimelineItem[] }) {
  if (events.length === 0) {
    return <p className="text-sm text-muted-foreground">Keine Historie.</p>;
  }
  return (
    <ul className="divide-y rounded border">
      {events.map((e) => (
        <li key={e.id} className="flex items-center gap-3 px-3 py-2 text-sm">
          <span className="font-medium">{actionLabel(e.action)}</span>
          <span className="ml-auto text-xs text-muted-foreground">
            {new Date(e.occurredAt).toLocaleString("de-DE")}
          </span>
        </li>
      ))}
    </ul>
  );
}
