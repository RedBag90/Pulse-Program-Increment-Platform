"use server";

import { z } from "zod";
import {
  assignFeatureOwner,
  setFeatureSolution,
  setFeatureParent,
  createFeature,
  updateFeature,
  scoreFeature,
  setFeaturePi,
  softDeleteFeature,
  setFeatureDeliveryStatus,
  startFeature,
  type FeatureDeliveryStatus,
} from "@/modules/work/server/services/feature";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import { fibonacci } from "@/domain/schemas/initiative";
import { FEATURE_TYPES } from "@/modules/work/domain/portfolio-guardrails";

/**
 * Die Werteliste kommt aus der Domaene, nicht aus dem Gedaechtnis — ein dritter
 * Arbeitstyp soll nicht an einer Zod-Kante haengenbleiben. Das widerspricht
 * ADR-0004 nicht: dort geht es um zusammengelegte **Eingabe-Schemata**, nicht
 * um eine geteilte Werteliste. Vorbild: `z.enum(GATE_STEPS)` in
 * `portfolio/actions/stage-gate.ts`.
 *
 * Der leere String bleibt daneben: er heisst „ungesetzt" bzw. „clearen".
 */
const FEATURE_TYPE_FIELD = z.enum([...FEATURE_TYPES, ""]).optional();
import type { EpicId, ArtId, FeatureId, PiId, UserId } from "@/modules/core/kernel/domain/types";

export interface FeatureActionState {
  error?: string;
  success?: boolean;
}

export const createFeatureAction = createServerAction({
  describeCreated: (v: { id: string }) => ({
    id: v.id,
    label: "Feature",
    href: `/feature/${v.id}`,
  }),
  schema: z.object({
    artId: z.string().uuid(),
    /**
     * Optional: fehlt es, entsteht ein **eigenständiges Feature**.
     *
     * Das `<select>` schickt einen leeren String, wenn „ohne Epic" gewählt ist.
     * Die Abbildung `"" → nicht gesetzt` steht unten im Service-Aufruf, nicht
     * als `.transform()` — ein `"use server"`-Modul darf keine nicht-asynchrone
     * Funktion enthalten, der Bau lehnt sie als „Server Action" ab. Dasselbe
     * Idiom benutzt `setFeaturePiAction` für den Backlog.
     */
    parentId: z.union([z.string().uuid(), z.literal("")]).optional(),
    /**
     * Optional; leer = Backlog. Die API-Kante kannte das Feld längst, das
     * Formular nicht — ein im Cockpit angelegtes Feature landete deshalb
     * **immer** im Backlog, auch wenn der Nutzer gerade in einem PI stand.
     */
    piId: z.union([z.string().uuid(), z.literal("")]).optional(),
    /** Optional; leer = der Anlegende. Das Formular belegt ihn damit vor. */
    ownerId: z.union([z.string().uuid(), z.literal("")]).optional(),
    /** Optional; leer = die Solution des Epics, sonst keine. */
    primarySolutionId: z.union([z.string().uuid(), z.literal("")]).optional(),
    title: z.string().min(1).max(200),
    description: z.string().max(10_000).optional(),
    wsjfBusinessValue: z.coerce.number().pipe(fibonacci),
    wsjfTimeCriticality: z.coerce.number().pipe(fibonacci),
    wsjfRiskReduction: z.coerce.number().pipe(fibonacci),
    wsjfJobSize: z.coerce.number().pipe(fibonacci),
    acceptanceCriteria: z.string().optional(),
    // SAFe Guardrails. Leerer String = explizit „ungesetzt".
    featureType: FEATURE_TYPE_FIELD,
  }),
  action: "feature.create",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => {
    const acceptanceCriteria = input.acceptanceCriteria
      ? input.acceptanceCriteria
          .split("\n")
          .map((s) => s.trim())
          .filter(Boolean)
      : [];
    return createFeature(ctx, {
      parentId: input.parentId ? (input.parentId as EpicId) : undefined,
      artId: input.artId as ArtId,
      ...(input.piId ? { piId: input.piId as PiId } : {}),
      ...(input.ownerId ? { ownerId: input.ownerId as UserId } : {}),
      ...(input.primarySolutionId ? { primarySolutionId: input.primarySolutionId } : {}),
      title: input.title,
      description: input.description,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
      acceptanceCriteria,
      ...(input.featureType !== undefined && {
        featureType: input.featureType === "" ? null : input.featureType,
      }),
    });
  },
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.createFeature" }, t),
});

