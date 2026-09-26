"use client";

import { useTranslations } from "next-intl";
import { useActionState, useEffect } from "react";
import { useRouter } from "@/i18n/navigation";
import {
  setTenantModulesAction,
  type ActionState,
} from "@/features/platform/actions/tenant-actions";
import { ModuleCheckboxes } from "./module-checkboxes";

/** Modul-Entitlement-Editor eines Tenants (Freemium-Achse). */
export function TenantModulesEditor({
  tenantId,
  enabledModules,
}: {
  tenantId: string;
  enabledModules: string[];
}) {
  const t = useTranslations();
  const router = useRouter();
  const [state, action, isPending] = useActionState<ActionState, FormData>(
    setTenantModulesAction,
    {},
  );

  useEffect(() => {
    if (state.success) router.refresh();
  }, [state, router]);

  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="tenantId" value={tenantId} />
      <ModuleCheckboxes selected={enabledModules} />
      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={isPending}
          className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
        >
          {isPending ? t("common.ui.speichernLaeuft") : t("platform.ui.moduleSpeichern")}
        </button>
        {state.error && <span className="text-sm text-destructive">{state.error}</span>}
        {state.success && (
          <span className="text-sm text-primary">{t("platform.ui.gespeichert")}</span>
        )}
      </div>
    </form>
  );
}
