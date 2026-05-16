"use client";

import { Button } from "@/components/ui/button";

export function ConnectJiraButton() {
  return (
    <Button
      onClick={() => {
        window.location.href = "/api/integrations/jira/connect";
      }}
    >
      Connect Jira
    </Button>
  );
}
