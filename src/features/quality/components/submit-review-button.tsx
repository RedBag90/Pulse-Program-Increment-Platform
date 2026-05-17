"use client";

import { useActionState } from "react";
import { submitEpicReviewAction } from "@/features/portfolio/actions/epic";
import { submitFeatureReviewAction } from "@/features/art/actions/feature";
import { Button } from "@/components/ui/button";

interface Props {
  id: string;
  kind: "epic" | "feature";
}

/** "Submit for QA review" — moves a draft Epic/Feature to `in_review`. */
export function SubmitReviewButton({ id, kind }: Props) {
  const action = kind === "epic" ? submitEpicReviewAction : submitFeatureReviewAction;
  const [state, formAction, isPending] = useActionState(action, {});

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
