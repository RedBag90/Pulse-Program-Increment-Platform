"use client";

import { BUCKETS, type Bucket } from "@/server/views/my-tasks-list";

interface Props {
  counts: Record<Bucket, number>;
  active: Bucket | null;
  onChange: (next: Bucket | null) => void;
}

const BUCKET_DOT: Record<Bucket, string> = {
  open: "bg-blue-500",
  ready: "bg-amber-500",
  done: "bg-emerald-500",
};
const BUCKET_LABEL: Record<Bucket, string> = {
  open: "Offen",
  ready: "Bereit",
  done: "Erledigt",
};

/**
 * Drei Funnel-Pills: Offen · Bereit · Erledigt. Klick auf den aktiven
 * Bucket deselektiert.
 */
export function MyTasksFunnelBar({ counts, active, onChange }: Props) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {BUCKETS.map((b) => (
        <button
          key={b}
          type="button"
          onClick={() => onChange(active === b ? null : b)}
          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition ${
            active === b
              ? "border-primary bg-primary text-primary-foreground"
              : "border-input bg-card hover:bg-muted"
          }`}
        >
          <span className={`size-2 rounded-full ${BUCKET_DOT[b]}`} />
          <span>{BUCKET_LABEL[b]}</span>
          <span
            className={`tabular-nums ${active === b ? "text-primary-foreground" : "text-muted-foreground"}`}
          >
            {counts[b]}
          </span>
        </button>
      ))}
    </div>
  );
}
