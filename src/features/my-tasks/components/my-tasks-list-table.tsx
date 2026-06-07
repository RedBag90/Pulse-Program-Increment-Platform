"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { BUCKETS, type Bucket, type MyTaskListRow } from "@/server/views/my-tasks-list";
import { MyTaskListRowComponent } from "@/features/my-tasks/components/my-task-list-row";

interface Props {
  rows: MyTaskListRow[];
  group: "flat" | "bucket";
  compact: boolean;
}

const BUCKET_LABEL: Record<Bucket, string> = {
  open: "Offen",
  ready: "Bereit",
  done: "Erledigt",
};

/**
 * My-Tasks Tabelle. Im flat-Modus eine sortierte Liste, im
 * bucket-Modus drei collapsible-Sektionen (Offen · Bereit · Erledigt).
 */
export function MyTasksListTable({ rows, group, compact }: Props) {
  if (rows.length === 0) {
    return (
      <div className="rounded-2xl border bg-card p-8 text-center text-sm text-muted-foreground">
        Keine Tasks im aktuellen Filter.
      </div>
    );
  }
  if (group === "flat") {
    return (
      <div className="overflow-hidden rounded-2xl border bg-card">
        <table className="w-full text-sm">
          <Header />
          <tbody>
            {rows.map((r) => (
              <MyTaskListRowComponent key={r.id} row={r} compact={compact} />
            ))}
          </tbody>
        </table>
      </div>
    );
  }

  // Group=bucket — drei Sektionen, jede collapsible.
  const byBucket: Record<Bucket, MyTaskListRow[]> = { open: [], ready: [], done: [] };
  for (const r of rows) byBucket[r.bucket].push(r);
  return (
    <div className="space-y-3">
      {BUCKETS.map((b) =>
        byBucket[b].length === 0 ? null : (
          <BucketSection key={b} bucket={b} rows={byBucket[b]} compact={compact} />
        ),
      )}
    </div>
  );
}

function Header() {
  return (
    <thead>
      <tr className="border-b bg-muted/30 text-left text-xs uppercase tracking-wide text-muted-foreground">
        <th className="py-2 pl-3 pr-3">Task</th>
        <th className="py-2 pr-3">Status</th>
        <th className="py-2 pr-3 text-right">Aktualisiert</th>
      </tr>
    </thead>
  );
}

function BucketSection({
  bucket,
  rows,
  compact,
}: {
  bucket: Bucket;
  rows: MyTaskListRow[];
  compact: boolean;
}) {
  const [open, setOpen] = useState(bucket !== "done");
  return (
    <section className="overflow-hidden rounded-2xl border bg-card">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between border-b bg-muted/30 px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-muted-foreground hover:bg-muted/50"
      >
        <span className="inline-flex items-center gap-2">
          {open ? <ChevronDown className="size-3.5" /> : <ChevronRight className="size-3.5" />}
          {BUCKET_LABEL[bucket]}
        </span>
        <span className="tabular-nums">{rows.length}</span>
      </button>
      {open && (
        <table className="w-full text-sm">
          <tbody>
            {rows.map((r) => (
              <MyTaskListRowComponent key={r.id} row={r} compact={compact} />
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
