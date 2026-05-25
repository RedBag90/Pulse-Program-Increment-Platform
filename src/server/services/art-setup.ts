import type { ValueStreamId, ArtId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, isErr } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { createArt, updateArt } from "@/server/services/art";
import { createPi } from "@/server/services/pi";
import { applyPiStandard } from "@/server/services/pi-standard";

export interface StartArtInput {
  valueStreamId: ValueStreamId;
  name: string;
  piCadenceWeeks?: number | undefined;
  rteId?: string | null | undefined;
  piName: string;
  piStartDate: Date;
  piEndDate: Date;
}

/**
 * Guided ART launch — composes the steps a new train needs (create ART → set
 * cadence → assign RTE → plan the first PI) into one flow, so management doesn't
 * click through four separate dialogs. Each step is its own audited transaction
 * (not atomic); inputs are validated at the action layer and a brand-new ART has
 * no PI to conflict with, so the PI step reliably succeeds once the ART exists.
 */
export async function startArt(
  ctx: RequestContext,
  input: StartArtInput,
): Promise<Result<{ artId: ArtId }>> {
  const created = await createArt(ctx, {
    valueStreamId: input.valueStreamId,
    name: input.name,
    piCadenceWeeks: input.piCadenceWeeks,
  });
  if (isErr(created)) return created;
  const artId = created.value.id;

  if (input.rteId) {
    const updated = await updateArt(ctx, { id: artId, rteId: input.rteId });
    if (isErr(updated)) return updated;
  }

  const pi = await createPi(ctx, {
    artId,
    name: input.piName,
    startDate: input.piStartDate,
    endDate: input.piEndDate,
  });
  if (isErr(pi)) return pi;

  return ok({ artId });
}

export interface CreateArtWithStandardInput {
  valueStreamId: ValueStreamId;
  name: string;
  piCadenceWeeks?: number | undefined;
  /** Optional named PI standard — when set, its PIs are provisioned for the current year. */
  piStandardId?: string | undefined;
}

/**
 * Creates an ART and, when a PI standard is chosen, immediately provisions the
 * current year's standard PIs (and aligns the ART cadence to the standard).
 * Mirrors `startArt`: each step is its own audited transaction (not atomic); a
 * brand-new ART has no PIs, so every standard PI's period is free and created.
 */
export async function createArtWithStandard(
  ctx: RequestContext,
  input: CreateArtWithStandardInput,
): Promise<Result<{ id: ArtId }>> {
  const created = await createArt(ctx, {
    valueStreamId: input.valueStreamId,
    name: input.name,
    piCadenceWeeks: input.piCadenceWeeks,
  });
  if (isErr(created)) return created;

  if (input.piStandardId) {
    const applied = await applyPiStandard(ctx, {
      artId: created.value.id,
      standardId: input.piStandardId,
      year: new Date().getUTCFullYear(),
    });
    if (isErr(applied)) return applied;
  }

  return ok({ id: created.value.id });
}
