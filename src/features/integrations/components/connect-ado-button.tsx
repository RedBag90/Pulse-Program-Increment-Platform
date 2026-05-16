"use client";

import { Button } from "@/components/ui/button";

export function ConnectAdoButton() {
  return (
    <Button
      type="button"
      onClick={() => {
        window.location.href = "/api/integrations/azure-devops/connect";
      }}
    >
      Connect Azure DevOps
    </Button>
  );
}
