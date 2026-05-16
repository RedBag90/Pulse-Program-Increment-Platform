"use client";

import { useTransition } from "react";
import { disconnectAdoAction } from "@/features/integrations/actions/azure-devops";

export function DisconnectAdoButton() {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => {
        if (!confirm("Disconnect Azure DevOps? This will stop all syncing.")) return;
        startTransition(() => {
          void disconnectAdoAction();
        });
      }}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-50 transition-colors"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </button>
  );
}
