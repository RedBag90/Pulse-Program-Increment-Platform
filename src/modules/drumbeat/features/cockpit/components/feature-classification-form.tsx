"use client";

import { useTranslations } from "next-intl";
import { useActionState, startTransition } from "react";
import { updateFeatureAction } from "@/modules/work/features/feature/actions/feature";
import { FEATURE_TYPES, FEATURE_TYPE_KEYS } from "@/modules/work/domain/portfolio-guardrails";

interface Props {
  featureId: string;
  artId: string;
  featureType: string | null;
  canEdit: boolean;
}

/**
 * SAFe-Guardrails-Klassifikation (Roadmap-G2): Feature vs Enabler.
 * Auto-Submit per Select, leerer String = clearen.
 */
export function FeatureClassificationForm({ featureId, artId, featureType, canEdit }: Props) {
  const t = useTranslations();
  const [state, submit, busy] = useActionState(updateFeatureAction, {});

  function update(value: string) {
    const fd = new FormData();
    fd.set("id", featureId);
    fd.set("artId", artId);
    fd.set("featureType", value);
    startTransition(() => submit(fd));
  }

  if (!canEdit) {
    return (
      <div className="flex min-h-9 items-center rounded-lg border bg-muted/30 px-3 py-2 text-sm">
        {featureType
          ? t(FEATURE_TYPE_KEYS[featureType as keyof typeof FEATURE_TYPE_KEYS] ?? featureType)
          : "—"}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select
        aria-label={t("drumbeat.ui.featureTyp")}
        value={featureType ?? ""}
        disabled={busy}
        onChange={(e) => update(e.target.value)}
        className="w-full rounded-md border border-input bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50"
      >
        <option value="">{t("drumbeat.ui.ungesetzt")}</option>
        {FEATURE_TYPES.map((wert) => (
          <option key={wert} value={wert}>
            {t(FEATURE_TYPE_KEYS[wert] ?? wert)}
          </option>
        ))}
      </select>
      {state.error && (
        <p role="alert" className="text-sm text-destructive">
          {state.error}
        </p>
      )}
    </div>
  );
}
