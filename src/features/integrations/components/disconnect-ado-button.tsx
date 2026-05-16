"use client";

import { useTransition } from "react";
import { disconnectAdoAction } from "@/features/integrations/actions/azure-devops";
import { Button } from "@/components/ui/button";

export function DisconnectAdoButton() {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={pending}
      onClick={() => {
        if (!confirm("Disconnect Azure DevOps? This will stop all syncing.")) return;
        startTransition(() => {
          void disconnectAdoAction();
        });
      }}
      className="text-destructive border-destructive/30 hover:bg-destructive/10"
    >
      {pending ? "Disconnecting…" : "Disconnect"}
    </Button>
  );
}
