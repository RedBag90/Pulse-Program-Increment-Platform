import type { PrismaClient } from "@/generated/prisma";
import { sendImpedimentEscalationEmail } from "@/server/email/impediment";
import { createAdminClient } from "@/lib/supabase/admin";
import type { ArtId } from "@/domain/types";
import type { DomainEvent } from "@/server/events/types";

type ImpedimentEscalatedPayload = Extract<DomainEvent, { type: "impediment.escalated" }>;

export function makeImpedimentEscalationHandler(db: PrismaClient) {
  return async (payload: unknown): Promise<void> => {
    const event = payload as ImpedimentEscalatedPayload;
    const { tenantId, artId, title, severity } = event;

    const assignments = await db.userRoleAssignment.findMany({
      where: {
        tenantId,
        role: "rte",
        OR: [{ artIds: { isEmpty: true } }, { artIds: { has: artId } }],
      },
      select: { userId: true },
    });

    if (assignments.length === 0) return;

    const art = await db.art.findFirst({ where: { id: artId }, select: { name: true } });

    const admin = createAdminClient();
    const emails: string[] = [];
    for (const { userId } of assignments) {
      const { data } = await admin.auth.admin.getUserById(userId);
      if (data.user?.email) emails.push(data.user.email);
    }

    await sendImpedimentEscalationEmail({
      rteEmails: emails,
      impedimentTitle: title,
      severity,
      artName: art?.name ?? artId,
      appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
      artId: artId as ArtId,
    });
  };
}
