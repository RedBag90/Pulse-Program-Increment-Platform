import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ArtId, ValueStreamId } from "@/domain/types";
import type { RequestContext } from "@/server/http/mutation-handler";
import { randomUUID } from "crypto";

export interface SeedResult {
  tenantId: TenantId;
  actorId: UserId;
  artId: ArtId;
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

  const art = await db.art.create({
    data: {
      tenantId,
      valueStreamId: valueStream.id,
      name: "Test ART",
    },
  });

  return {
    tenantId,
    actorId,
    artId: art.id as ArtId,
    valueStreamId: valueStream.id as ValueStreamId,
  };
}
