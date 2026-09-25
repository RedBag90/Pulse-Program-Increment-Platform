"use server";

import { revalidateRoute } from "@/server/http/revalidation";
import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { savePortfolioDashboardSettings } from "@/modules/work/server/services/portfolio-dashboard";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  validateGuardrailTargets,
  type GuardrailTargets,
} from "@/modules/work/domain/portfolio-guardrails";

/**
 * Saves the configurable Portfolio Dashboard settings — two tenant-wide
 * economic constants:
 *  • `costNeutralTarget` — self-funding threshold per month (€).
 *  • `costPerJobSizePoint` — €/WSJF-Job-Size point, drives the PI-Planning
 *    capacity overlay's €-axis. Leaving it empty hides that axis.
 */
const guardrailTargetsSchema = z
  .object({
    horizon: z.object({
      h0: z.number().min(0).max(100),
      // H1 zerfaellt in Investing und Extracting — dieselbe Fuenferleiter wie
      // im Lebenszyklus und in der Zeichnung.
      "h1.1": z.number().min(0).max(100),
      "h1.2": z.number().min(0).max(100),
      h2: z.number().min(0).max(100),
      h3: z.number().min(0).max(100),
    }),
    capacity: z.object({
      business: z.number().min(0).max(100),
      enabler: z.number().min(0).max(100),
      maintenance: z.number().min(0).max(100),
    }),
    // Guardrail 3: eine Schwelle in Euro, kein Mix.
    approval: z.object({
      portfolioThreshold: z.number().min(0),
    }),
    // Kein Mix — deshalb kein Summen-Refinement, nur Wertebereiche.
    engagement: z.object({
      coverage: z.number().min(0).max(100),
      responseDays: z.number().int().min(1),
    }),
    // Anzeige, kein Soll-Wert — vom Summen-Refinement unten darum unberührt.
    display: z.object({
      horizonOnOverview: z.boolean(),
    }),
  })
  .refine(
    (t) => {
      const r = validateGuardrailTargets(t);
      return r.ok;
    },
    { message: "Die zwei Mix-Achsen müssen je auf 100 summieren" },
  );

export const savePortfolioDashboardSettingsAction = createServerAction({
  schema: z.object({
    costNeutralTarget: z.number().nonnegative().nullable().optional(),
    costPerJobSizePoint: z.number().nonnegative().nullable().optional(),
    guardrailTargets: guardrailTargetsSchema.optional(),
  }),
  action: "target.manage",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const num = (key: string) => Number(String(fd.get(key) ?? "").trim());
    // Partial update: only the fields a given form actually submits are sent on
    // to the service. The cost-settings editor submits `costNeutralTarget`; the
    // guardrail-targets editor submits `guardrail_*`. Each save owns its own
    // fields — the other side stays `undefined` (untouched by the service).
    const numberOrNull = (key: string): number | null => {
      const raw = String(fd.get(key) ?? "").trim();
      return raw === "" ? null : Number(raw);
    };
    const costFields = fd.has("costNeutralTarget")
      ? {
          costNeutralTarget: numberOrNull("costNeutralTarget"),
          costPerJobSizePoint: numberOrNull("costPerJobSizePoint"),
        }
      : {};
    const hasGuardrailFields = fd.has("guardrail_h1_1");
    const guardrailTargets: GuardrailTargets | undefined = hasGuardrailFields
      ? {
          horizon: {
            h0: num("guardrail_h0"),
            "h1.1": num("guardrail_h1_1"),
            "h1.2": num("guardrail_h1_2"),
            h2: num("guardrail_h2"),
            h3: num("guardrail_h3"),
          },
          capacity: {
            business: num("guardrail_business"),
            enabler: num("guardrail_enabler"),
            maintenance: num("guardrail_maintenance"),
          },
          approval: {
            // Guardrail 3 wird auf dieser Fläche (noch) nicht gepflegt — der
            // Bestandswert bleibt stehen, statt beim Speichern der übrigen
            // Guardrails still auf den Default zu fallen.
            portfolioThreshold: num("guardrail_portfolio_threshold"),
          },
          engagement: {
            coverage: num("guardrail_coverage"),
            responseDays: num("guardrail_response_days"),
          },
          display: {
            // **Eine abgehakte Checkbox sendet gar nichts.** Ohne das
            // vorangestellte Hidden-Feld („0") liesse der Schalter sich
            // einschalten, aber nie wieder aus — `fd.get` faende dann
            // schlicht nichts und der Leser fiele auf den Default „an".
            horizonOnOverview: fd.getAll("guardrail_horizon_on_overview").includes("1"),
          },
        }
      : undefined;
    return {
      ...costFields,
      ...(guardrailTargets !== undefined && { guardrailTargets }),
    };
  },
  service: (ctx, input) => savePortfolioDashboardSettings(ctx, input),
  onSuccess: () => {
    revalidateRoute("/portfolio/dashboard");
    revalidateRoute("/portfolio/guardrails");
    revalidateRoute("/pi-planning");
  },
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.saveSettings" }, t),
});
