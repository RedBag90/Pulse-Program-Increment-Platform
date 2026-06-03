import type { ValueStreamId, ArtId, TimelineId } from "@/domain/types";
import type { Result } from "@/domain/errors";
import { ok, isErr } from "@/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { createArt, updateArt } from "@/server/services/art";
import { createPi } from "@/server/services/pi";
import { joinArtToTimeline } from "@/server/services/timeline";

export interface StartArtInput {
  valueStreamId: ValueStreamId;
  name: string;
  /** Timeline the new ART joins — its cadence is shared. Replaces the old
   *  per-ART `piCadenceWeeks` input. */
  timelineId: TimelineId;
  rteId?: string | null | undefined;
  piName: string;
  piStartDate: Date;
  piEndDate: Date;
}

/**
 * Guided ART launch — composes the steps a new train needs (create ART → join
 * a shared Timeline → assign RTE → plan the first PI) into one flow, so
 * management doesn't click through four separate dialogs. Each step is its own
 * audited transaction (not atomic); inputs are validated at the action layer.
 *
 * The Timeline is now picked by the user up front — the cadence lives on the
 * Timeline, not the ART, and several ARTs may share it. The first PI is
 * created on that Timeline; it will conflict only if the chosen Timeline
 * already has a PI overlapping the requested period.
 */
export async function startArt(
  ctx: RequestContext,
  input: StartArtInput,
): Promise<Result<{ artId: ArtId }>> {
  const created = await createArt(ctx, {
    valueStreamId: input.valueStreamId,
    name: input.name,
  });
  if (isErr(created)) return created;
  const artId = created.value.id;

  if (input.rteId) {
    const updated = await updateArt(ctx, { id: artId, rteId: input.rteId });
    if (isErr(updated)) return updated;
  }

  const joined = await joinArtToTimeline(ctx, {
    artId,
    timelineId: input.timelineId,
  });
  if (isErr(joined)) return joined;

  const pi = await createPi(ctx, {
    timelineId: input.timelineId,
    name: input.piName,
    startDate: input.piStartDate,
    endDate: input.piEndDate,
  });
  if (isErr(pi)) return pi;

  return ok({ artId });
}

export interface CreateArtOnTimelineInput {
  valueStreamId: ValueStreamId;
  name: string;
  timelineId: TimelineId;
}

/**
 * Quick create: an ART + immediate Timeline membership. Two separate audited
 * transactions (`art.created` + `timeline.art.joined`); cadence is whatever
 * the Timeline already carries. Replaces the old `createArtWithStandard`
 * which spawned a Timeline per ART and optionally applied a standard — a
 * pattern that produced one Timeline per ART by default, against the new
 * "shared cadence" model.
 */
export async function createArtOnTimeline(
  ctx: RequestContext,
  input: CreateArtOnTimelineInput,
): Promise<Result<{ id: ArtId }>> {
  const created = await createArt(ctx, {
    valueStreamId: input.valueStreamId,
    name: input.name,
  });
  if (isErr(created)) return created;

  const joined = await joinArtToTimeline(ctx, {
    artId: created.value.id,
    timelineId: input.timelineId,
  });
  if (isErr(joined)) return joined;

  return ok({ id: created.value.id });
}
