"use client";

import { useActionState, useState, startTransition } from "react";
import {
  submitEpicHypothesisAction,
  decideEpicHypothesisAction,
  submitEpicBusinessCaseAction,
  decideEpicApprovalAction,
  signoffEpicSectionAction,
  startEpicRevisionAction,
} from "@/features/portfolio/actions/epic-approval";
import type { ApprovalSection } from "@/domain/epic-approval";

const PRIMARY =
  "rounded bg-blue-700 px-3 py-1.5 text-sm font-medium text-white hover:bg-blue-800 disabled:opacity-50";
const APPROVE =
  "rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-50";
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

/** draft → submit the Benefit Hypothesis for VMO review. */
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

/** hypothesis_review → VMO approves or returns the hypothesis. */
export function DecideHypothesisButtons({ epicId }: { epicId: string }) {
  const [state, action, pending] = useActionState(decideEpicHypothesisAction, {});
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className={APPROVE}
          onClick={() => dispatch(action, { epicId, decision: "approve" })}
        >
          Hypothese freigeben
        </button>
        <button
          type="button"
          disabled={pending}
          className={REJECT}
          onClick={() => dispatch(action, { epicId, decision: "reject" })}
        >
          Zurückgeben
        </button>
      </div>
      <Err msg={state.error} />
    </div>
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

/** stakeholder_review → the assigned approver decides their party row. */
export function ApprovalDecisionButtons({ approvalId }: { approvalId: string }) {
  const [state, action, pending] = useActionState(decideEpicApprovalAction, {});
  const [comment, setComment] = useState("");
  return (
    <div className="space-y-1.5">
      <input
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Kommentar (optional)"
        className="w-full rounded border border-gray-300 px-2 py-1 text-xs"
      />
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className={APPROVE}
          onClick={() => dispatch(action, { approvalId, decision: "approve", comment })}
        >
          Freigeben
        </button>
        <button
          type="button"
          disabled={pending}
          className={REJECT}
          onClick={() => dispatch(action, { approvalId, decision: "reject", comment })}
        >
          Ablehnen
        </button>
      </div>
      <Err msg={state.error} />
    </div>
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

/** stakeholder_review → reviewer signs off a section (Breakdown / KPIs). */
export function SectionSignoffButtons({
  epicId,
  section,
}: {
  epicId: string;
  section: ApprovalSection;
}) {
  const [state, action, pending] = useActionState(signoffEpicSectionAction, {});
  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        <button
          type="button"
          disabled={pending}
          className={APPROVE}
          onClick={() => dispatch(action, { epicId, section, decision: "approve" })}
        >
          Sign-off
        </button>
        <button
          type="button"
          disabled={pending}
          className={REJECT}
          onClick={() => dispatch(action, { epicId, section, decision: "reject" })}
        >
          Ablehnen
        </button>
      </div>
      <Err msg={state.error} />
    </div>
  );
}
