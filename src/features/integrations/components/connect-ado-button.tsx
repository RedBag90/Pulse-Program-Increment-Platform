"use client";

import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export function ConnectAdoButton() {
  const t = useTranslations();
  return (
    <Button
      type="button"
      onClick={() => {
        window.location.href = "/api/integrations/azure-devops/connect";
      }}
    >
      {t("integrations.ui.connectAzureDevops")}
    </Button>
  );
}
