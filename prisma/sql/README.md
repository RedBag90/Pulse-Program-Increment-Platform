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

The Prisma client in `src/server/db/prisma.ts` calls `set_config('request.jwt.claims', …, true)` before every query. This makes the JWT claims available to PostgreSQL's `current_setting()` function inside RLS policies, replicating what Supabase's GoTrue does when the request goes through PostgREST.

The `true` parameter makes the setting local to the current transaction, so it is automatically reset when the transaction ends.
