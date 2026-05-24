"use server";

import { z } from "zod";
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
import { createServerAction } from "@/server/http/server-action";
import { fields } from "@/server/http/form-data";
import { revalidateFor } from "@/server/http/revalidation";
import type { RequestContext } from "@/server/http/mutation-handler";
import { redirect } from "next/navigation";
import { isErr } from "@/domain/errors";
import type { InitiativeId } from "@/domain/types";

/**
 * FormData-based dependency creation for the global "+" menu — picks both
 * initiatives explicitly. The positional `linkDependencyAction` below stays for
 * the feature-page inline use, where `from` is already known.
 */
export const createDependencyAction = createServerAction({
  describeCreated: (v: { id: string }) => ({ id: v.id, label: "Dependency" }),
  schema: z.object({
    fromId: z.string().uuid(),
    toId: z.string().uuid(),
    type: z.enum(["blocks", "depends_on", "relates_to"]),
  }),
  action: "dependency.link",
  resource: (_input, p) => ({ tenantId: p.tenantId }),
  parseFormData: (fd) => {
    const f = fields(fd);
    return {
      fromId: f.string("fromId"),
      toId: f.string("toId"),
      type: f.string("type"),
    };
  },
  service: (ctx, input) =>
    linkDependency(ctx, {
      fromId: input.fromId as InitiativeId,
      toId: input.toId as InitiativeId,
      type: input.type,
    }),
  revalidate: "dependency",
  mapError: (e) =>
    e.kind === "conflict"
      ? e.reason
      : e.kind === "not_found"
        ? "Initiative not found"
        : "Failed to link dependency",
});

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

  revalidateFor("dependency");
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

  revalidateFor("dependency");
  return {};
}
