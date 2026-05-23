"use client";

import { useActionState } from "react";
import { decideFeatureReviewAction } from "@/features/art/actions/feature";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  /** Only Features use the QS gate; Epics use the multi-party approval workflow. */
  kind: "feature";
}

/**
 * QA reviewer controls for an `in_review` Feature — "Freigeben" approves it,
 * "Zurückgeben" sends it back to `draft`. Each decision is its own form with a
 * hidden `decision` field, so the value is always carried in the FormData.
 */
export function ReviewDecisionButtons({ id }: Props) {
  const [state, formAction, isPending] = useActionState(decideFeatureReviewAction, {});

  return (
    <div className="flex shrink-0 items-center gap-2">
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="approve" />
        <Button type="submit" size="sm" disabled={isPending}>
          Freigeben
        </Button>
      </form>
      <form action={formAction}>
        <input type="hidden" name="id" value={id} />
        <input type="hidden" name="decision" value="reject" />
        <Button type="submit" size="sm" variant="outline" disabled={isPending}>
          Zurückgeben
        </Button>
      </form>
    </div>
  );
}
