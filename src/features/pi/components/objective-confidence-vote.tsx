"use client";

import { useState, useTransition } from "react";
import { setObjectiveConfidenceAction } from "@/features/pi/actions/pi-objective";

interface Props {
  objectiveId: string;
  artId: string;
  current: number | null;
  canVote: boolean;
}

/** SAFe fist-of-five confidence vote (1-5) for a PI objective. */
export function ObjectiveConfidenceVote({ objectiveId, artId, current, canVote }: Props) {
  const [value, setValue] = useState<number | null>(current);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function vote(n: number) {
    if (!canVote) return;
    const prev = value;
    setValue(n);
    setError(null);
    startTransition(async () => {
      const result = await setObjectiveConfidenceAction(objectiveId, n, artId);
      if (result.error) {
        setValue(prev);
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex items-center gap-1">
      <span className="text-[10px] uppercase tracking-wide text-muted-foreground/60 mr-1">
        Confidence
      </span>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={!canVote || isPending}
          onClick={() => vote(n)}
          aria-label={`Confidence ${n}`}
          className={`h-6 w-6 rounded text-xs font-medium transition-opacity ${
            value !== null && n <= value
              ? "bg-blue-600 text-white"
              : "bg-muted text-muted-foreground/60"
          } ${canVote ? "hover:opacity-80" : "cursor-default"} disabled:opacity-60`}
        >
          {n}
        </button>
      ))}
      {error && <span className="text-[10px] text-red-600 ml-1">{error}</span>}
    </div>
  );
}
