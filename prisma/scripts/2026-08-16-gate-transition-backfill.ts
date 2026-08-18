/**
 * Backfill für den Umstieg auf beantragte, namentlich abgenommene
 * Reifegrad-Wechsel (ADR-0018).
 *
 * Drei Schritte, alle idempotent:
 *
 *  1. **Abnehmer-Regeln seeden** — je Tenant eine Tenant-Default-Zeile pro Gate
 *     aus `DEFAULT_GATE_POLICIES`, damit ein Wechsel am Tag 1 beantragbar ist,
 *     ohne dass erst jemand Regeln pflegt.
 *
 *  2. **Offene Vorschläge überführen** — jedes Epic mit `proposedStageGate != null`
 *     bekommt einen echten Antrag. Lassen sich Abnehmer auflösen, entsteht ein
 *     `pending`-Antrag samt Abnahme-Zeilen; lässt sich niemand auflösen, wird der
 *     Antrag als `withdrawn` angelegt. So bleibt **kein Epic auf niemanden
 *     wartend hängen** — der Owner sieht stattdessen eine frische
 *     „Push beantragen"-Affordanz.
 *
 *  3. **Capabilities nachziehen** — `resolveCapabilities` fällt nur dann auf
 *     `POLICIES` zurück, wenn ein Tenant *null* `role_capabilities`-Zeilen hat.
 *     Jeder Tenant, der je `/admin/roles` besucht hat, hätte sonst still keine
 *     der fünf neuen `epic.gate.*`-Aktionen. Die zurückgezogenen `epic.approve`
 *     und `epic.impact.confirm` werden entfernt.
 *
 * Aufruf:
 *   set -a; . ./.env.local; set +a
 *   pnpm tsx prisma/scripts/2026-08-16-gate-transition-backfill.ts
 */

import { PrismaClient } from "@/generated/prisma";
import { enumerateDefaultCapabilities } from "@/server/auth/policies";
import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import {
  DEFAULT_GATE_POLICIES,
  resolveGatePolicy,
  expandApprovers,
  type GateApproverRuleRow,
} from "@/modules/work/domain/gate-policy";

const SYSTEM_ACTOR = "00000000-0000-0000-0000-000000000000";
const RETIRED_ACTIONS = ["epic.approve", "epic.impact.confirm"];

/** Schritt 1 — Tenant-Default-Regeln je Gate. */
async function seedApproverRules(db: PrismaClient, tenantId: string): Promise<number> {
  let written = 0;
  for (const gate of STAGE_GATES) {
    // L0 ist kein Antragsziel — dorthin führt nur eine Korrektur.
    if (gate === "L0") continue;
    const existing = await db.stageGateApproverRule.findFirst({
      where: { tenantId, valueStreamId: null, toGate: gate },
      select: { id: true },
    });
    if (existing) continue;

    const preset = DEFAULT_GATE_POLICIES[gate];
    await db.stageGateApproverRule.create({
      data: {
        tenantId,
        valueStreamId: null,
        toGate: gate,
        required: preset.required,
        quorum: preset.quorum,
        approverUserIds: preset.approverUserIds,
        approverRoles: preset.approverRoles,
        updatedBy: SYSTEM_ACTOR,
      },
    });
    written += 1;
  }
  return written;
}

