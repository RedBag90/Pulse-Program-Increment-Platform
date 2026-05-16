"use client";

import { useState } from "react";

interface AuditRow {
  id: string;
  occurredAt: string;
  actorId: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: unknown | null;
  traceId: string | null;
}

interface AuditLogTableProps {
  events: AuditRow[];
}

export function AuditLogTable({ events }: AuditLogTableProps) {
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (events.length === 0) {
    return <p className="text-muted-foreground text-sm">No audit events found.</p>;
  }

  return (
    <table className="w-full text-sm border-collapse">
      <thead>
        <tr className="border-b text-left text-muted-foreground">
          <th className="pb-2 pr-3 w-40">Time</th>
          <th className="pb-2 pr-3 w-64">Actor</th>
          <th className="pb-2 pr-3">Action</th>
          <th className="pb-2 pr-3">Resource</th>
          <th className="pb-2 w-20">Trace</th>
        </tr>
      </thead>
      <tbody>
        {events.map((event) => (
          <>
            <tr
              key={event.id}
              className="border-b hover:bg-muted/50 cursor-pointer"
              onClick={() => toggle(event.id)}
            >
              <td className="py-2 pr-3 text-muted-foreground whitespace-nowrap">
                {new Date(event.occurredAt).toLocaleString()}
              </td>
              <td className="py-2 pr-3 font-mono text-xs truncate max-w-xs">{event.actorId}</td>
              <td className="py-2 pr-3 font-medium">{event.action}</td>
              <td className="py-2 pr-3 text-muted-foreground text-xs">
                {event.resourceType} / {event.resourceId}
              </td>
              <td className="py-2">
                {event.traceId && (
                  <button
                    type="button"
                    className="text-xs text-primary hover:underline font-mono"
                    onClick={(e) => {
                      e.stopPropagation();
                      void navigator.clipboard.writeText(event.traceId!);
                    }}
                    title="Copy trace ID"
                  >
                    {event.traceId.slice(0, 8)}…
                  </button>
                )}
              </td>
            </tr>
            {expanded.has(event.id) && event.changes !== null && (
              <tr key={`${event.id}-detail`} className="border-b bg-muted/50">
                <td colSpan={5} className="py-3 px-4">
                  <pre className="text-xs overflow-x-auto text-foreground/80 whitespace-pre-wrap">
                    {JSON.stringify(event.changes, null, 2)}
                  </pre>
                </td>
              </tr>
            )}
          </>
        ))}
      </tbody>
    </table>
  );
}
