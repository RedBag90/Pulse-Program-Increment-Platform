"use client";

import { useTransition, useState } from "react";
import { PlayCircle, CheckCircle } from "lucide-react";
import { toast } from "sonner";
import { transitionPiAction } from "@/features/pi/actions/pi";
import { Button } from "@/components/ui/button";

interface Props {
  piId: string;
  currentStatus: string;
}

export function PiTransitionButton({ piId, currentStatus }: Props) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  if (currentStatus === "completed") return null;

  const nextStatus = currentStatus === "planned" ? "active" : "completed";
  const label = nextStatus === "active" ? "Start PI" : "Complete PI";
  const Icon = nextStatus === "active" ? PlayCircle : CheckCircle;

  function handleClick() {
    setError(null);
    startTransition(async () => {
      const result = await transitionPiAction(piId, nextStatus);
      if (result.error) setError(result.error);
      else toast.success(`PI ${nextStatus === "active" ? "started" : "completed"}`);
    });
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <Button onClick={handleClick} disabled={isPending} size="sm">
        <Icon className="size-4 mr-1.5" />
        {isPending ? "Saving…" : label}
      </Button>
      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  );
}