/** Schritt 2 — offene Vorschläge in echte Anträge überführen. */
async function migrateProposals(
  db: PrismaClient,
  tenantId: string,
): Promise<{ pending: number; withdrawn: number }> {
  // Rohzugriff: die `proposed_*`-Spalten werden mit diesem Umstieg gedroppt,
  // stehen also im Prisma-Client eventuell schon nicht mehr.
  const proposals = await db.$queryRawUnsafe<
    Array<{
      id: string;
      stage_gate: string;
      proposed_stage_gate: string;
      proposed_by: string | null;
      proposed_at: Date | null;
      value_stream_id: string | null;
      owner_id: string | null;
      updated_by: string | null;
    }>
  >(
    `SELECT id, stage_gate, proposed_stage_gate, proposed_by, proposed_at,
            value_stream_id, owner_id, updated_by
       FROM initiatives
      WHERE tenant_id = $1::uuid
        AND proposed_stage_gate IS NOT NULL
        AND deleted_at IS NULL`,
    tenantId,
  );

  const rules = (await db.stageGateApproverRule.findMany({
    where: { tenantId },
    select: {
      valueStreamId: true,
      toGate: true,
      required: true,
      quorum: true,
      approverUserIds: true,
      approverRoles: true,
    },
  })) as GateApproverRuleRow[];

  let pending = 0;
  let withdrawn = 0;

  for (const p of proposals) {
    const already = await db.stageGateTransition.findFirst({
      where: { tenantId, initiativeId: p.id },
      select: { id: true },
    });
    if (already) continue; // idempotent

    const toGate = p.proposed_stage_gate as StageGate;
    const valueStream = p.value_stream_id
      ? await db.valueStream.findUnique({
          where: { id: p.value_stream_id },
          select: { financeApproverId: true, vmoId: true },
        })
      : null;

    const policy = resolveGatePolicy(toGate, rules, p.value_stream_id);
    const approvers = expandApprovers(policy, {
      valueStreamFinanceApproverId: valueStream?.financeApproverId ?? null,
      valueStreamVmoId: valueStream?.vmoId ?? null,
      epicOwnerId: p.owner_id,
    });

    const requestedBy = p.proposed_by ?? p.updated_by ?? SYSTEM_ACTOR;
    const requestedAt = p.proposed_at ?? new Date();
    const hasApprovers = policy.required && approvers.length > 0;

    const transition = await db.stageGateTransition.create({
      data: {
        tenantId,
        initiativeId: p.id,
        fromGate: p.stage_gate,
        toGate,
        kind: "forward",
        status: hasApprovers ? "pending" : "withdrawn",
        quorum: policy.quorum,
        requestedBy,
        requestedAt,
        reason: hasApprovers
          ? "Automatisch übernommener Gate-Vorschlag"
          : "Automatisch überführt — keine Abnehmer konfiguriert; bitte neu beantragen",
        ...(hasApprovers ? {} : { resolvedAt: new Date(), resolvedBy: SYSTEM_ACTOR }),
        ...(hasApprovers && {
          approvals: {
            create: approvers.map((a) => ({
              tenantId,
              approverUserId: a.userId,
              role: a.role,
              source: a.source,
              createdBy: SYSTEM_ACTOR,
              requestedAt,
            })),
          },
        }),
      },
      select: { id: true },
    });

    if (hasApprovers) {
      // Vorschläge waren früher unsichtbar — der überführte Antrag bekommt
      // rückwirkend seine Audit-Zeile.
      await db.auditEvent.create({
        data: {
          tenantId,
          actorId: requestedBy,
          action: "initiative.stage_gate.requested",
          resourceType: "initiative",
          resourceId: p.id,
          changes: {
            stageGate: { before: p.stage_gate, after: toGate },
            approvers: { before: null, after: approvers.map((a) => a.userId) },
          },
          occurredAt: requestedAt,
        },
      });
      pending += 1;
    } else {
      withdrawn += 1;
    }
    void transition;
  }

  return { pending, withdrawn };
}

/** Schritt 3 — neue Capabilities nachziehen, alte zurückziehen. */
async function syncCapabilities(db: PrismaClient, tenantId: string): Promise<{
  added: number;
  removed: number;
}> {
  const existingCount = await db.roleCapability.count({ where: { tenantId } });
  // Tenants ohne eigene Zeilen fallen weiter auf POLICIES zurück — nichts zu tun.
  if (existingCount === 0) return { added: 0, removed: 0 };

  const gateTuples = enumerateDefaultCapabilities().filter((t) =>
    t.action.startsWith("epic.gate."),
  );

  let added = 0;
  for (const t of gateTuples) {
    const existing = await db.roleCapability.findFirst({
      where: { tenantId, role: t.role, action: t.action },
      select: { id: true },
    });
    if (existing) continue;
    await db.roleCapability.create({
      data: {
        tenantId,
        role: t.role,
        action: t.action,
        ...(t.scope ? { scope: t.scope } : {}),
        createdBy: SYSTEM_ACTOR,
      },
    });
    added += 1;
  }

  const { count: removed } = await db.roleCapability.deleteMany({
    where: { tenantId, action: { in: RETIRED_ACTIONS } },
  });

  return { added, removed };
}

async function main() {
  const db = new PrismaClient();
  try {
    const tenants = await db.tenant.findMany({ select: { id: true, name: true } });
    console.warn(`Backfill Reifegrad-Wechsel: ${tenants.length} Tenant(s).`);

    for (const t of tenants) {
      const rules = await seedApproverRules(db, t.id);
      const { pending, withdrawn } = await migrateProposals(db, t.id);
      const { added, removed } = await syncCapabilities(db, t.id);
      console.warn(
        `  ${t.name}: ${rules} Regel(n), ${pending} Antrag/Anträge offen, ` +
          `${withdrawn} ohne Abnehmer zurückgezogen, ${added} Capability(s) ergänzt, ${removed} entfernt.`,
      );
    }
    console.warn("Fertig.");
  } finally {
    await db.$disconnect();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
