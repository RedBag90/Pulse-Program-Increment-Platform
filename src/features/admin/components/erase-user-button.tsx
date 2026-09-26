"use client";

import { useTranslations } from "next-intl";
import { useState, useTransition } from "react";
import { eraseUserAction } from "@/features/admin/actions/gdpr";
import { Button } from "@/components/ui/button";

/**
 * **Zugang entziehen, nicht das Konto loeschen.**
 *
 * Die Beschriftung sagt seit September 2026, was wirklich passiert: die
 * Datensaetze dieses Nutzers **in diesem Mandanten** fallen, seine Rollen dazu.
 * Das Auth-Konto bleibt — es gehoert der Plattform, und ein Mandanten-Admin
 * hatte darueber nie zu entscheiden (siehe `actions/gdpr.ts`). Wer es
 * endgueltig loeschen will, tut das in der Plattform-Verwaltung.
 */
export function EraseUserButton({ userId }: { userId: string }) {
  const t = useTranslations();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleClick() {
    if (
      !confirm(
        "Zugang in diesem Mandanten entziehen? Die Rollen und die Datensätze dieses " +
          "Nutzers hier werden gelöscht. Das Konto selbst bleibt bestehen — es gehört " +
          "der Plattform. Die Audit-Historie bleibt mit anonymem Verweis stehen.",
      )
    ) {
      return;
    }
    setError(null);
    startTransition(async () => {
      const result = await eraseUserAction(userId);
      if (result?.error) setError(result.error);
    });
  }

  return (
    <div className="space-y-1">
      {error && <p className="text-xs text-destructive">{error}</p>}
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        disabled={isPending}
        className="text-destructive border-destructive/30 hover:bg-destructive/10"
      >
        {isPending ? t("admin.ui.zugangWirdEntzogen") : t("admin.ui.zugangEntziehenDsgvo")}
      </Button>
    </div>
  );
}
