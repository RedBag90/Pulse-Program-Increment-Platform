import { type NextRequest, NextResponse } from "next/server";
import { processOutbox } from "@/server/outbox/processor";
import { createPrismaClient } from "@/server/db/prisma";
import { makeJiraStoryCreatedHandler } from "@/server/integrations/jira/outbox-handler";
import { makeAdoStoryCreatedHandler } from "@/server/integrations/azure-devops/outbox-handler";
import { makeImpedimentEscalationHandler } from "@/server/integrations/impediment/outbox-handler";
import { makeUserInvitedHandler } from "@/server/integrations/email/invite-handler";
import type { OutboxEventType } from "@/server/events/publish";

// Vercel Cron invokes this route with a secret header.
// See vercel.json for the schedule definition.
function isAuthorized(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // System-level client: no per-user RLS context for background jobs.
  const db = createPrismaClient({ userId: "system", tenantId: "system" } as never);

  // The Record type requires every OutboxEventType key to be present.
  // Adding a new DomainEvent in OUTBOX_ROUTES without registering a handler here
  // is a compile error.
  const handlers: Record<OutboxEventType, (payload: unknown) => Promise<void>> = {
    "jira.story.created": makeJiraStoryCreatedHandler(db),
    "ado.story.created": makeAdoStoryCreatedHandler(db),
    "notification.impediment.escalated": makeImpedimentEscalationHandler(db),
    "email.user.invited": makeUserInvitedHandler(),
  };

  const result = await processOutbox(db, handlers);

  return NextResponse.json(result);
}
