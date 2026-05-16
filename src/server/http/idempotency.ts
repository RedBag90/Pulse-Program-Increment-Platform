import { createHash } from "crypto";
import type { Principal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { problemJson } from "@/server/http/problem";

/**
 * Wraps a mutation Route Handler with idempotency-key handling (concept §8.4).
 *
 * - Requires an `Idempotency-Key` header — 400 if missing.
 * - On a repeated key with the same request body, replays the stored response.
 * - On a repeated key with a *different* body, returns 409 (key reuse).
 * - Otherwise runs the handler and persists the response for future replays.
 *
 * The handler receives a fresh `Request` whose body can still be read, since
 * this wrapper consumes the original request's body to hash it.
 */
export async function withIdempotency(
  req: Request,
  principal: Principal,
  handler: (req: Request) => Promise<Response>,
): Promise<Response> {
  const key = req.headers.get("Idempotency-Key");
  if (!key) return problemJson(400, "idempotency-key-required");

  const bodyText = await req.text();
  const requestHash = createHash("sha256")
    .update(`${req.method} ${req.url}\n${bodyText}`)
    .digest("hex");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const existing = await db.idempotencyKey.findUnique({
    where: { tenantId_key: { tenantId: principal.tenantId, key } },
  });

  if (existing) {
    if (existing.requestHash !== requestHash) {
      return problemJson(409, "conflict", {
        detail: "Idempotency-Key was already used with a different request body",
      });
    }
    return new Response(existing.responseBody.length > 0 ? existing.responseBody : null, {
      status: existing.responseStatus,
      headers: { "Content-Type": "application/json" },
    });
  }

  const freshReq = new Request(req.url, {
    method: req.method,
    headers: req.headers,
    body: bodyText.length > 0 ? bodyText : null,
  });

  const res = await handler(freshReq);

  // Persist only successful mutations so a failed attempt can be retried.
  if (res.status >= 200 && res.status < 300) {
    const responseBody = await res.clone().text();
    await db.idempotencyKey
      .create({
        data: {
          tenantId: principal.tenantId,
          key,
          requestHash,
          responseStatus: res.status,
          responseBody,
        },
      })
      .catch(() => undefined); // ignore races — a concurrent request stored it first
  }

  return res;
}
