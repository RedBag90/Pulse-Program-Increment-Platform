import type { PrismaClient } from "@/generated/prisma";

/**
 * Loader für Beitritts-Anfragen. Zwei Sichten: tenant-scoped (tenant_admin sieht
 * die offenen Anfragen seines aktiven Tenants in `/admin/anfragen`) und
 * cross-tenant read-only (Platform-„Anfragen"-Tab). Reine Aufbereitung.
 */

export interface JoinRequestRow {
  id: string;
  email: string;
  via: string;
  createdAt: string;
}

/** Offene (pending) Anfragen eines Tenants — für die tenant_admin-Genehmigung. */
export async function listPendingJoinRequests(
  db: PrismaClient,
  tenantId: string,
): Promise<JoinRequestRow[]> {
  const rows = await db.tenantJoinRequest.findMany({
    where: { tenantId, status: "pending" },
    orderBy: { createdAt: "asc" },
    select: { id: true, email: true, via: true, createdAt: true },
  });
  return rows.map((r) => ({
    id: r.id,
    email: r.email,
    via: r.via,
    createdAt: r.createdAt.toISOString().slice(0, 10),
  }));
}

export interface PlatformJoinRequestRow extends JoinRequestRow {
  tenantId: string;
  tenantName: string;
  status: string;
}

/** Alle Anfragen tenant-übergreifend (Platform, read-only) inkl. Tenant-Name. */
export async function listAllJoinRequests(db: PrismaClient): Promise<PlatformJoinRequestRow[]> {
  const rows = await db.tenantJoinRequest.findMany({
    orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    take: 500,
    select: {
      id: true,
      tenantId: true,
      email: true,
      via: true,
      status: true,
      createdAt: true,
    },
  });
  const tenantIds = [...new Set(rows.map((r) => r.tenantId))];
  const tenants = await db.tenant.findMany({
    where: { id: { in: tenantIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(tenants.map((t) => [t.id, t.name]));
  return rows.map((r) => ({
    id: r.id,
    tenantId: r.tenantId,
    tenantName: nameById.get(r.tenantId) ?? r.tenantId,
    email: r.email,
    via: r.via,
    status: r.status,
    createdAt: r.createdAt.toISOString().slice(0, 10),
  }));
}
