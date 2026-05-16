import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId, ArtId, ValueStreamId } from "@/domain/types";
import { randomUUID } from "crypto";

export interface SeedResult {
  tenantId: TenantId;
  actorId: UserId;
  artId: ArtId;
  valueStreamId: ValueStreamId;
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
