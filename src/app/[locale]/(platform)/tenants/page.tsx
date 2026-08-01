import { Link } from "@/i18n/navigation";
import { Building2, Lock } from "lucide-react";
import { requirePlatformAdmin, platformDb } from "@/server/auth/platform";
import { listAllTenants } from "@/server/views/platform-tenants";
import { MODULES, type ModuleKey } from "@/domain/modules";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { CreateTenantForm } from "@/features/platform/components/create-tenant-form";

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function PlatformTenantsPage({ searchParams }: PageProps) {
  const actor = await requirePlatformAdmin();
  const params = await searchParams;
  const includePersonal = params.personal === "1";

  const tenants = await listAllTenants(platformDb(actor.id), { includePersonal });

  return (
    <Page>
      <PageHeader
        title="Tenants"
        subtitle="Alle Organisationen tenant-übergreifend verwalten."
        actions={<CreateTenantForm />}
      />

      <PageSection>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-muted-foreground">{tenants.length} Tenants</span>
          <Link
            href={includePersonal ? "/platform/tenants" : "/platform/tenants?personal=1"}
            className="rounded-md border px-2.5 py-1 transition-colors hover:bg-muted"
          >
            {includePersonal ? "Nur Organisationen" : "Private Bereiche einblenden"}
          </Link>
        </div>

        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Region</th>
                <th className="px-3 py-2 font-medium">Mitglieder</th>
                <th className="px-3 py-2 font-medium">Module</th>
                <th className="px-3 py-2 font-medium">Angelegt</th>
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
                    <td className="px-3 py-2 uppercase text-muted-foreground">{t.region}</td>
                    <td className="px-3 py-2 tabular-nums">{t.memberCount}</td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {t.enabledModules.length === 0
                        ? "—"
                        : t.enabledModules
                            .map((m) => MODULES[m as ModuleKey]?.label ?? m)
                            .join(", ")}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{t.createdAt}</td>
                  </tr>
                );
              })}
              {tenants.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
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