export const updateFeatureAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    title: z.string().min(1).max(200).optional(),
    description: z.string().max(10_000).optional(),
    acceptanceCriteria: z.string().optional(),
    wsjfBusinessValue: z.coerce.number().pipe(fibonacci).optional(),
    wsjfTimeCriticality: z.coerce.number().pipe(fibonacci).optional(),
    wsjfRiskReduction: z.coerce.number().pipe(fibonacci).optional(),
    wsjfJobSize: z.coerce.number().pipe(fibonacci).optional(),
    // SAFe Guardrails (Roadmap-G2). Leerer String = clearen.
    featureType: FEATURE_TYPE_FIELD,
  }),
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => {
    const acceptanceCriteria =
      input.acceptanceCriteria !== undefined
        ? input.acceptanceCriteria
            .split("\n")
            .map((s) => s.trim())
            .filter(Boolean)
        : undefined;
    return updateFeature(ctx, {
      id: input.id as FeatureId,
      title: input.title,
      description: input.description,
      acceptanceCriteria,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
      ...(input.featureType !== undefined && {
        featureType: input.featureType === "" ? null : input.featureType,
      }),
    });
  },
  revalidate: "feature",
  mapError: (e, t) =>
    formatDomainError(
      e,
      { notFoundKey: "errors.action.featureNotFound", fallbackKey: "errors.action.updateFeature" },
      t,
    ),
});

export const scoreFeatureAction = createServerAction({
  schema: z.object({
    featureId: z.string().uuid(),
    artId: z.string().uuid(),
    wsjfBusinessValue: z.coerce.number().pipe(fibonacci),
    wsjfTimeCriticality: z.coerce.number().pipe(fibonacci),
    wsjfRiskReduction: z.coerce.number().pipe(fibonacci),
    wsjfJobSize: z.coerce.number().pipe(fibonacci),
  }),
  action: "feature.wsjf.set",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    scoreFeature(ctx, {
      id: input.featureId as FeatureId,
      wsjfBusinessValue: input.wsjfBusinessValue,
      wsjfTimeCriticality: input.wsjfTimeCriticality,
      wsjfRiskReduction: input.wsjfRiskReduction,
      wsjfJobSize: input.wsjfJobSize,
    }),
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.updateWsjf" }, t),
});

export const deleteFeatureAction = createServerAction({
  schema: z.object({ id: z.string().uuid(), artId: z.string().uuid() }),
  action: "feature.delete",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) => softDeleteFeature(ctx, { id: input.id as FeatureId }),
  revalidate: "feature",
  mapError: (e, t) =>
    formatDomainError(
      e,
      { notFoundKey: "errors.action.featureNotFound", fallbackKey: "errors.action.deleteFeature" },
      t,
    ),
});

const DELIVERY_STATUS = z.enum(["approved", "in_progress", "blocked", "completed", "cancelled"]);

/**
 * Starts an approved Feature — the most common delivery transition. Picks up
 * `approved → in_progress` only; the service enforces "Feature in PI" and
 * "Epic in L4/L5" so the start has operational meaning.
 */
export const startFeatureAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: "feature.delivery.set",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, input) => startFeature(ctx, { id: input.id as FeatureId }),
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.startFeature" }, t),
});

/**
 * Generic delivery transition (pause, resume, complete, cancel). `reason` is
 * required for pause/cancel by the client UI; the server treats it as optional
 * (anyone calling directly may omit it).
 */
export const setFeatureDeliveryStatusAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    to: DELIVERY_STATUS,
    reason: z.string().max(2000).optional(),
  }),
  action: "feature.delivery.set",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  service: (ctx, input) =>
    setFeatureDeliveryStatus(ctx, {
      id: input.id as FeatureId,
      to: input.to as FeatureDeliveryStatus,
      reason: input.reason,
    }),
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.changeStatus" }, t),
});

