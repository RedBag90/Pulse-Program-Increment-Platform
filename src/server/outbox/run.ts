import { processOutbox } from "@/server/outbox/processor";
import { createPrismaClient } from "@/server/db/prisma";
import { makeJiraStoryCreatedHandler } from "@/server/integrations/jira/outbox-handler";
import { makeAdoStoryCreatedHandler } from "@/server/integrations/azure-devops/outbox-handler";
import { makeImpedimentEscalationHandler } from "@/server/integrations/impediment/outbox-handler";
import { makeUserInvitedHandler } from "@/server/integrations/email/invite-handler";
import type { OutboxEventType } from "@/server/events/publish";

/**
 * Leert die Outbox einmal: baut den System-Prisma-Client (kein per-User-RLS für
 * Hintergrund-Jobs) + die vollständige Handler-Registry und ruft
 * `processOutbox`. Geteilt von zwei Auslösern:
 *  - dem täglichen Vercel-Cron (`/api/cron/outbox`) als Sicherheitsnetz und
 *  - dem Inline-`after()`-Drain in `publishDomainEvent` (near-instant nach jeder
 *    Aktion, die ein Event schreibt — Vercel Hobby erlaubt keinen Minuten-Cron).
 *
 * Die `Record<OutboxEventType, …>`-Registry ist exhaustiv: ein neuer
 * Outbox-Typ ohne Handler ist ein Compile-Fehler, kein stiller Skip.
 */
export async function runOutbox(): Promise<{
  processed: number;
  failed: number;
  skipped: number;
}> {
  const db = createPrismaClient({ userId: "system", tenantId: "system" } as never);

  const handlers: Record<OutboxEventType, (payload: unknown) => Promise<void>> = {
    "jira.story.created": makeJiraStoryCreatedHandler(db),
    "ado.story.created": makeAdoStoryCreatedHandler(db),
    "notification.impediment.escalated": makeImpedimentEscalationHandler(db),
    "email.user.invited": makeUserInvitedHandler(),
  };

  return processOutbox(db, handlers);
}
