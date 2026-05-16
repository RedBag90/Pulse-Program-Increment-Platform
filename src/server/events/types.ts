import type { TenantId, UserId, StoryId, ArtId } from "@/domain/types";
import type { ImpedimentId } from "@/server/services/impediment";
import type { Role } from "@/domain/roles";

export type DomainEvent =
  | {
      type: "story.created";
      tenantId: TenantId;
      storyId: StoryId;
      artId: ArtId;
      title: string;
      description: string | null;
      storyPoints: number | null;
    }
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
