import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { AuditLogTable } from "@/features/admin/components/audit-log-table";
import { Page, PageHeader, PageSection } from "@/components/layout";
import { redirect } from "next/navigation";

interface Props {
  searchParams: Promise<{
    actor?: string;
    action?: string;
    resourceType?: string;
    from?: string;
    to?: string;
    cursor?: string;
  }>;
}

const PAGE_SIZE = 50;

export default async function AuditLogPage({ searchParams }: Props) {
  const params = await searchParams;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!hasCapability(principal, "admin.audit-log.read")) {
    redirect("/portfolio");
  }

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const where = {
    tenantId: principal.tenantId,
    ...(params.actor && { actorId: params.actor }),
    ...(params.action && { action: params.action }),
    ...(params.resourceType && { resourceType: params.resourceType }),
    ...((params.from ?? params.to) && {
      occurredAt: {
        ...(params.from && { gte: new Date(params.from) }),
        ...(params.to && { lte: new Date(params.to) }),
      },
    }),
  };

  const events = await db.auditEvent.findMany({
    where,
    orderBy: { occurredAt: "desc" },
    take: PAGE_SIZE + 1,
    ...(params.cursor && { cursor: { id: params.cursor }, skip: 1 }),
  });

  const hasNextPage = events.length > PAGE_SIZE;
  const rows = hasNextPage ? events.slice(0, PAGE_SIZE) : events;
  const nextCursor = hasNextPage ? rows[rows.length - 1]?.id : undefined;

  return (
    <Page>
      <PageHeader title="Audit Log" />

      {/* Filters */}
      <form method="get" data-tour="audit-log-filter" className="flex flex-wrap gap-3 text-sm">
        <input
          name="actor"
          defaultValue={params.actor}
          placeholder="Actor user ID"
          className="w-64 rounded-md border border-input bg-background px-3 py-1.5 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          name="action"
          defaultValue={params.action}
          placeholder="Action (e.g. initiative.created)"
          className="w-64 rounded-md border border-input bg-background px-3 py-1.5 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          name="resourceType"
          defaultValue={params.resourceType}
          placeholder="Resource type"
          className="w-48 rounded-md border border-input bg-background px-3 py-1.5 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          name="from"
          type="date"
          defaultValue={params.from}
          className="rounded-md border border-input bg-background px-3 py-1.5 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <input
          name="to"
          type="date"
          defaultValue={params.to}
          className="rounded-md border border-input bg-background px-3 py-1.5 focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
        />
        <button
          type="submit"
          className="rounded-md bg-primary px-4 py-1.5 text-primary-foreground hover:bg-primary/90"
        >
          Filter
        </button>
        <a href="?" className="rounded-md border px-4 py-1.5 hover:bg-muted/50">
          Clear
        </a>
      </form>

      <PageSection>
        <AuditLogTable
          events={rows.map((e) => ({
            id: e.id,
            occurredAt: e.occurredAt.toISOString(),
            actorId: e.actorId,
            action: e.action,
            resourceType: e.resourceType,
            resourceId: e.resourceId,
            changes: e.changes ?? null,
            traceId: e.traceId ?? null,
          }))}
        />

        {/* Pagination */}
        <div className="flex justify-between text-sm">
          {params.cursor && (
            <a href="?" className="text-primary hover:underline">
              ← First page
            </a>
          )}
          {nextCursor && (
            <a
              href={`?${new URLSearchParams({ ...params, cursor: nextCursor }).toString()}`}
              className="text-primary hover:underline ml-auto"
            >
              Next page →
            </a>
          )}
        </div>
      </PageSection>
    </Page>
  );
}
