import { getTranslations } from "next-intl/server";
import { Shield } from "lucide-react";
import { requirePlatformAdmin, platformDb } from "@/server/auth/platform";
import { listAllUsers } from "@/server/views/platform-users";
import { ROLE_LABELS } from "@/modules/core/kernel/domain/roles";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { UserRowActions } from "@/features/platform/components/user-row-actions";

export default async function PlatformUsersPage() {
  const t = await getTranslations();
  const actor = await requirePlatformAdmin();
  const users = await listAllUsers(platformDb(actor.id));

  return (
    <Page>
      <PageHeader
        title={t("platform.page.nutzer")}
        subtitle={t("platform.page.globalesVerzeichnisUeberAlle")}
      />

      <PageSection>
        <p className="text-xs text-muted-foreground">
          {t("platform.page.nutzerAnzahl", { count: users.length })}
        </p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("platform.page.nutzer")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.rollen")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.status")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.letzteAktivitaet")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.angelegt")}</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2">
                    <span className="flex items-center gap-2">
                      {u.isPlatformAdmin && (
                        <Shield
                          className="size-3.5 shrink-0 text-primary"
                          aria-label={t("platform.page.plattformAdmin")}
                        />
                      )}
                      <span className="truncate">{u.email ?? u.id}</span>
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground">
                    {u.roles.length === 0 ? "—" : u.roles.map((r) => ROLE_LABELS[r]).join(", ")}
                  </td>
                  <td className="px-3 py-2">
                    {u.status === "suspended" ? (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 px-2 py-0.5 text-xs font-medium text-amber-600 dark:text-amber-400">
                        {t("platform.page.gesperrt")}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        {t("platform.page.aktiv")}
                      </span>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{u.lastSignInAt ?? "—"}</td>
                  <td className="px-3 py-2 text-muted-foreground">{u.createdAt ?? "—"}</td>
                  <td className="px-3 py-2">
                    <UserRowActions
                      userId={u.id}
                      email={u.email}
                      isPlatformAdmin={u.isPlatformAdmin}
                      status={u.status}
                      isSelf={u.id === actor.id}
                    />
                  </td>
                </tr>
              ))}
              {users.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-3 py-8 text-center text-muted-foreground">
                    {t("platform.page.keineNutzer")}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </PageSection>
    </Page>
  );
}
