"use client";

import { useActionState, useTransition, startTransition, useState } from "react";
import { AlertTriangle, ArrowUp, CheckCircle2, ShieldCheck } from "lucide-react";
import {
  escalateImpedimentAction,
  resolveImpedimentAction,
  setImpedimentRoamAction,
} from "@/features/impediment/actions/impediment";
import { CreateImpedimentDialog } from "@/features/impediment/components/create-impediment-dialog";

export interface PiImpedimentRow {
  id: string;
  artId: string;
  title: string;
  description: string | null;
  status: "open" | "escalated" | "resolved";
  severity: "low" | "medium" | "high" | "critical";
  roamStatus: "open" | "resolved" | "owned" | "accepted" | "mitigated";
  raisedByLabel: string | null;
  createdAtIso: string;
}

interface Props {
  artId: string | null;
  rows: PiImpedimentRow[];
  canCreate: boolean;
  canEscalate: boolean;
  canResolve: boolean;
}

const SEVERITY_CLASS: Record<PiImpedimentRow["severity"], string> = {
  low: "bg-muted text-muted-foreground",
  medium: "bg-amber-100 text-amber-700",
  high: "bg-orange-100 text-orange-700",
  critical: "bg-red-100 text-red-700",
};
const STATUS_CLASS: Record<PiImpedimentRow["status"], string> = {
  open: "bg-blue-100 text-blue-700",
  escalated: "bg-red-100 text-red-700",
  resolved: "bg-emerald-100 text-emerald-700",
};
const STATUS_LABEL: Record<PiImpedimentRow["status"], string> = {
  open: "Offen",
  escalated: "Eskaliert",
  resolved: "Aufgeloest",
};
const ROAM_LABEL: Record<PiImpedimentRow["roamStatus"], string> = {
  open: "Open",
  resolved: "Resolved",
  owned: "Owned",
  accepted: "Accepted",
  mitigated: "Mitigated",
};
const ROAM_OPTIONS: PiImpedimentRow["roamStatus"][] = [
  "open",
  "resolved",
  "owned",
  "accepted",
  "mitigated",
];

/**
 * Impediments-Tab im PI-Workspace. Listet Impediments mit Filter auf
 * den aktuellen PI. Inline-Actions: Escalate, ROAM-Status setzen,
 * Aufloesen. Gated auf `impediment.escalate` / `impediment.resolve`.
 */
export function PiImpedimentsTab({ artId, rows, canCreate, canEscalate, canResolve }: Props) {
  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-medium">Impediments</h2>
          <p className="text-sm text-muted-foreground">
            Auf diesen PI gefiltert. Closure-relevant: ROAM-Status muss vor PI-Abschluss von „Open"
            auf einen der vier Endzustaende gesetzt sein.
          </p>
        </div>
        {canCreate && artId && <CreateImpedimentDialog artId={artId} />}
      </header>

      {rows.length === 0 ? (
        <p className="rounded-md border border-dashed bg-card px-4 py-3 text-sm text-muted-foreground">
          Keine Impediments fuer diesen PI.
        </p>
      ) : (
        <ul className="space-y-2">
          {rows.map((row) => (
            <ImpedimentRow
              key={row.id}
              row={row}
              canEscalate={canEscalate}
              canResolve={canResolve}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function ImpedimentRow({
  row,
  canEscalate,
  canResolve,
}: {
  row: PiImpedimentRow;
  canEscalate: boolean;
  canResolve: boolean;
}) {
  return (
    <li className="rounded-md border bg-card p-3">
      <div className="flex flex-wrap items-start gap-2">
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${SEVERITY_CLASS[row.severity]}`}>
          {row.severity}
        </span>
        <span className={`rounded-full px-2 py-0.5 text-[11px] ${STATUS_CLASS[row.status]}`}>
          {STATUS_LABEL[row.status]}
        </span>
        <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[11px] text-indigo-700">
          ROAM: {ROAM_LABEL[row.roamStatus]}
        </span>
        <span className="text-xs text-muted-foreground">
          {new Date(row.createdAtIso).toLocaleDateString("de-DE")}
          {row.raisedByLabel && <> · {row.raisedByLabel}</>}
        </span>
      </div>
      <p className="mt-2 text-sm font-medium">{row.title}</p>
      {row.description && <p className="mt-1 text-sm text-muted-foreground">{row.description}</p>}
      <div className="mt-3 flex flex-wrap items-center gap-1.5">
        {row.status === "open" && canEscalate && <EscalateBtn id={row.id} artId={row.artId} />}
        {row.status !== "resolved" && canResolve && (
          <RoamPicker id={row.id} artId={row.artId} current={row.roamStatus} />
        )}
        {row.status !== "resolved" && canResolve && <ResolveBtn id={row.id} artId={row.artId} />}
      </div>
    </li>
  );
}

function EscalateBtn({ id, artId }: { id: string; artId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function fire() {
    start(async () => {
      setError(null);
      const res = await escalateImpedimentAction(id, artId);
      if (res.error) setError(res.error);
    });
  }
  return (
    <button
      type="button"
      onClick={fire}
      disabled={pending}
      title={error ?? undefined}
      className="inline-flex items-center gap-1 rounded border bg-card px-2 py-0.5 text-[11px] font-medium hover:bg-muted/50 disabled:opacity-50"
    >
      <ArrowUp className="size-3" /> Eskalieren
    </button>
  );
}

function ResolveBtn({ id, artId }: { id: string; artId: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string | null>(null);
  function fire() {
    const resolution = window.prompt("Resolution-Notiz (optional):", "") ?? "";
    start(async () => {
      setError(null);
      const res = await resolveImpedimentAction(id, artId, resolution);
      if (res.error) setError(res.error);
    });
  }
  return (
    <button
      type="button"
      onClick={fire}
      disabled={pending}
      title={error ?? undefined}
      className="inline-flex items-center gap-1 rounded border bg-card px-2 py-0.5 text-[11px] font-medium hover:bg-muted/50 disabled:opacity-50"
    >
      <CheckCircle2 className="size-3" /> Aufloesen
    </button>
  );
}

function RoamPicker({
  id,
  artId,
  current,
}: {
  id: string;
  artId: string;
  current: PiImpedimentRow["roamStatus"];
}) {
  const [, dispatch, pending] = useActionState(setImpedimentRoamAction, {});
  function set(roamStatus: PiImpedimentRow["roamStatus"]) {
    const fd = new FormData();
    fd.set("id", id);
    fd.set("artId", artId);
    fd.set("roamStatus", roamStatus);
    startTransition(() => dispatch(fd));
  }
  return (
    <div className="inline-flex items-center gap-1 rounded border bg-card px-1 py-0.5 text-[11px]">
      <ShieldCheck className="size-3 text-muted-foreground" />
      <span className="text-muted-foreground">ROAM</span>
      {ROAM_OPTIONS.filter((r) => r !== "open").map((r) => (
        <button
          key={r}
          type="button"
          disabled={pending || r === current}
          onClick={() => set(r)}
          className={`rounded px-1 ${
            r === current ? "bg-primary text-primary-foreground" : "hover:bg-muted/50"
          } disabled:cursor-not-allowed`}
          title={ROAM_LABEL[r]}
        >
          {ROAM_LABEL[r][0]}
        </button>
      ))}
      {current === "open" && (
        <span className="inline-flex items-center gap-1 text-[10px] text-red-700">
          <AlertTriangle className="size-3" /> setzen!
        </span>
      )}
    </div>
  );
}
