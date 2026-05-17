"use server";

import { headers } from "next/headers";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { extractRequestMeta } from "@/server/audit/emit";
import {
  linkDependency,
  unlinkDependency,
  type DependencyType,
} from "@/server/services/dependency";
import type { RequestContext } from "@/server/http/mutation-handler";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { isErr } from "@/domain/errors";
import type { InitiativeId } from "@/domain/types";

/** Builds a RequestContext for service calls from the resolved principal. */
async function buildContext(
  principal: Awaited<ReturnType<typeof requirePrincipal>>,
): Promise<RequestContext> {
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const { ipAddress, userAgent } = extractRequestMeta(await headers());
  return {
    principal,
    db,
    ...(ipAddress !== undefined && { ipAddress }),
    ...(userAgent !== undefined && { userAgent }),
  };
}

function mapError(result: { error: { kind: string; reason?: string } }): string {
  return result.error.kind === "conflict"
    ? (result.error.reason ?? "Conflict")
    : result.error.kind === "not_found"
      ? "Initiative not found"
      : "Failed to update dependency";
}

export async function linkDependencyAction(
  fromId: string,
  toId: string,
  type: DependencyType,
  artId: string,
): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("dependency.link", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const ctx = await buildContext(principal);
  const result = await linkDependency(ctx, {
    fromId: fromId as InitiativeId,
    toId: toId as InitiativeId,
    type,
  });

  if (isErr(result)) return { error: mapError(result) };

  revalidatePath("/feature/[featureId]", "page");
  revalidatePath("/pi/[piId]/dependencies", "page");
  return {};
}

export async function unlinkDependencyAction(
  fromId: string,
  toId: string,
  type: DependencyType,
  artId: string,
): Promise<{ error?: string }> {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  if (!authorize("dependency.unlink", { tenantId: principal.tenantId, artId }, principal).allow) {
    return { error: "Insufficient permissions" };
  }

  const ctx = await buildContext(principal);
  const result = await unlinkDependency(ctx, {
    fromId: fromId as InitiativeId,
    toId: toId as InitiativeId,
    type,
  });

  if (isErr(result)) return { error: mapError(result) };

  revalidatePath("/feature/[featureId]", "page");
  revalidatePath("/pi/[piId]/dependencies", "page");
  return {};
}
