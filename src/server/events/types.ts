import type { TenantId, UserId, ArtId } from "@/domain/types";
import type { ImpedimentId } from "@/server/services/impediment";
import type { Role } from "@/domain/roles";

export type DomainEvent =
  | {
      type: "impediment.escalated";
      tenantId: TenantId;
      impedimentId: ImpedimentId;
      artId: ArtId;
      title: string;
      severity: string;
    }
  | {
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
