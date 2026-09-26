import { getTranslations } from "next-intl/server";
import { Link } from "@/i18n/navigation";
import { Building2, Lock } from "lucide-react";
import { requirePlatformAdmin, platformDb } from "@/server/auth/platform";
import { listAllTenants, personalWorkspaceSummary } from "@/server/views/platform-tenants";
import { MODULES, type ModuleKey } from "@/modules/core/kernel/domain/modules";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { CreateTenantForm } from "@/features/platform/components/create-tenant-form";
import { TenantStatusBadge } from "@/features/platform/components/tenant-status-badge";

export default async function PlatformTenantsPage() {
  const t = await getTranslations();
  const actor = await requirePlatformAdmin();
  const db = platformDb(actor.id);
  const [tenants, privat] = await Promise.all([listAllTenants(db), personalWorkspaceSummary(db)]);

  return (
    <Page>
      <PageHeader
        title={t("platform.page.tenants")}
        subtitle={t("platform.page.alleOrganisationenTenantUebergreifend")}
        actions={<CreateTenantForm />}
      />

      <PageSection>
        {/* Der Schalter „Private Bereiche einblenden" stand hier bis September
            2026. Er blendete die privaten Bereiche aller Nutzer ein — und von
            dort führte „Mitglied hinzufügen" in jeden davon hinein. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{t("platform.page.organisationenAnzahl", { count: tenants.length })}</span>
          {/* Nur die Zahl. Namen und Mitglieder privater Bereiche gehören nicht
              auf diese Fläche — genau das war das Loch von September 2026. */}
          <span>
            {t("platform.page.privateBereicheAnzahl", { count: privat.total })}
            {privat.empty > 0 && (
              <span> · {t("platform.page.privateBereicheDavonLeer", { count: privat.empty })}</span>
            )}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">{t("platform.page.name")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.status")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.region")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.mitglieder")}</th>
                <th className="px-3 py-2 text-right font-medium">{t("platform.page.inhalt")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.module")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.angelegt")}</th>
                <th className="px-3 py-2 font-medium">{t("platform.page.zuletztAktiv")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((row) => {
                const Icon = row.kind === "personal" ? Lock : Building2;
                return (
                  <tr key={row.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/platform/tenants/${row.id}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden />
                        <span className="truncate">{row.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <TenantStatusBadge status={row.status} />
                    </td>
                    <td className="px-3 py-2 uppercase text-muted-foreground">{row.region}</td>
                    <td className="px-3 py-2 tabular-nums">{row.memberCount}</td>
                    {/* Die Grösse in einem Blick — ohne sie lässt sich nicht
                        entscheiden, welcher Testmandant weg kann. */}
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {row.epicCount + row.featureCount + row.objectiveCount === 0 ? (
                        <span title={t("platform.page.keineVorhabenKeineZiele")}>
                          {t("platform.page.leer")}
                        </span>
                      ) : (
                        <span
                          title={t("platform.page.sizeTooltip", {
                            epics: row.epicCount,
                            features: row.featureCount,
                            goals: row.objectiveCount,
                          })}
                        >
                          {row.epicCount} / {row.featureCount} / {row.objectiveCount}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {row.enabledModules.length === 0
                        ? "—"
                        : row.enabledModules
                            .map((m) => MODULES[m as ModuleKey]?.label ?? m)
                            .join(", ")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{row.createdAt}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {row.lastActivity ?? (
                        <span title={t("platform.page.keinAuditEreignis")}>—</span>
                      )}
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    {t("platform.page.keineTenants")}
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
