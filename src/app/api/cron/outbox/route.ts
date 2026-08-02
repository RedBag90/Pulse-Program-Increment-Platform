import { type NextRequest, NextResponse } from "next/server";
import { runOutbox } from "@/server/outbox/run";

// Vercel Cron invokes this route with a secret header (täglicher Sicherheitsnetz-
// Lauf; die eigentliche Zustellung passiert near-instant via after() in
// publishDomainEvent). See vercel.json for the schedule definition.
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

  const result = await runOutbox();
  return NextResponse.json(result);
}
