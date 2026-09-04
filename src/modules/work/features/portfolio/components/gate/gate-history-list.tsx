import { ArrowUp, Undo2 } from "lucide-react";
import { gateStepLabel } from "@/modules/work/domain/stage-gate";
import type { EpicGateHistoryView } from "@/modules/work/server/views/epic-detail";

/**
 * Die Antragshistorie eines Epics.
 *
 * Vorher war ein Gate-Vorschlag *unsichtbar*: nur der vollzogene Wechsel wurde
 * auditiert, ein Vorschlag nie. Wer beantragt, wer abgenommen und wer abgelehnt
 * hat, liess sich damit nicht beantworten. Jetzt ist jeder Antrag eine Zeile.
 */

const STATUS_LABEL: Record<string, string> = {
  pending: "offen",
  approved: "vollzogen",
  rejected: "abgelehnt",
  withdrawn: "zurückgezogen",
};

const STATUS_CLASS: Record<string, string> = {
  pending: "text-amber-700",
  approved: "text-emerald-700",
  rejected: "text-destructive",
  withdrawn: "text-muted-foreground",
};

// `fromGate`/`toGate` einer Antragszeile sind Schritte, keine Major-Gates.
const gateLabel = gateStepLabel;

/** ISO → de-DE, wie im Timeline-Tab. */
function day(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? "—" : d.toLocaleDateString("de-DE");
}

export function GateHistoryList({
  history,
  userLabels,
}: {
  history: EpicGateHistoryView[];
  userLabels: Record<string, string>;
}) {
  if (history.length === 0) {
    return <p className="text-xs text-muted-foreground">Noch kein Reifegrad-Wechsel beantragt.</p>;
  }

  return (
    <ul className="space-y-2">
      {history.map((h) => (
        <li key={h.id} className="flex items-start gap-2 text-xs">
          {h.kind === "revert" ? (
            <Undo2 className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          ) : (
            <ArrowUp className="mt-0.5 size-3.5 shrink-0 text-muted-foreground" />
          )}
          <span className="flex-1">
            <span className="font-medium">
              {gateLabel(h.fromGate)} → {gateLabel(h.toGate)}
            </span>
            <span className={`ml-1.5 ${STATUS_CLASS[h.status] ?? ""}`}>
              {STATUS_LABEL[h.status] ?? h.status}
            </span>
            <span className="text-muted-foreground">
              {" · "}
              {userLabels[h.requestedBy] ?? "Unbekannt"}
              {" · "}
              {day(h.requestedAt)}
            </span>
            {h.reason && <span className="block text-muted-foreground">„{h.reason}"</span>}
          </span>
        </li>
      ))}
    </ul>
  );
}
