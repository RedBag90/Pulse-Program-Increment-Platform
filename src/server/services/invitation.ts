import { SignJWT, jwtVerify } from "jose";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import type { Role } from "@/domain/roles";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { publishDomainEvent } from "@/server/events/publish";
import type { RequestContext } from "@/server/http/mutation-handler";
import {
  withAuditedTransaction,
  toMutationContext,
  onUniqueConstraint,
  type MutationContext,
} from "@/server/services/mutation";

const INVITE_EXPIRY_DAYS = 7;
const INVITE_AUDIENCE = "pulse:invite";

export interface InviteUserInput {
  tenantName: string;
  inviterEmail: string;
  inviteeEmail: string;
  role: Role;
  locale: "en" | "de";
}

export interface InviteClaims {
  email: string;
  tenantId: TenantId;
  role: Role;
}

function getSecret(): Uint8Array {
  const secret = process.env.INVITE_JWT_SECRET;
  if (!secret) throw new Error("INVITE_JWT_SECRET must be set");
  return new TextEncoder().encode(secret);
}

export function buildAcceptUrl(token: string): string {
  const base = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  return `${base}/invite/${token}`;
}

export async function signInviteToken(claims: InviteClaims): Promise<string> {
  return new SignJWT({ email: claims.email, tenantId: claims.tenantId, role: claims.role })
    .setProtectedHeader({ alg: "HS256" })
    .setAudience(INVITE_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(`${INVITE_EXPIRY_DAYS}d`)
    .sign(getSecret());
}

export async function verifyInviteToken(token: string): Promise<Result<InviteClaims>> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { audience: INVITE_AUDIENCE });
    const email = payload["email"];
    const tenantId = payload["tenantId"];
    const role = payload["role"];

    if (typeof email !== "string" || typeof tenantId !== "string" || typeof role !== "string") {
      return err({ kind: "validation", issues: ["malformed invite token"] });
    }

    return ok({ email, tenantId: tenantId as TenantId, role: role as Role });
  } catch {
    return err({ kind: "validation", issues: ["invalid or expired invite token"] });
  }
}

/**
 * Signs an invite JWT, queues the invitation email (via the outbox), and emits
 * an audit event — the email and audit row commit in one transaction.
 */
export async function inviteUser(
  ctx: RequestContext,
  input: InviteUserInput,
): Promise<Result<{ token: string }>> {
  const mctx = toMutationContext(ctx);

  const token = await signInviteToken({
    email: input.inviteeEmail,
    tenantId: mctx.tenantId,
    role: input.role,
  });

  return withAuditedTransaction(mctx, async (tx) => {
    await publishDomainEvent(tx, {
      type: "user.invited",
      tenantId: mctx.tenantId,
      actorId: mctx.actorId,
      inviteeEmail: input.inviteeEmail,
      inviterEmail: input.inviterEmail,
      tenantName: input.tenantName,
      role: input.role,
      locale: input.locale,
      token,
    });

    return ok({
      result: { token },
      audit: {
        action: "user.invited",
        resourceType: "user_role_assignment",
        resourceId: input.inviteeEmail,
        changes: {
          email: { before: null, after: input.inviteeEmail },
          role: { before: null, after: input.role },
        },
      },
    });
  });
}

/**
 * Accepts an invite by inserting the role assignment for a freshly created
 * Supabase user. The acceptor has no role assignment yet, so this runs without
 * a RequestContext — the tenant + actor come from the verified invite token.
 */
export async function acceptInvitation(
  db: PrismaClient,
  input: {
    token: string;
    userId: UserId;
    ipAddress?: string | undefined;
    userAgent?: string | undefined;
  },
): Promise<Result<void>> {
  const claimsResult = await verifyInviteToken(input.token);
  if (!claimsResult.ok) return claimsResult;

  const { tenantId, role, email } = claimsResult.value;

  const mctx: MutationContext = {
    db,
    tenantId,
    actorId: input.userId,
    ...(input.ipAddress !== undefined && { ipAddress: input.ipAddress }),
    ...(input.userAgent !== undefined && { userAgent: input.userAgent }),
  };

  return withAuditedTransaction(
    mctx,
    async (tx) => {
      await tx.userRoleAssignment.create({
        data: {
          userId: input.userId,
          tenantId,
          role,
          valueStreamIds: [],
          artIds: [],
          teamIds: [],
        },
      });

      return ok({
        result: undefined,
        audit: {
          action: "user.role.assigned",
          resourceType: "user_role_assignment",
          resourceId: input.userId,
          changes: {
            email: { before: null, after: email },
            role: { before: null, after: role },
          },
        },
      });
    },
    { onPrismaError: onUniqueConstraint("User already has this role in the tenant") },
  );
}
