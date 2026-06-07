"use client";

import { Layers, Square } from "lucide-react";
import { Link } from "@/i18n/navigation";
import {
  STAGE_GATE_LABELS,
  STATUS_DOT,
  STATUS_LABELS,
  APPROVAL_PHASE_LABELS,
} from "@/components/detail/initiative-labels";
import type { Bucket, MyTaskListRow } from "@/server/views/my-tasks-list";

interface Props {
  row: MyTaskListRow;
  compact: boolean;
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
 * Eine Zeile der My-Tasks Inbox: bucket-Dot · level-Pill · Title +
 * Kontext-Chips · State-Pill · Updated. Im Compact-Modus fällt die
 * Kontext-Zeile weg.
 */
export function MyTaskListRowComponent({ row, compact }: Props) {
  return (
    <tr className="border-b align-middle last:border-b-0 hover:bg-muted/40">
      <td className="py-2 pl-3 pr-3">
        <div className="flex items-center gap-2">
          <span
            className={`inline-block size-2 shrink-0 rounded-full ${BUCKET_DOT[row.bucket]}`}
            title={BUCKET_LABEL[row.bucket]}
            aria-hidden
          />
          <LevelPill level={row.level} />
          <div className="min-w-0 flex-1">
            <Link
              href={row.href as never}
              className="block truncate text-sm font-medium text-primary hover:underline"
              title={row.title}
            >
              {row.title}
            </Link>
            {!compact && <ContextLine row={row} />}
          </div>
        </div>
      </td>

      <td className="py-2 pr-3">
        <StatePill row={row} />
      </td>

      <td className="py-2 pr-3 text-right text-xs tabular-nums text-muted-foreground">
        {formatUpdated(row.updatedAtMs)}
      </td>
    </tr>
  );
}

function LevelPill({ level }: { level: MyTaskListRow["level"] }) {
  const isEpic = level === "epic";
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium ${
        isEpic ? "bg-purple-100 text-purple-700" : "bg-sky-100 text-sky-700"
      }`}
      title={isEpic ? "Epic" : "Feature"}
    >
      {isEpic ? <Layers className="size-3" /> : <Square className="size-3" />}
      {isEpic ? "Epic" : "Feature"}
    </span>
  );
}

function ContextLine({ row }: { row: MyTaskListRow }) {
  const bits: string[] = [];
  if (row.context.valueStreamName) bits.push(row.context.valueStreamName);
  if (row.context.artName) bits.push(row.context.artName);
  if (row.context.parentEpicTitle) bits.push(row.context.parentEpicTitle);
  if (row.context.piName) bits.push(row.context.piName);
  if (bits.length === 0) return null;
  return <p className="mt-0.5 truncate text-[11px] text-muted-foreground">{bits.join(" · ")}</p>;
}

function StatePill({ row }: { row: MyTaskListRow }) {
  if (row.level === "epic") {
    const gate = row.state.stageGate;
    const phase = row.state.approvalPhase;
    return (
      <div className="flex flex-col items-start gap-0.5 text-[11px]">
        {gate && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {STAGE_GATE_LABELS[gate] ?? gate}
          </span>
        )}
        {phase && (
          <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
            {APPROVAL_PHASE_LABELS[phase] ?? phase}
          </span>
        )}
      </div>
    );
  }
  const status = row.state.status;
  if (!status) return <span className="text-xs text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 text-xs">
      <span className={`size-1.5 rounded-full ${STATUS_DOT[status] ?? "bg-muted-foreground/40"}`} />
      <span className="text-muted-foreground">{STATUS_LABELS[status] ?? status}</span>
    </span>
  );
}

function formatUpdated(ms: number): string {
  const diff = Date.now() - ms;
  if (diff < 60_000) return "gerade eben";
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h`;
  const days = Math.floor(hours / 24);
  if (days < 31) return `${days} d`;
  return new Date(ms).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "2-digit",
  });
}
