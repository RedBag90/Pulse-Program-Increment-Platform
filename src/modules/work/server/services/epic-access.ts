import type { Prisma } from "@/generated/prisma";
import { InitiativeLevel } from "@/modules/core/kernel/domain/types";
import type { Result } from "@/modules/core/kernel/domain/errors";
import type { Principal } from "@/server/auth/principal";
import type { Action } from "@/server/auth/policies";
import { loadAndAuthorize } from "@/server/services/load-and-authorize";

/**
 * Every Epic scope check needs the row's real `valueStreamId` + `ownerId`, so we
 * force both into whatever `select` the caller passes and into the returned
 * row's type — the `toResource` mapper can then always read them regardless of
 * which fields the operation itself needs. Adding them by intersection (rather
 * than intersecting the `select`) keeps the caller's selected fields precisely
 * typed while guaranteeing the two scope columns are present.
 */
type LoadedEpic<S extends Prisma.InitiativeSelect> = Prisma.InitiativeGetPayload<{ select: S }> & {
  valueStreamId: string | null;
  ownerId: string | null;
};

/**
 * Epic-specific "load row → authorize against the *real* row → return it"
 * (ADR-0002), built on the generic {@link loadAndAuthorize}. Concentrates the
 * identical Epic finder (`id` + `tenantId` + `level: EPIC` + not-deleted) and
 * the standard `{ tenantId, valueStreamId, ownerId }` resource mapping that
 * ~7 Epic mutations inlined, so "authorize after row load" is a single uniform
 * property of touching an Epic by id — no service can silently skip the scope
 * check.
 *
 * The caller passes only the `action` and the `select` it needs; `valueStreamId`
 * and `ownerId` are always added to the select (and to the returned row's type)
 * so the scope mapping is total.
 */
export async function loadAuthorizedEpic<S extends Prisma.InitiativeSelect>(
  db: Prisma.TransactionClient,
  principal: Principal,
  mctx: { tenantId: string },
  args: { id: string; action: Action; select: S },
): Promise<Result<LoadedEpic<S>>> {
  type Row = LoadedEpic<S>;
  const select = {
    ...args.select,
    valueStreamId: true,
    ownerId: true,
  } as Prisma.InitiativeSelect;

  return loadAndAuthorize<Row>({
    principal,
    action: args.action,
    resourceType: "Epic",
    id: args.id,
    finder: async () => {
      const row = await db.initiative.findFirst({
        where: {
          id: args.id,
          tenantId: mctx.tenantId,
          level: InitiativeLevel.EPIC,
          deletedAt: null,
        },
        select,
      });
      return (row ?? null) as unknown as Row | null;
    },
    // Scope check uses the loaded Epic's real value stream + owner (ADR-0002):
    // a value_stream-scoped grant may only reach Epics in its own stream.
    toResource: (row) => ({
      tenantId: mctx.tenantId,
      valueStreamId: row.valueStreamId,
      ownerId: row.ownerId,
    }),
  });
}
