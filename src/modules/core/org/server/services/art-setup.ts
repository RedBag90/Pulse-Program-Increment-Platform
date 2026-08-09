import type { ValueStreamId, ArtId, TimelineId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, isErr } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { createArt, updateArt } from "@/modules/core/org/server/services/art";
import { joinArtToTimeline } from "@/server/services/timeline";

export interface StartArtInput {
  valueStreamId: ValueStreamId;
  name: string;
  /** Timeline the new ART joins — its cadence is shared. PIs werden zentral
   *  über `applyPiStandard` auf dieser Timeline erzeugt, nicht hier. */
  timelineId: TimelineId;
  rteId?: string | null | undefined;
}

/**
 * Guided ART launch — komponiert die Schritte, die ein frischer Train braucht
 * (ART anlegen → einer Shared-Timeline beitreten → RTE setzen) zu einem
 * Flow, damit das Management nicht drei Dialoge durchklicken muss. Jeder
 * Schritt ist eine eigene audited Transaction (nicht atomar); Inputs werden
 * auf Action-Ebene validiert.
 *
 * PIs entstehen seit dem Timeline-Rollout ausschließlich aus dem PI-Standard,
 * der auf die Timeline angewendet wird (`addStandardPisAction`). Der
 * Onboarding-Flow legt deshalb kein erstes PI mehr an — der User sieht im
 * Erfolgsfall einen Hinweis, dass PIs über die Timeline-Verwaltung
 * angelegt werden.
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
