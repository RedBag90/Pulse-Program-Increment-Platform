"use server";

/**
 * **Die Verknuepfung Epic ↔ Solution** — der Work-Rest der frueheren
 * Solution-Actions. Sie autorisiert ein **Epic** (`epic.update`), nicht die
 * Solution; deshalb blieb sie hier, als die Solution nach Core zog (ADR-0022).
 */

import { z } from "zod";
import { setEpicSolutions } from "@/modules/work/server/services/epic-solutions";
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { formatDomainError } from "@/server/http/domain-error-display";

const tenantResource = (_i: unknown, p: { tenantId: string }) => ({ tenantId: p.tenantId });

/** Setzt die Solution-Zuordnungen eines Epics (n:m) + Primär-Solution. */
export const setEpicSolutionsAction = createServerAction({
  schema: z.object({
    epicId: z.string().uuid(),
    solutionIds: z.array(z.string().uuid()),
    primarySolutionId: z.string().uuid().nullable(),
  }),
  action: "epic.update",
  resource: tenantResource,
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      epicId: f.string("epicId"),
      solutionIds: fd
        .getAll("solutionIds")
        .map((v) => String(v))
        .filter((v) => v.length > 0),
      primarySolutionId: f.nonEmptyString("primarySolutionId") ?? null,
    };
  },
  service: (ctx, input) =>
    setEpicSolutions(ctx, {
      epicId: input.epicId,
      solutionIds: input.solutionIds,
      primarySolutionId: input.primarySolutionId,
    }),
  revalidate: "solution",
  mapError: (e, t) => formatDomainError(e, { fallbackKey: "errors.action.assign" }, t),
});
