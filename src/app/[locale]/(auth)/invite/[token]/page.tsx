import { getTranslations } from "next-intl/server";
import { verifyInviteToken } from "@/server/services/invitation";
import { isErr } from "@/modules/core/kernel/domain/errors";
import { AcceptInviteForm } from "@/features/admin/components/accept-invite-form";

interface Props {
  params: Promise<{ locale: string; token: string }>;
}

export default async function AcceptInvitePage({ params }: Props) {
  const t = await getTranslations();
  const { token } = await params;
  const result = await verifyInviteToken(token);

  if (isErr(result)) {
    return (
      <main className="p-8 max-w-md mx-auto">
        <h1 className="text-xl font-semibold mb-4">{t("auth.page.invalidInvitation")}</h1>
        <p className="text-sm text-destructive">{t("auth.page.thisInvitationLinkIs")}</p>
      </main>
    );
  }

  const { email, role } = result.value;

  return (
    <main className="p-8 max-w-md mx-auto space-y-6">
      <h1 className="text-xl font-semibold">{t("auth.page.acceptYourInvitation")}</h1>
      <p className="text-sm text-muted-foreground">
        {t("auth.page.youHaveBeenInvited")} <strong>{role}</strong>
        {t("auth.page.createAPasswordTo")}
      </p>
      <AcceptInviteForm token={token} email={email} />
    </main>
  );
}
