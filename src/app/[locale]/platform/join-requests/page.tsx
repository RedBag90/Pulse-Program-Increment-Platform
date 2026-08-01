import { requirePlatformAdmin, platformDb } from "@/server/auth/platform";
import { listAllJoinRequests } from "@/server/views/join-requests";
import { Page } from "@/components/layout/page";
import { PageHeader } from "@/components/layout/page-header";
import { PageSection } from "@/components/layout/page-section";

const STATUS_LABEL: Record<string, string> = {
  pending: "Offen",
  approved: "Freigegeben",
  rejected: "Abgelehnt",
};

/**
 * Platform-„Anfragen"-Tab: cross-tenant Übersicht aller Beitritts-Anfragen,
 * read-only. Die Freigabe erfolgt bewusst beim tenant_admin (`/admin/anfragen`),
 * nicht hier.
 */
export default async function PlatformJoinRequestsPage() {
  const actor = await requirePlatformAdmin();
  const requests = await listAllJoinRequests(platformDb(actor.id));

  return (
    <Page>
      <PageHeader
        title="Anfragen"
        subtitle="Beitritts-Anfragen über alle Tenants (read-only) — Freigabe beim jeweiligen Tenant-Admin."
      />

      <PageSection>
        <p className="text-xs text-muted-foreground">{requests.length} Anfragen</p>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/40 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Tenant</th>
                <th className="px-3 py-2 font-medium">E-Mail</th>
                <th className="px-3 py-2 font-medium">Weg</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Eingegangen</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {requests.map((r) => (
                <tr key={r.id} className="hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium">{r.tenantName}</td>
                  <td className="px-3 py-2">{r.email}</td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {r.via === "link" ? "Link" : "Code"}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">
                    {STATUS_LABEL[r.status] ?? r.status}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{r.createdAt}</td>
                </tr>
              ))}
              {requests.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-3 py-8 text-center text-muted-foreground">
                    Keine Anfragen.
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
