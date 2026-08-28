import type { TenantId, UserId } from "@/modules/core/kernel/domain/types";
import type { Role } from "@/modules/core/kernel/domain/roles";

export type DomainEvent = {
  type: "user.invited";
  tenantId: TenantId;
  actorId: UserId;
  inviteeEmail: string;
  inviterEmail: string;
  tenantName: string;
  role: Role;
  locale: "en" | "de";
  token: string;
};
