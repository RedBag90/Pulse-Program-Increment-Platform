"use client";

import { useTransition } from "react";
import { disconnectJiraAction } from "@/features/integrations/actions/jira";
import { Button } from "@/components/ui/button";

export function DisconnectJiraButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Disconnect Jira? Existing synced issues will not be deleted.")) return;
    startTransition(async () => {
      await disconnectJiraAction();
    });
  }

  return (
    <Button
      onClick={handleClick}
      disabled={isPending}
      variant="outline"
      size="sm"
      className="text-destructive border-destructive/30 hover:bg-destructive/10"
    >
      {isPending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}
