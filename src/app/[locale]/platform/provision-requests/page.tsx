import { requirePlatformAdmin, platformDb } from "@/server/auth/platform";
import { listProvisionRequests } from "@/server/services/tenant-provision";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { ProvisionRequestList } from "@/features/platform/components/provision-request-list";

/**
 * Platform-„Tenant-Anfragen"-Tab: Provisioning-Anträge für neue Organisationen.
 * Genehmigen legt den Tenant an und lädt den Antragsteller als tenant_admin ein.
 */
export default async function PlatformProvisionRequestsPage() {
  const actor = await requirePlatformAdmin();
  const requests = await listProvisionRequests(platformDb(actor.id));
  const pending = requests.filter((r) => r.status === "pending").length;

  return (
    <Page>
      <PageHeader
        title="Tenant-Anfragen"
        subtitle="Provisioning-Anträge für neue Organisationen — genehmigen legt den Tenant an und lädt den Antragsteller ein."
      />
      <PageSection title={`Offen (${pending})`}>
        <ProvisionRequestList requests={requests} />
      </PageSection>
    </Page>
  );
}
