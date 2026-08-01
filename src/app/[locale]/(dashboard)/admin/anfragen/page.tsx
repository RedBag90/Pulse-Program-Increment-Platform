import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { authorize } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { getOrCreateInvite } from "@/server/services/tenant-invite";
import { listPendingJoinRequests } from "@/server/views/join-requests";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";
import { InviteManager } from "@/features/admin/components/invite-manager";
import { JoinRequestList } from "@/features/admin/components/join-request-list";

/**
 * Beitritts-Anfragen des aktiven Tenants (tenant_admin). Verwaltet den offenen
 * Einladungslink/-Code und genehmigt offene Anfragen. Gate: `tenant.users.manage`
 * (tenant-scoped) — gesperrt, wenn der Principal die Capability nicht hält.
 */
export default async function AnfragenPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");
  if (!authorize("tenant.users.manage", { tenantId: principal.tenantId }, principal).allow) {
    redirect("/start");
  }

  const invite = await getOrCreateInvite(principal);
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const requests = await listPendingJoinRequests(db, principal.tenantId);

  return (
    <Page>
      <PageHeader
        title="Beitritts-Anfragen"
        subtitle="Offener Einladungslink und Beitrittscode für diesen Bereich — plus Freigabe offener Anfragen."
      />

      <PageSection title="Einladungslink & Code">
        <InviteManager
          linkToken={invite.linkToken}
          joinCode={invite.joinCode}
          autoAccept={invite.autoAccept}
          active={invite.active}
        />
      </PageSection>

      <PageSection title={`Offene Anfragen (${requests.length})`}>
        <JoinRequestList requests={requests} />
      </PageSection>
    </Page>
  );
}
