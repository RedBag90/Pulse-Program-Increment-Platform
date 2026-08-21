"use client";

import { useActionState, startTransition } from "react";
import { updateFeatureAction } from "@/modules/work/features/feature/actions/feature";
import { FEATURE_TYPES, FEATURE_TYPE_LABEL } from "@/modules/work/domain/portfolio-guardrails";

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
          ? (FEATURE_TYPE_LABEL[featureType as keyof typeof FEATURE_TYPE_LABEL] ?? featureType)
          : "—"}
      </div>
    );
  }

  return (
    <div className="space-y-1">
      <select
        aria-label="Feature-Typ"
        value={featureType ?? ""}
        disabled={busy}
        onChange={(e) => update(e.target.value)}
        className="w-full rounded-lg border bg-card px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
      >
        <option value="">— ungesetzt</option>
        {FEATURE_TYPES.map((t) => (
          <option key={t} value={t}>
            {FEATURE_TYPE_LABEL[t]}
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
