"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ConnectJiraButton() {
  const t = useTranslations();
  return (
    <Button
      onClick={() => {
        window.location.href = "/api/integrations/jira/connect";
      }}
    >
      {t("integrations.ui.connectJira")}
    </Button>
  );
}
