"use client";

import { useState, useTransition } from "react";
import { unlinkDependencyAction } from "@/features/dependencies/actions/dependency";

interface Props {
  fromId: string;
  toId: string;
  type: "blocks" | "depends_on" | "relates_to";
  artId: string;
}

/** Removes a dependency link from the feature detail page. */
export function UnlinkDependencyButton({ fromId, toId, type, artId }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await unlinkDependencyAction(fromId, toId, type, artId);
      if (result.error) setError(result.error);
    });
  }

  return (
    <span className="flex items-center gap-1">
      {error && <span className="text-[10px] text-destructive">{error}</span>}
      <button
        type="button"
        onClick={handleClick}
        disabled={isPending}
        className="text-xs text-muted-foreground hover:text-destructive disabled:opacity-50"
      >
        {isPending ? "…" : "Unlink"}
      </button>
    </span>
  );
}
