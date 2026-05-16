"use client";

import { useTransition } from "react";
import { disconnectJiraAction } from "@/features/integrations/actions/jira";

export function DisconnectJiraButton() {
  const [isPending, startTransition] = useTransition();

  function handleClick() {
    if (!confirm("Disconnect Jira? Existing synced issues will not be deleted.")) return;
    startTransition(async () => {
      await disconnectJiraAction();
    });
  }

  return (
    <button
      onClick={handleClick}
      disabled={isPending}
      className="px-3 py-1.5 text-sm text-red-600 border border-red-300 rounded-md hover:bg-red-50 disabled:opacity-50"
    >
      {isPending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
