import { getTranslations } from "next-intl/server";
import { resolveInviteTarget } from "@/server/services/tenant-invite";
import { JoinForm } from "@/features/auth/components/join-form";

/**
 * Öffentliche Beitritts-Seite per Einladungslink (`/join/[token]`). Zeigt den
 * Ziel-Bereich (aus dem aktiven Invite) und braucht nur die E-Mail. Ungültiger
 * / deaktivierter Token ⇒ Hinweis.
 */
export default async function JoinByTokenPage({ params }: { params: Promise<{ token: string }> }) {
  const t = await getTranslations();
  const { token } = await params;
  const target = await resolveInviteTarget({ token });

  if (!target) {
    return (
      <div className="rounded-lg bg-card p-6 text-center shadow-card">
        <h1 className="text-lg font-semibold">{t("auth.page.linkUngueltig")}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("auth.page.dieserEinladungslinkIstUngueltig")}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="text-center">
        <h1 className="text-xl font-semibold">
          {t("auth.page.beitreten")} <span className="text-primary">{target.tenantName}</span>
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">{t("auth.page.gibDeineEMail")}</p>
      </div>
      <JoinForm token={token} />
    </div>
  );
}
