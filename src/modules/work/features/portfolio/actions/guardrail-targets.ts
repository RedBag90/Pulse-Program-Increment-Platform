"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { saveValueStreamGuardrailTargets } from "@/modules/work/server/services/guardrail-targets";
import { formatDomainError } from "@/server/http/domain-error-display";

/**
 * Setzt die Guardrail-Ziele **eines Wertstroms**.
 *
 * Leere Felder heißen „nicht gesetzt" und lassen die Achse geerbt — sie schreiben
 * nicht etwa den geerbten Wert fest. Sonst friert ein Wertstrom den Tenant-Stand
 * in dem Moment ein, in dem er ihn nur ansieht.
 */
export const saveValueStreamGuardrailTargetsAction = createServerAction({
  schema: z.object({
    valueStreamId: z.string().uuid(),
    business: z.number().min(0).max(100).nullable(),
    enabler: z.number().min(0).max(100).nullable(),
    portfolioThreshold: z.number().min(0).nullable(),
  }),
  action: "target.manage",
  resource: (input, p) => ({ tenantId: p.tenantId, valueStreamId: input.valueStreamId }),
  parseFormData: (fd) => {
    const opt = (key: string): number | null => {
      const raw = String(fd.get(key) ?? "").trim();
      if (raw === "") return null;
      const n = Number(raw);
      return Number.isFinite(n) ? n : null;
    };
    return {
      valueStreamId: String(fd.get("valueStreamId") ?? ""),
      business: opt("business"),
      enabler: opt("enabler"),
      portfolioThreshold: opt("portfolioThreshold"),
    };
  },
  service: (ctx, input) =>
    saveValueStreamGuardrailTargets(ctx, {
      valueStreamId: input.valueStreamId,
      targets: {
        ...(input.business != null && input.enabler != null
          ? { capacity: { business: input.business, enabler: input.enabler } }
          : {}),
        ...(input.portfolioThreshold != null
          ? { approval: { portfolioThreshold: input.portfolioThreshold } }
          : {}),
      },
    }),
  onSuccess: () => {
    revalidatePath("/value-streams/[id]", "page");
    revalidatePath("/portfolio/guardrails", "page");
  },
  mapError: (e) =>
    formatDomainError(e, { fallback: "Guardrail-Ziele konnten nicht gespeichert werden" }),
});
