/**
 * The single soft-delete predicate. Spread into a Prisma `where` to exclude
 * soft-deleted rows: `where: { tenantId, ...notDeleted }`.
 *
 * Every soft-deletable model (Initiative, Value Stream, ART) carries a
 * `deletedAt` column; deletion sets it to a timestamp rather than removing the
 * row. Previously Value Stream and ART used a `__deleted__`-name-prefix hack
 * with a different filter — this helper is the one place that knowledge lives.
 */
export const notDeleted = { deletedAt: null } as const;
