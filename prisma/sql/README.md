# Raw SQL Migrations

These files contain SQL that cannot be expressed in the Prisma schema and must be applied manually after the Prisma-generated migration.

## Order of application

```
1. pnpm prisma migrate dev --name initial    # generates prisma/migrations/…/migration.sql from schema.prisma
2. psql $DATABASE_URL -f prisma/sql/invariants.sql   # CHECK constraints + triggers
3. psql $DATABASE_URL -f prisma/sql/rls.sql          # Row-Level Security policies
```

## Files

| File             | Contents                                                                                                                        |
| ---------------- | ------------------------------------------------------------------------------------------------------------------------------- |
| `invariants.sql` | 10 CHECK constraints enforcing the SAFe hierarchy invariants (I1–I10) + two trigger functions (self-cycle, cross-tenant parent) |
| `rls.sql`        | RLS enabled on all tenant-scoped tables + tenant-isolation policies + audit log append-only policy + task-owner update policy   |

## How RLS works in this project

These RLS policies are **currently inert** for the application connection: RLS is
`ENABLE`d but **not `FORCE`d**, and the app connects as the table **owner**, which
bypasses non-forced RLS. Tenant isolation is therefore enforced at the **application
layer** — every service scopes its queries by `tenantId` in the `where` clause, plus
the platform-admin gate (see `src/server/db/prisma.ts`).

Historically the Prisma client wrapped every query in `set_config('request.jwt.claims',
…, true)` so these policies *could* read the claim via `current_setting()`. That was
removed for performance (it turned every read into a multi-statement transaction). **If
RLS is ever hardened** — `FORCE ROW LEVEL SECURITY` + a dedicated non-owner app role —
the per-request `request.jwt.claims` mechanism must be restored, or all reads return
empty. Until then these policies are defense-in-depth that does not gate the owner
connection.
