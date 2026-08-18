"use server";

import { z } from "zod";
import { createServerAction, type ActionState } from "@/server/http/server-action";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  requestGateTransition,
  decideGateTransition,
  withdrawGateTransition,
  revertStageGate,
  saveGateApproverRule,
} from "@/modules/work/server/services/stage-gate-transition";
import { STAGE_GATES } from "@/modules/work/domain/stage-gate";
import { QUORA } from "@/modules/work/domain/approval-primitives";
import { GATE_APPROVER_ROLES } from "@/modules/work/domain/gate-policy";

export type { ActionState as StageGateActionState };

// ---------------------------------------------------------------------------
// Reifegrad-Wechsel — vier Verben statt der früheren drei Bewegungen.
//
// Der Push ist ein manueller Akt: `requestGateTransition` beantragt ihn,
// `decideGateTransition` nimmt ab. Nichts hier schiebt ein Gate als Nebenwirkung
// eines anderen Vorgangs — das war der Kern des Problems.
//
// Alle vier resolven die Resource auf `{ tenantId }`: die maßgebliche,
// scope-bewusste Prüfung läuft im Service gegen die geladene Zeile (ADR-0002).
// ---------------------------------------------------------------------------

/** Beantragt den Wechsel auf das nächste Gate. */
export const requestGateTransitionAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    toGate: z.enum(STAGE_GATES),
    reason: z.string().max(1000).optional(),
    approverUserIds: z.array(z.string().uuid()).max(10).optional(),
  }),
  action: "epic.gate.request",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    requestGateTransition(ctx, {
      epicId: input.epicId,
      toGate: input.toGate,
      reason: input.reason,
      approverUserIds: input.approverUserIds,
    }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Epic nicht gefunden",
      fallback: "Reifegrad-Wechsel konnte nicht beantragt werden",
    }),
});

/** Ein namentlich benannter Abnehmer entscheidet über einen offenen Antrag. */
export const decideGateTransitionAction = createServerAction({
  schema: z.object({
    transitionId: z.string().uuid(),
    decision: z.enum(["approve", "reject"]),
    comment: z.string().max(1000).optional(),
  }),
  action: "epic.gate.decide",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    decideGateTransition(ctx, {
      transitionId: input.transitionId,
      decision: input.decision,
      comment: input.comment,
    }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Für diesen Antrag ist dir keine Abnahme zugewiesen",
      fallback: "Abnahme fehlgeschlagen",
    }),
});

/** Zieht einen offenen Antrag zurück. */
export const withdrawGateTransitionAction = createServerAction({
  schema: z.object({
    transitionId: z.string().uuid(),
    reason: z.string().min(1, "Bitte eine Begründung angeben").max(1000),
  }),
  action: "epic.gate.withdraw",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    withdrawGateTransition(ctx, { transitionId: input.transitionId, reason: input.reason }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Antrag nicht gefunden",
      fallback: "Antrag konnte nicht zurückgezogen werden",
    }),
});

/**
 * Stuft ein Epic um einen Reifegrad zurück. Begründung ist Pflicht — der
 * Vorgang räumt Freigabe-Stempel ab und greift damit in die Historie ein.
 */
export const revertStageGateAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    toGate: z.enum(STAGE_GATES),
    reason: z.string().min(1, "Eine Rückstufung verlangt eine Begründung").max(1000),
  }),
  action: "epic.gate.revert",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    revertStageGate(ctx, {
      epicId: input.epicId,
      toGate: input.toGate,
      reason: input.reason,
    }),
  revalidate: "epic",
  mapError: (e) =>
    formatDomainError(e, {
      notFound: "Epic nicht gefunden",
      fallback: "Rückstufung fehlgeschlagen",
    }),
});

/** Hinterlegt, wer einen bestimmten Reifegrad-Wechsel abnimmt. */
export const saveGateApproverRuleAction = createServerAction({
  schema: z.object({
    // Leerstring = Tenant-Default (ein FormData-Feld kann nicht null tragen).
    valueStreamId: z.string().uuid().or(z.literal("")),
    toGate: z.enum(STAGE_GATES),
    required: z.coerce.boolean(),
    quorum: z.enum(QUORA),
    approverUserIds: z.array(z.string().uuid()).max(10).default([]),
    approverRoles: z.array(z.enum(GATE_APPROVER_ROLES)).max(5).default([]),
  }),
  action: "epic.gate.approvers.configure",
  resource: (input, p) => ({
    tenantId: p.tenantId,
    ...(input.valueStreamId ? { valueStreamId: input.valueStreamId } : {}),
  }),
  service: (ctx, input) =>
    saveGateApproverRule(ctx, {
      valueStreamId: input.valueStreamId || null,
      toGate: input.toGate,
      required: input.required,
      quorum: input.quorum,
      approverUserIds: input.approverUserIds,
      approverRoles: input.approverRoles,
    }),
  revalidate: "epic",
  mapError: (e) => formatDomainError(e, { fallback: "Abnehmer konnten nicht gespeichert werden" }),
});
