import { SignJWT, jwtVerify } from "jose";
import type { PrismaClient } from "@/generated/prisma";
import type { TenantId, UserId } from "@/domain/types";
import type { Role } from "@/domain/roles";
import type { Result } from "@/domain/errors";
import { ok, err } from "@/domain/errors";
import { emitAuditEvent } from "@/server/audit/emit";
import { sendEmail } from "@/server/email/send";
import { renderInviteEmail } from "@/server/email/templates/invite";

const INVITE_EXPIRY_DAYS = 7;
const INVITE_AUDIENCE = "pulse:invite";

export interface InviteUserInput {
  tenantId: TenantId;
  tenantName: string;
  inviterEmail: string;
  actorId: UserId;
  inviteeEmail: string;
  role: Role;
  locale: "en" | "de";
  ipAddress?: string | undefined;
  userAgent?: string | undefined;
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
 * Signs an invite JWT, sends the invitation email, and emits an audit event.
 */
export async function inviteUser(
  db: PrismaClient,
  input: InviteUserInput,
): Promise<Result<{ token: string }>> {
  const token = await signInviteToken({
    email: input.inviteeEmail,
    tenantId: input.tenantId,
    role: input.role,
  });

  const acceptUrl = buildAcceptUrl(token);
  const { subject, html, text } = renderInviteEmail(input.locale, {
    tenantName: input.tenantName,
    inviterEmail: input.inviterEmail,
    role: input.role,
    acceptUrl,
    expiresInDays: INVITE_EXPIRY_DAYS,
  });

  await sendEmail({ to: input.inviteeEmail, subject, html, text });

  await emitAuditEvent(db, {
    tenantId: input.tenantId,
    actorId: input.actorId,
    action: "user.invited",
    resourceType: "user_role_assignment",
    resourceId: input.inviteeEmail,
    ipAddress: input.ipAddress,
    userAgent: input.userAgent,
    changes: {
      email: { before: null, after: input.inviteeEmail },
      role: { before: null, after: input.role },
    },
  });

  return ok({ token });
}

/**
 * Accepts an invite by creating a Supabase user account (via Supabase Admin API)
 * and inserting the role assignment in the same Prisma transaction.
 *
 * Note: The actual Supabase signUp is handled by the client accept-invitation page
 * using the invite token directly. This service validates the token and creates
 * the role assignment once the Supabase user exists.
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

  return db
    .$transaction(async (tx) => {
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

      await emitAuditEvent(tx as unknown as PrismaClient, {
        tenantId,
        actorId: input.userId,
        action: "user.role.assigned",
        resourceType: "user_role_assignment",
        resourceId: input.userId,
        ipAddress: input.ipAddress,
        userAgent: input.userAgent,
        changes: { email: { before: null, after: email }, role: { before: null, after: role } },
      });

      return ok(undefined);
    })
    .catch((e: unknown) => {
      const message = e instanceof Error ? e.message : String(e);
      if (message.includes("Unique constraint")) {
        return err({
          kind: "conflict" as const,
          reason: "User already has this role in the tenant",
        });
      }
      throw e;
    });
}
