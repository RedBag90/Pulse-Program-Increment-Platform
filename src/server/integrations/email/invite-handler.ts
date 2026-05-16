import { sendEmail } from "@/server/email/send";
import { renderInviteEmail } from "@/server/email/templates/invite";
import { buildAcceptUrl } from "@/server/services/invitation";
import type { DomainEvent } from "@/server/events/types";

type UserInvitedPayload = Extract<DomainEvent, { type: "user.invited" }>;

const INVITE_EXPIRY_DAYS = 7;

export function makeUserInvitedHandler() {
  return async (payload: unknown): Promise<void> => {
    const event = payload as UserInvitedPayload;
    const { inviteeEmail, inviterEmail, tenantName, role, locale, token } = event;

    const acceptUrl = buildAcceptUrl(token);
    const { subject, html, text } = renderInviteEmail(locale, {
      tenantName,
      inviterEmail,
      role,
      acceptUrl,
      expiresInDays: INVITE_EXPIRY_DAYS,
    });

    await sendEmail({ to: inviteeEmail, subject, html, text });
  };
}
