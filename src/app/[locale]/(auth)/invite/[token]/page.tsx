import { verifyInviteToken } from "@/server/services/invitation";
import { isErr } from "@/domain/errors";
import { AcceptInviteForm } from "@/features/admin/components/accept-invite-form";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export default async function AcceptInvitePage({ params }: Props) {
  const { token } = await params;
  const result = await verifyInviteToken(token);

  if (isErr(result)) {
    return (
      <main className="p-8 max-w-md mx-auto">
        <h1 className="text-xl font-semibold mb-4">Invalid invitation</h1>
        <p className="text-red-600 text-sm">
          This invitation link is invalid or has expired. Please ask your admin to send a new one.
        </p>
      </main>
    );
  }

  const { email, role } = result.value;

  return (
    <main className="p-8 max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold">Accept your invitation</h1>
      <p className="text-sm text-muted-foreground">
        You have been invited to join Pulse as <strong>{role}</strong>. Create a password to
        activate your account.
      </p>
      <AcceptInviteForm token={token} email={email} />
    </main>
  );
}
