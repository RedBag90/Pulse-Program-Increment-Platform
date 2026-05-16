"use client";

import { useTransition, useState } from "react";
import { transitionPiAction } from "@/features/pi/actions/pi";

interface Props {
  piId: string;
  artId: string;
  currentStatus: string;
}

export function PiTransitionButton({ piId, artId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (currentStatus === "completed") return null;

  const nextStatus = currentStatus === "planned" ? "active" : "completed";
  const label = nextStatus === "active" ? "Start PI" : "Complete PI";
  const btnClass =
    nextStatus === "active" ? "bg-green-600 hover:bg-green-700" : "bg-blue-600 hover:bg-blue-700";

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await transitionPiAction(piId, artId, nextStatus);
      if (result.error) setError(result.error);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        onClick={handleClick}
        disabled={isPending}
        className={`rounded-md px-4 py-1.5 text-sm font-medium text-white ${btnClass} disabled:opacity-50`}
      >
        {isPending ? "Saving…" : label}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
