"use client";

import { useActionState, useState, startTransition } from "react";
import {
  submitEpicHypothesisAction,
  submitEpicBusinessCaseAction,
  reviseEpicBusinessCaseAction,
  startEpicRevisionAction,
} from "@/features/portfolio/actions/epic-approval";

/**
 * Owner-side and re-open controls for the Epic Freigaben tab. Reviewer decisions
 * (hypothesis decide, per-party approval, section sign-off) live in the
 * `/my-approvals` inbox — this module no longer renders those buttons.
 */

const PRIMARY =
  "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const REJECT =
  "rounded border border-red-300 px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50";
const OUTLINE =
  "rounded border border-input px-3 py-1.5 text-sm font-medium text-foreground hover:bg-muted disabled:opacity-50";

function makeForm(entries: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(entries)) fd.set(k, v);
  return fd;
}

/** Dispatches a useActionState action programmatically inside a transition
 *  (required by React 19 when not triggered via a form `action` prop). */
function dispatch(action: (fd: FormData) => void, entries: Record<string, string>) {
  startTransition(() => action(makeForm(entries)));
}

function Err({ msg }: { msg?: string | undefined }) {
  return msg ? (
    <p role="alert" className="text-xs text-red-600">
      {msg}
    </p>
  ) : null;
}

/** draft → submit the Benefit Hypothesis for Portfolio-Manager review. */
export function SubmitHypothesisButton({ epicId }: { epicId: string }) {
  const [state, action, pending] = useActionState(submitEpicHypothesisAction, {});
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="epicId" value={epicId} />
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "…" : "Hypothese zur QS einreichen"}
      </button>
      <Err msg={state.error} />
    </form>
  );
}

/** business_case → submit the Business Case to the configured stakeholders. */
export function SubmitBusinessCaseButton({ epicId }: { epicId: string }) {
  const [state, action, pending] = useActionState(submitEpicBusinessCaseAction, {});
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="epicId" value={epicId} />
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "…" : "Business Case zur Freigabe einreichen"}
      </button>
      <Err msg={state.error} />
    </form>
  );
}

/** stakeholder_review → Owner reworks: returns to business_case, BC editable again. */
export function ReviseBusinessCaseButton({ epicId }: { epicId: string }) {
  const [state, action, pending] = useActionState(reviseEpicBusinessCaseAction, {});
  return (
    <form action={action} className="space-y-1">
      <input type="hidden" name="epicId" value={epicId} />
      <button type="submit" disabled={pending} className={PRIMARY}>
        {pending ? "…" : "Business Case überarbeiten"}
      </button>
      <Err msg={state.error} />
    </form>
  );
}

/** approved → Epic Owner re-opens for a new revision (full cycle or BC-only). */
export function StartRevisionButtons({ epicId }: { epicId: string }) {
  const [state, action, pending] = useActionState(startEpicRevisionAction, {});
  return (
    <div className="space-y-1">
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={pending}
          className={PRIMARY}
          onClick={() => dispatch(action, { epicId, mode: "full" })}
        >
          Neue Revision (inkl. Hypothese)
        </button>
        <button
          type="button"
          disabled={pending}
          className={OUTLINE}
          onClick={() => dispatch(action, { epicId, mode: "business_case" })}
        >
          Neue Revision (nur Business Case)
        </button>
      </div>
      <Err msg={state.error} />
    </div>
  );
}

/**
 * Any started phase → the Epic Owner resets the in-progress workflow back to
 * draft and restarts it. Destructive (discards the running cycle's decisions),
 * so it asks for confirmation first. Reuses the revision machinery (mode "full").
 */
export function ResetApprovalButton({ epicId }: { epicId: string }) {
  const [state, action, pending] = useActionState(startEpicRevisionAction, {});
  const [confirming, setConfirming] = useState(false);

  if (!confirming) {
    return (
      <div className="space-y-1">
        <button type="button" className={OUTLINE} onClick={() => setConfirming(true)}>
          Genehmigungsprozess zurücksetzen & neu starten
        </button>
        <Err msg={state.error} />
      </div>
    );
  }

  return (
    <div className="space-y-2 rounded-md border border-amber-200 bg-amber-50 p-3">
      <p className="text-sm text-amber-800">
        Der Prozess startet neu im Entwurf; alle laufenden Freigaben dieses Zyklus gehen verloren
        (die Inhalte bleiben erhalten). Fortfahren?
      </p>
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className={REJECT}
          onClick={() => dispatch(action, { epicId, mode: "full" })}
        >
          {pending ? "…" : "Ja, zurücksetzen"}
        </button>
        <button
          type="button"
          disabled={pending}
          className={OUTLINE}
          onClick={() => setConfirming(false)}
        >
          Abbrechen
        </button>
      </div>
      <Err msg={state.error} />
    </div>
  );
}
