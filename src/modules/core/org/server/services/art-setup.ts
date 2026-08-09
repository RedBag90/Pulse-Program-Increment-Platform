import type { ValueStreamId, ArtId } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import { ok, isErr } from "@/modules/core/kernel/domain/errors";
import type { RequestContext } from "@/server/http/mutation-handler";
import { createArt, updateArt } from "@/modules/core/org/server/services/art";

export interface StartArtInput {
  valueStreamId: ValueStreamId;
  name: string;
  rteId?: string | null | undefined;
}

/**
 * Guided ART launch — legt einen frischen Train an (+ optional RTE). **Kadenz-
 * frei**: das Beitreten zu einer PI-Timeline/Kadenz ist bewusst NICHT mehr Teil
 * der ART-Anlage (ADR-0014 + Modul-Layering — Kadenz ist Drumbeat). Eine Kadenz
 * wird nachträglich pro ART über das Drumbeat-Modul zugewiesen (`joinArtToTimeline`
 * dort), sofern Drumbeat freigeschaltet ist. Jeder Schritt ist eine eigene
 * audited Transaction (nicht atomar).
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

  return ok({ artId });
}

export interface CreateArtOnTimelineInput {
  valueStreamId: ValueStreamId;
  name: string;
}

/**
 * Quick create: nur der ART (audited `art.created`). Kadenz-frei — eine
 * Timeline-Mitgliedschaft wird, falls gewünscht, später über Drumbeat gesetzt.
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

  return ok({ id: created.value.id });
}