/**
 * Bulk delivery-status — Cockpit-Tabelle-Bulk-Bar (Delivery-Cockpit P3).
 * Iteriert per Factory-Batch ueber `featureIds`; `continueOnError: true`
 * laesst verbotene Transitions oder Permission-Konflikte einzelne Items
 * skippen, ohne den Rest abzubrechen (Entscheidung #6 = kein Bulk-Limit).
 */
export const bulkSetFeatureDeliveryStatusAction = createServerAction({
  schema: z.object({
    featureIds: z.array(z.string().uuid()).min(1),
    to: DELIVERY_STATUS,
    reason: z.string().max(2000).optional(),
  }),
  action: "feature.delivery.set",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  batch: {
    iterateOver: "featureIds",
    service: (ctx, id, rest) =>
      setFeatureDeliveryStatus(ctx, {
        id: id as FeatureId,
        to: rest.to as FeatureDeliveryStatus,
        reason: rest.reason,
      }),
    continueOnError: true,
  },
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.bulkStatusChange" }, t),
});

/**
 * Assign one or more features to a PI, or move them back to the backlog
 * (piId = ""). Serves the PI-overview picker, the planning board (single-id
 * batches), and the feature-backlog inline dropdown. Uses the factory's
 * batch mode — early-fail on the first conflict, fold per-item `warnings`.
 */
export const setFeaturePiAction = createServerAction({
  schema: z.object({
    featureIds: z.array(z.string().uuid()).min(1),
    /** Empty string → backlog (null). FormData can't carry literal null. */
    piId: z.string(),
    artId: z.string().uuid(),
  }),
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  batch: {
    iterateOver: "featureIds",
    service: (ctx, featureId, rest) =>
      setFeaturePi(ctx, {
        featureId: featureId as FeatureId,
        piId: rest.piId === "" ? null : (rest.piId as PiId),
      }),
    foldWarnings: (out) => out.warnings,
  },
  revalidate: "feature",
  mapError: (e, t) =>
    formatDomainError(
      e,
      {
        notFoundKey: "errors.action.featureOrPiNotFound",
        fallbackKey: "errors.action.assignFeature",
      },
      t,
    ),
});

/**
 * Owner eines Features setzen oder entfernen. Leerer String = „kein Owner" —
 * das Formular kann keinen echten `null`-Wert senden.
 */
/**
 * Ein Feature einem Epic zuordnen oder daraus lösen (`""` = lösen, das Feature
 * wird eigenständig).
 */
export const setFeatureParentAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    parentId: z.union([z.string().uuid(), z.literal("")]),
  }),
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    setFeatureParent(ctx, {
      id: input.id,
      parentId: input.parentId === "" ? null : input.parentId,
    }),
  revalidate: "feature",
  mapError: (e, t) =>
    formatDomainError(e, { fallbackKey: "errors.action.changeEpicAssignment" }, t),
});

/**
 * Die Solution eines Features setzen oder entfernen (`""` = keine eigene, dann
 * gilt wieder die des Epics). Eigene Aktion statt eines Feldes in
 * `updateFeatureAction`: die Zuordnung braucht eine eigene Prüfung am Service —
 * `updateFeature` hat keinen solchen Seam.
 */
export const setFeatureSolutionAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    solutionId: z.union([z.string().uuid(), z.literal("")]),
  }),
  action: "feature.update",
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    setFeatureSolution(ctx, {
      id: input.id,
      solutionId: input.solutionId === "" ? null : input.solutionId,
    }),
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.setSolution" }, t),
});

export const assignFeatureOwnerAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    artId: z.string().uuid(),
    ownerId: z.union([z.string().uuid(), z.literal("")]),
  }),
  action: "feature.owner.assign",
  // Grober Vorfilter; der wertstrom-genaue Check läuft am Service-Seam, weil
  // erst dort das geladene Feature seinen Wertstrom kennt (ADR-0002).
  resource: (input, p) => ({ tenantId: p.tenantId, artId: input.artId }),
  service: (ctx, input) =>
    assignFeatureOwner(ctx, { id: input.id, ownerId: input.ownerId === "" ? null : input.ownerId }),
  revalidate: "feature",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.setOwner" }, t),
});
