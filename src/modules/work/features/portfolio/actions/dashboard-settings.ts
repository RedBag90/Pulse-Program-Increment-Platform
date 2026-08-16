"use server";

import { revalidatePath } from "next/cache";
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
      h1: z.number().min(0).max(100),
      h2: z.number().min(0).max(100),
      h3: z.number().min(0).max(100),
    }),
    capacity: z.object({
      business: z.number().min(0).max(100),
      enabler: z.number().min(0).max(100),
    }),
  })
  .refine(
    (t) => {
      const r = validateGuardrailTargets(t);
      return r.ok;
    },
    { message: "Targets müssen je Achse auf 100 summieren" },
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
    const hasGuardrailFields = fd.has("guardrail_h1");
    const guardrailTargets: GuardrailTargets | undefined = hasGuardrailFields
      ? {
          horizon: { h1: num("guardrail_h1"), h2: num("guardrail_h2"), h3: num("guardrail_h3") },
          capacity: {
            business: num("guardrail_business"),
            enabler: num("guardrail_enabler"),
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
    revalidatePath("/portfolio/dashboard", "page");
    revalidatePath("/pi-planning", "page");
  },
  mapError: (e) =>
    formatDomainError(e, { fallback: "Einstellungen konnten nicht gespeichert werden" }),
});
