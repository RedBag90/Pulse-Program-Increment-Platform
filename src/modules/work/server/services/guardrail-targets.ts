/**
 * Guardrail-Ziele **je Wertstrom** — lesen und schreiben.
 *
 * Der Tenant-Default bleibt in `Tenant.guardrailTargets`; diese Tabelle trägt
 * ausschließlich Wertstrom-Zeilen, damit der Default nicht zwei Wohnorte hat.
 * Die Auflösung (Wertstrom → Tenant → Code-Default) ist rein und liegt in
 * `domain/portfolio-guardrails.ts`.
 */

import type { Prisma, PrismaClient } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import { withAuditedTransaction, toMutationContext } from "@/modules/core/kernel/server/mutation";
import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { authorizeResource } from "@/server/auth/authorize";
import {
  validateGuardrailTargets,
  parseGuardrailTargets,
  type GuardrailTargetsRow,
} from "@/modules/work/domain/portfolio-guardrails";

/** Alle Wertstrom-Zeilen eines Mandanten — Eingabe der Auflösung. */
export async function listValueStreamGuardrailTargets(
  db: PrismaClient,
  tenantId: TenantId,
): Promise<GuardrailTargetsRow[]> {
  const rows = await db.valueStreamGuardrailTargets.findMany({
    where: { tenantId },
    select: { valueStreamId: true, targets: true },
  });
  return rows.map((r) => ({ valueStreamId: r.valueStreamId, targets: r.targets }));
}

export interface SaveValueStreamGuardrailTargetsInput {
  valueStreamId: string;
  /**
   * Die Achsen, die dieser Wertstrom selbst setzt. Eine weggelassene Achse
   * bleibt geerbt — deshalb wird hier **nicht** ein vollständiges Ziel-Set
   * geschrieben, sondern genau das Gesetzte.
   */
  targets: {
    capacity?: { business: number; enabler: number } | undefined;
    approval?: { portfolioThreshold: number } | undefined;
  };
}

/**
 * Setzt oder ersetzt die Zeile eines Wertstroms. Ein leeres `targets` löscht
 * sie — „nichts gesetzt" und „alles wie der Tenant" sind dasselbe, und zwei
 * Darstellungen desselben Zustands laufen auseinander.
 */
export async function saveValueStreamGuardrailTargets(
  ctx: RequestContext,
  input: SaveValueStreamGuardrailTargetsInput,
): Promise<Result<{ valueStreamId: string }>> {
  const mctx = toMutationContext(ctx);
  const decision = authorizeResource(ctx.principal, "target.manage", {
    tenantId: mctx.tenantId,
    valueStreamId: input.valueStreamId,
  });
  if (!decision.ok) {
    return err({
      kind: "forbidden" as const,
      reason: "Nur Wertstrom-Owner oder Portfolio-Management dürfen Guardrail-Ziele setzen.",
    });
  }

  const axes = Object.entries(input.targets).filter(([, v]) => v != null);

  // Gegen den vollständigen Satz validieren: eine Mix-Achse muss auch dann auf
  // 100 summieren, wenn sie allein gesetzt wird.
  const probe = parseGuardrailTargets(Object.fromEntries(axes));
  const check = validateGuardrailTargets(probe);
  if (!check.ok) {
    return err({ kind: "conflict" as const, reason: check.reason ?? "Ungültige Ziele" });
  }

  return withAuditedTransaction(mctx, async (tx) => {
    const vs = await tx.valueStream.findFirst({
      where: { id: input.valueStreamId, tenantId: mctx.tenantId },
      select: { id: true },
    });
    if (!vs) {
      return err({
        kind: "not_found" as const,
        resourceType: "ValueStream",
        id: input.valueStreamId,
      });
    }

    const existing = await tx.valueStreamGuardrailTargets.findFirst({
      where: { tenantId: mctx.tenantId, valueStreamId: input.valueStreamId },
      select: { id: true, targets: true },
    });

    if (axes.length === 0) {
      if (existing) await tx.valueStreamGuardrailTargets.delete({ where: { id: existing.id } });
    } else {
      const data = Object.fromEntries(axes) as unknown as Prisma.InputJsonValue;
      if (existing) {
        await tx.valueStreamGuardrailTargets.update({
          where: { id: existing.id },
          data: { targets: data, updatedBy: mctx.actorId },
        });
      } else {
        await tx.valueStreamGuardrailTargets.create({
          data: {
            tenantId: mctx.tenantId,
            valueStreamId: input.valueStreamId,
            targets: data,
            updatedBy: mctx.actorId,
          },
        });
      }
    }

    return ok({
      result: { valueStreamId: input.valueStreamId },
      audit: {
        action: "value_stream.guardrails.updated" as const,
        resourceType: "value_stream" as const,
        resourceId: input.valueStreamId,
        changes: {
          targets: {
            before: existing?.targets ?? null,
            after: axes.length === 0 ? null : Object.fromEntries(axes),
          },
        },
      },
    });
  });
}
