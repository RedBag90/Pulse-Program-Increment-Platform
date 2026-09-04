"use server";

import { z } from "zod";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";
import {
  createRtbItem,
  updateRtbItem,
  deleteRtbItem,
} from "@/modules/budgeting/server/services/rtb-item-service";
import { saveRtbAwards } from "@/modules/budgeting/server/services/rtb-award-service";
import { revalidateFor } from "@/server/http/revalidation";
import { RTB_INTERVALS } from "@/modules/budgeting/domain/rtb-interval";
import { RTB_KINDS } from "@/modules/budgeting/domain/rtb-kind";

const MANAGE = "rtb_item.manage" as const;
const interval = z.enum(RTB_INTERVALS);
const kind = z.enum(RTB_KINDS);
/**
 * Der ART, für den ein `art_change`-Budget reserviert wird. Leer heißt „keiner":
 * bei `run` ist das der Normalfall, bei `art_change` weist der Service es ab —
 * ein ART-Epic-Budget ohne ART hätte niemanden, der es verteilen darf.
 */
const artField = (f: ReturnType<typeof fields>) => f.nonEmptyString("artId") ?? null;
/** Leerer Select-Wert = wertstrom-übergreifend, also ausdrücklich `null`. */
const solutionField = (f: ReturnType<typeof fields>) => f.nonEmptyString("solutionId") ?? null;
// Grober Gate auf Tenant-Ebene; die VS-scoped Prüfung + Finance-Bypass macht der
// Service (`assertRtbManage`). Genau deshalb steht an den Actions
// `authorizedInService`: die Finance-Partei trägt `rtb_item.manage` nicht und
// wurde hier sonst abgewiesen, bevor ihr Bypass im Service greifen konnte.
const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });
const err = (e: Parameters<typeof formatDomainError>[0]) =>
  e.kind === "forbidden" ? e.reason : formatDomainError(e, { fallback: "Aktion fehlgeschlagen" });

/**
 * Die Aufteilung des Zuspruchs auf die Positionen des Wertstroms.
 *
 * Ein Aufruf schreibt **alle** Zeilen — der Deckel gilt gegen die Summe, und
 * eine zeilenweise Speicherung könnte ihn zwischendurch überschreiten.
 */
export const saveRtbAwardsAction = createServerAction({
  schema: z.object({
    valueStreamId: z.string().uuid(),
    cycleKey: z.string().regex(/^\d{4}-H[12]$/),
    amounts: z.array(z.object({ rtbItemId: z.string().uuid(), amount: z.number().min(0) })),
  }),
  action: MANAGE,
  authorizedInService: true,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const raw = f.nonEmptyString("amounts") ?? "[]";
    return {
      valueStreamId: f.string("valueStreamId"),
      cycleKey: f.string("cycleKey"),
      amounts: JSON.parse(raw) as { rtbItemId: string; amount: number }[],
    };
  },
  service: (ctx, i) => saveRtbAwards(ctx, i),
  onSuccess: () => {
    // Aus der Aufteilung entsteht der Rahmen jedes ARTs.
    revalidateFor("art");
    revalidateFor("valueStream");
  },
  mapError: err,
});

export const createRtbItemAction = createServerAction({
  schema: z.object({
    valueStreamId: z.string().uuid(),
    name: z.string().min(1).max(120),
    plannedAmount: z.number().nonnegative(),
    interval,
    solutionId: z.string().uuid().nullable(),
    kind,
    artId: z.string().uuid().nullable(),
  }),
  action: MANAGE,
  authorizedInService: true,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      valueStreamId: f.string("valueStreamId"),
      name: f.string("name"),
      plannedAmount: Number(f.string("plannedAmount")),
      interval: (f.nonEmptyString("interval") ?? "yearly") as z.infer<typeof interval>,
      solutionId: solutionField(f),
      kind: (f.nonEmptyString("kind") ?? "run") as z.infer<typeof kind>,
      artId: artField(f),
    };
  },
  service: (ctx, i) =>
    createRtbItem(ctx, {
      valueStreamId: i.valueStreamId,
      name: i.name,
      plannedAmount: i.plannedAmount,
      interval: i.interval,
      solutionId: i.solutionId,
      kind: i.kind,
      artId: i.artId,
    }),
  revalidate: "rtbItem",
  mapError: err,
});

export const updateRtbItemAction = createServerAction({
  schema: z.object({
    id: z.string().uuid(),
    name: z.string().min(1).max(120).optional(),
    plannedAmount: z.number().nonnegative().optional(),
    active: z.boolean().optional(),
    interval: interval.optional(),
    solutionId: z.string().uuid().nullable().optional(),
    kind: kind.optional(),
    artId: z.string().uuid().nullable().optional(),
  }),
  action: MANAGE,
  authorizedInService: true,
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    const name = f.nonEmptyString("name");
    const amount = f.nonEmptyString("plannedAmount");
    const active = fd.get("active");
    const iv = f.nonEmptyString("interval");
    return {
      id: f.string("id"),
      ...(name !== undefined ? { name } : {}),
      ...(amount !== undefined ? { plannedAmount: Number(amount) } : {}),
      ...(active !== null ? { active: active === "true" || active === "1" } : {}),
      ...(iv !== undefined ? { interval: iv as z.infer<typeof interval> } : {}),
      // Nur mitschicken, wenn das Formular das Feld überhaupt trägt: die
      // Solution-eigene Fläche hat keinen Solution-Select und darf die
      // Zurechnung nicht versehentlich auf null setzen.
      ...(fd.has("solutionId") ? { solutionId: solutionField(f) } : {}),
      // Dieselbe Zurückhaltung wie bei `solutionId`: Flächen ohne diese Felder
      // dürfen Art und ART nicht versehentlich zurücksetzen.
      ...(fd.has("kind")
        ? { kind: (f.nonEmptyString("kind") ?? "run") as z.infer<typeof kind> }
        : {}),
      ...(fd.has("artId") ? { artId: artField(f) } : {}),
    };
  },
  service: (ctx, i) =>
    updateRtbItem(ctx, {
      id: i.id,
      ...(i.name !== undefined ? { name: i.name } : {}),
      ...(i.plannedAmount !== undefined ? { plannedAmount: i.plannedAmount } : {}),
      ...(i.active !== undefined ? { active: i.active } : {}),
      ...(i.interval !== undefined ? { interval: i.interval } : {}),
      ...(i.solutionId !== undefined ? { solutionId: i.solutionId } : {}),
      ...(i.kind !== undefined ? { kind: i.kind } : {}),
      ...(i.artId !== undefined ? { artId: i.artId } : {}),
    }),
  revalidate: "rtbItem",
  mapError: err,
});

export const deleteRtbItemAction = createServerAction({
  schema: z.object({ id: z.string().uuid() }),
  action: MANAGE,
  authorizedInService: true,
  resource: tenantResource,
  parseFormData: (fd) => ({ id: fields(fd).string("id") }),
  service: (ctx, i) => deleteRtbItem(ctx, { id: i.id }),
  revalidate: "rtbItem",
  mapError: err,
});
