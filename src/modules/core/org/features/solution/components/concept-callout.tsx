"use client";

import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { Info, X } from "lucide-react";
import { CONCEPT_HELP_KEYS } from "@/modules/core/org/domain/horizon";

/**
 * Dismissbarer Erklär-Callout „Solution vs. Epic" (Helfer-Schicht). Der
 * Dismiss-State lebt in `localStorage` je `storageKey`, damit der Kasten nach
 * dem Schließen nicht wiederkommt.
 */
export function ConceptCallout({ storageKey }: { storageKey: string }) {
  const t = useTranslations();
  const key = `pulse.callout.${storageKey}`;
  const [dismissed, setDismissed] = useState(true);

  useEffect(() => {
    setDismissed(window.localStorage.getItem(key) === "1");
  }, [key]);

  if (dismissed) return null;

  return (
    <div className="flex gap-3 rounded-lg border-l-4 border-l-primary bg-card p-3 text-sm shadow-card">
      <Info className="mt-0.5 size-4 shrink-0 text-primary" />
      <p className="flex-1 text-muted-foreground">{t(CONCEPT_HELP_KEYS.solutionVsEpic)}</p>
      <button
        type="button"
        aria-label={t("org.ui.hinweisAusblenden")}
        onClick={() => {
          window.localStorage.setItem(key, "1");
          setDismissed(true);
        }}
        className="shrink-0 text-muted-foreground/60 hover:text-foreground"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
