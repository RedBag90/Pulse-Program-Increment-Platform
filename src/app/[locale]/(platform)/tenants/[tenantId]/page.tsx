import { notFound } from "next/navigation";
import { ArrowLeft, Building2, Lock } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requirePlatformAdmin, platformDb } from "@/server/auth/platform";
import { loadTenantDetail } from "@/server/views/platform-tenants";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { TenantModulesEditor } from "@/features/platform/components/tenant-modules-editor";
import { TenantMembers } from "@/features/platform/components/tenant-members";
import { TenantStatusBadge } from "@/features/platform/components/tenant-status-badge";
import { TenantLifecycleControls } from "@/features/platform/components/tenant-lifecycle-controls";

interface PageProps {
  params: Promise<{ tenantId: string }>;
}

export default async function PlatformTenantDetailPage({ params }: PageProps) {
  const actor = await requirePlatformAdmin();
  const { tenantId } = await params;
  const detail = await loadTenantDetail(platformDb(actor.id), tenantId);
  if (!detail) notFound();

  const Icon = detail.kind === "personal" ? Lock : Building2;

  return (
    <Page>
      <PageHeader
        breadcrumb={
          <Link
            href="/platform/tenants"
            className="inline-flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ArrowLeft className="size-3" aria-hidden />
            Alle Tenants
          </Link>
        }
        eyebrow={<TenantStatusBadge status={detail.status} />}
        title={
          <span className="flex items-center gap-2">
            <Icon className="size-5 shrink-0 opacity-60" aria-hidden />
            {detail.name}
          </span>
        }
        subtitle={`${detail.kind === "personal" ? "Privater Bereich" : "Organisation"} · Region ${detail.region.toUpperCase()} · angelegt ${detail.createdAt}`}
      />

      <PageSection title="Module">
        <TenantModulesEditor tenantId={detail.id} enabledModules={detail.enabledModules} />
      </PageSection>

      <PageSection title="Mitglieder">
        <TenantMembers tenantId={detail.id} members={detail.members} />
      </PageSection>

      {detail.kind !== "personal" && (
        <PageSection title="Lifecycle">
          <TenantLifecycleControls tenantId={detail.id} status={detail.status} name={detail.name} />
        </PageSection>
      )}
    </Page>
  );
}
