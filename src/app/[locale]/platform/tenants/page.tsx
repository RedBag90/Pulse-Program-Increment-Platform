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
  const actor = await requirePlatformAdmin();
  const db = platformDb(actor.id);
  const [tenants, privat] = await Promise.all([listAllTenants(db), personalWorkspaceSummary(db)]);

  return (
    <Page>
      <PageHeader
        title="Tenants"
        subtitle="Alle Organisationen tenant-übergreifend verwalten."
        actions={<CreateTenantForm />}
      />

      <PageSection>
        {/* Der Schalter „Private Bereiche einblenden" stand hier bis September
            2026. Er blendete die privaten Bereiche aller Nutzer ein — und von
            dort führte „Mitglied hinzufügen" in jeden davon hinein. */}
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
          <span>{tenants.length} Organisationen</span>
          {/* Nur die Zahl. Namen und Mitglieder privater Bereiche gehören nicht
              auf diese Fläche — genau das war das Loch von September 2026. */}
          <span>
            {privat.total} private Bereiche
            {privat.empty > 0 && <span> · {privat.empty} davon leer</span>}
          </span>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Region</th>
                <th className="px-3 py-2 font-medium">Mitglieder</th>
                <th className="px-3 py-2 text-right font-medium">Inhalt</th>
                <th className="px-3 py-2 font-medium">Module</th>
                <th className="px-3 py-2 font-medium">Angelegt</th>
                <th className="px-3 py-2 font-medium">Zuletzt aktiv</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {tenants.map((t) => {
                const Icon = t.kind === "personal" ? Lock : Building2;
                return (
                  <tr key={t.id} className="hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/platform/tenants/${t.id}`}
                        className="flex items-center gap-2 font-medium hover:underline"
                      >
                        <Icon className="size-3.5 shrink-0 opacity-60" aria-hidden />
                        <span className="truncate">{t.name}</span>
                      </Link>
                    </td>
                    <td className="px-3 py-2">
                      <TenantStatusBadge status={t.status} />
                    </td>
                    <td className="px-3 py-2 uppercase text-muted-foreground">{t.region}</td>
                    <td className="px-3 py-2 tabular-nums">{t.memberCount}</td>
                    {/* Die Grösse in einem Blick — ohne sie lässt sich nicht
                        entscheiden, welcher Testmandant weg kann. */}
                    <td className="px-3 py-2 text-right text-xs tabular-nums text-muted-foreground">
                      {t.epicCount + t.featureCount + t.objectiveCount === 0 ? (
                        <span title="Keine Vorhaben, keine Ziele">leer</span>
                      ) : (
                        <span
                          title={`${t.epicCount} Epics · ${t.featureCount} Features · ${t.objectiveCount} Ziele`}
                        >
                          {t.epicCount} / {t.featureCount} / {t.objectiveCount}
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {t.enabledModules.length === 0
                        ? "—"
                        : t.enabledModules
                            .map((m) => MODULES[m as ModuleKey]?.label ?? m)
                            .join(", ")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.createdAt}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {t.lastActivity ?? <span title="Kein Audit-Ereignis">—</span>}
                    </td>
                  </tr>
                );
              })}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-3 py-8 text-center text-muted-foreground">
                    Keine Tenants.
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
