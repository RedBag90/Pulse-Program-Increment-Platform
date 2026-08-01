import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ArtId, ValueStreamId, TimelineId } from "@/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import { randomUUID } from "crypto";
import { MODULE_KEYS } from "@/domain/modules";

export interface SeedResult {
  tenantId: TenantId;
  actorId: UserId;
  artId: ArtId;
  timelineId: TimelineId;
  valueStreamId: ValueStreamId;
}

/**
 * Builds a RequestContext for service-layer tests from a seeded tenant, so
 * tests can call the `(ctx, input)` service functions directly.
 */
export function testRequestContext(
  db: PrismaClient,
  seed: Pick<SeedResult, "tenantId" | "actorId">,
): RequestContext {
  return {
    db,
    principal: {
      id: seed.actorId,
      tenantId: seed.tenantId,
      email: "test@example.com",
      roles: [],
      scopes: { valueStreamIds: [], artIds: [], teamIds: [] },
      // Tests laufen ohne reale Capabilities — Services umgehen die
      // authorize-Gates per Test-Setup, oder die Service-Tests setzen
      // explizit Roles + Capabilities.
      capabilities: [],
      tenantKind: "organization",
      tenantStatus: "active",
      isPlatformAdmin: false,
      enabledModules: MODULE_KEYS,
    },
  };
}

export async function seedTenant(db: PrismaClient): Promise<SeedResult> {
  const tenantId = randomUUID() as TenantId;
  const actorId = randomUUID() as UserId;

  await db.tenant.create({
    data: {
      id: tenantId,
      name: "Test Tenant",
      region: "eu-central-1",
    },
  });

  const valueStream = await db.valueStream.create({
    data: {
      tenantId,
      name: "Test Value Stream",
    },
  });

  const timeline = await db.timeline.create({
    data: {
      tenantId,
      name: "Test Timeline",
    },
  });

  const art = await db.art.create({
    data: {
      tenantId,
      valueStreamId: valueStream.id,
      name: "Test ART",
      timelineId: timeline.id,
    },
  });

  return {
    tenantId,
    actorId,
    artId: art.id as ArtId,
    timelineId: timeline.id as TimelineId,
    valueStreamId: valueStream.id as ValueStreamId,
  };
}
