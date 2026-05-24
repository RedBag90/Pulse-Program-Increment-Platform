-- Manual (out-of-band) database objects that `prisma db push` cannot express.
--
-- Prisma's `@@unique([tenantId, name])` is a FULL unique index. Once ValueStream
-- and Art switched from the `__deleted__`-rename soft-delete to a `deletedAt`
-- column, we need uniqueness only among *active* (non-deleted) rows so a name can
-- be reused after its owner is soft-deleted. Prisma cannot model a partial index
-- (`WHERE deleted_at IS NULL`), so the table-level @@unique was removed from
-- schema.prisma and replaced by the partial unique indexes below.
--
-- `prisma db push` is additive for objects it doesn't know about: it will not
-- drop these indexes on subsequent pushes. Re-create them on a fresh database.
-- Run with the project DB env loaded:
--   set -a; . ./.env.local; set +a
--   psql "$DIRECT_URL" -f prisma/manual-indexes.sql

CREATE UNIQUE INDEX IF NOT EXISTS value_streams_tenant_name_active
  ON value_streams (tenant_id, name)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS arts_tenant_name_active
  ON arts (tenant_id, name)
  WHERE deleted_at IS NULL;
