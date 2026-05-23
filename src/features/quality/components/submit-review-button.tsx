"use client";

import { useActionState } from "react";
import { submitFeatureReviewAction } from "@/features/art/actions/feature";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  /** Only Features use the QS gate; Epics use the multi-party approval workflow. */
  kind: "feature";
}

/** "Submit for QA review" — moves a draft Feature to `in_review`. */
export function SubmitReviewButton({ id }: Props) {
  const [state, formAction, isPending] = useActionState(submitFeatureReviewAction, {});

  return (
    <form action={formAction} className="flex items-center gap-2">
      <input type="hidden" name="id" value={id} />
      {state.error && <span className="text-xs text-destructive">{state.error}</span>}
      <Button type="submit" size="sm" disabled={isPending}>
        {isPending ? "Wird eingereicht…" : "Zur QS einreichen"}
      </Button>
    </form>
  );
}
