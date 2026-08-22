"use client";

import { useActionState } from "react";
import { setEpicSubmissionAction } from "@/modules/work/features/portfolio/actions/epic";

interface Submission {
  mandatory: boolean;
  costToMvp: number | null;
  riskRating: string | null;
  problemStatement: string | null;
  mvpCut: string | null;
  ifNotFunded: string | null;
  ready: boolean;
}

interface Props {
  epicId: string;
  submission: Submission;
  canEdit: boolean;
}

const RISK_OPTIONS = [
  { value: "", label: "—" },
  { value: "hoch", label: "hoch" },
  { value: "mittel", label: "mittel" },
  { value: "gering", label: "gering" },
];

const field =
  "w-full rounded border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500";

/**
 * PB-Einreichung im Einheitsformat (Problem / MVP-Schnitt / Kosten bis MVP /
 * Risiko / „wenn nicht finanziert") + Pflichtvorhaben-Flag. Ein Badge zeigt, ob
 * die Einreichung vollständig ist — erst dann lässt sich das Epic vormerken.
 */
export function EpicSubmissionForm({ epicId, submission, canEdit }: Props) {
  const [state, action, isPending] = useActionState(setEpicSubmissionAction, {});

  const badge = submission.ready ? (
    <span className="rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300">
      einreichungsbereit
    </span>
  ) : (
    <span className="rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 dark:bg-amber-950 dark:text-amber-300">
      unvollständig
    </span>
  );

  if (!canEdit) {
    return (
      <div className="space-y-2 rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        <div className="flex items-center gap-2">
          <span className="font-medium">Einreichung</span>
          {badge}
          {submission.mandatory && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
              Pflichtvorhaben
            </span>
          )}
        </div>
        <dl className="grid gap-1 text-xs text-muted-foreground">
          <ReadRow label="Problem" value={submission.problemStatement} />
          <ReadRow label="MVP-Schnitt" value={submission.mvpCut} />
          <ReadRow
            label="Kosten bis MVP"
            value={submission.costToMvp != null ? `${submission.costToMvp.toLocaleString("de-DE")} €` : null}
          />
          <ReadRow label="Risiko" value={submission.riskRating} />
          <ReadRow label="Wenn nicht finanziert" value={submission.ifNotFunded} />
        </dl>
      </div>
    );
  }

  return (
    <form action={action} className="space-y-3 rounded-lg border bg-muted/30 px-3 py-3">
      <input type="hidden" name="id" value={epicId} />

      <div className="flex items-center gap-2">
        <span className="text-sm font-medium">Einreichung</span>
        {badge}
      </div>

      <Labeled label="Problem (max. 3 Sätze)">
        <textarea name="problemStatement" rows={2} defaultValue={submission.problemStatement ?? ""} className={field} />
      </Labeled>

      <Labeled label="MVP-Schnitt (was ist am Ende nutzbar?)">
        <textarea name="mvpCut" rows={2} defaultValue={submission.mvpCut ?? ""} className={field} />
      </Labeled>

      <div className="grid grid-cols-2 gap-3">
        <Labeled label="Kosten bis MVP (€)">
          <input
            name="costToMvp"
            type="number"
            min={0}
            step={1000}
            defaultValue={submission.costToMvp ?? ""}
            className={field}
          />
        </Labeled>
        <Labeled label="Risiko">
          <select name="riskRating" defaultValue={submission.riskRating ?? ""} className={field}>
            {RISK_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </Labeled>
      </div>

      <Labeled label="Wenn nicht finanziert — was passiert dann?">
        <textarea name="ifNotFunded" rows={2} defaultValue={submission.ifNotFunded ?? ""} className={field} />
      </Labeled>

      <label className="flex items-center gap-2 text-sm">
        <input type="checkbox" name="mandatory" defaultChecked={submission.mandatory} className="size-3.5 accent-primary" />
        Pflichtvorhaben (regulatorisch/vertraglich — vom Topf abgezogen, nicht auf dem Ballot)
      </label>

      {state.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      {state.success && (
        <p role="status" className="text-sm text-emerald-700">
          Gespeichert.
        </p>
      )}

      <button
        type="submit"
        disabled={isPending}
        className="rounded bg-blue-700 px-4 py-2 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50"
      >
        {isPending ? "Speichern…" : "Einreichung speichern"}
      </button>
    </form>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function ReadRow({ label, value }: { label: string; value: string | null }) {
  return (
    <div className="flex gap-2">
      <dt className="min-w-[9rem] shrink-0 font-medium text-foreground/70">{label}</dt>
      <dd>{value && value.trim() !== "" ? value : <span className="italic">fehlt</span>}</dd>
    </div>
  );
}
