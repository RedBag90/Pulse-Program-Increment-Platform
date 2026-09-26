import { useTranslations } from "next-intl";
import {
  MODULE_KEYS,
  MODULES,
  MODULE_PREREQUISITES,
  CORE_SEGMENTS,
} from "@/modules/core/kernel/domain/modules";

/**
 * **Die erste der drei Schranken**, gezeichnet aus der Registry selbst: welche
 * Module es gibt, was jedes mitbringt und welches ein anderes voraussetzt.
 *
 * „Fuenf Module gibt es" ist genau der Satz, der in einem Erklaertext veraltet,
 * sobald ein sechstes dazukommt. Hier zaehlt ihn niemand ab — er entsteht aus
 * `MODULE_KEYS`.
 */
export function ModuleMap() {
  const t = useTranslations();
  return (
    <div className="space-y-3">
      <div className="divide-y overflow-hidden rounded-lg bg-card shadow-card">
        {MODULE_KEYS.map((k) => {
          const def = MODULES[k];
          const needs = MODULE_PREREQUISITES[k];
          return (
            <div
              key={k}
              className="grid gap-2 p-4 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start"
            >
              <div className="space-y-1">
                <p className="font-heading text-sm font-semibold text-foreground">
                  {def.label}{" "}
                  <span className="font-mono text-meta font-normal text-muted-foreground">{k}</span>
                </p>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {def.segments.map((s) => `/${s}`).join(" · ")}
                </p>
              </div>
              <p className="font-mono text-meta text-muted-foreground sm:text-right">
                {needs.length === 0 ? (
                  <span className="text-muted-foreground/60">{t("wiki.ui.ohneVoraussetzung")}</span>
                ) : (
                  <>{t("wiki.ui.modulBraucht", { modules: needs.join(", ") })}</>
                )}
              </p>
            </div>
          );
        })}
      </div>
      <p className="max-w-[var(--reading-max-w)] text-xs leading-relaxed text-muted-foreground">
        {t.rich("wiki.ui.ausserhalbJederSchrankeCoreSegmente", {
          segments: () =>
            CORE_SEGMENTS.map((s) => (
              <code key={s} className="mr-1 rounded-sm bg-muted px-1 py-0.5 font-mono text-xs">
                /{s}
              </code>
            )),
        })}
      </p>
    </div>
  );
}
