import { type NextRequest, NextResponse } from "next/server";
import { processOutbox } from "@/server/outbox/processor";
import { createPrismaClient } from "@/server/db/prisma";
import { makeJiraStoryCreatedHandler } from "@/server/integrations/jira/outbox-handler";
import { makeAdoStoryCreatedHandler } from "@/server/integrations/azure-devops/outbox-handler";

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

  const handlers = {
    "jira.story.created": makeJiraStoryCreatedHandler(db),
    "ado.story.created": makeAdoStoryCreatedHandler(db),
  };

  const result = await processOutbox(db, handlers);

  return NextResponse.json(result);
}
