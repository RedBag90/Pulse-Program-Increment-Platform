import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { TenantId } from "@/domain/types";
import { JiraProjectMapForm } from "@/features/integrations/components/jira-project-map-form";
import { DisconnectJiraButton } from "@/features/integrations/components/disconnect-jira-button";
import { ConnectJiraButton } from "@/features/integrations/components/connect-jira-button";
import { AdoProjectMapForm } from "@/features/integrations/components/ado-project-map-form";
import { DisconnectAdoButton } from "@/features/integrations/components/disconnect-ado-button";
import { ConnectAdoButton } from "@/features/integrations/components/connect-ado-button";

interface Props {
  searchParams: Promise<{ connected?: string; error?: string }>;
}

export default async function IntegrationsPage({ searchParams }: Props) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const canManage =
    principal.roles.includes("tenant_admin") || principal.roles.includes("platform_admin");
  if (!canManage) redirect("/portfolio");

  const { connected, error } = await searchParams;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const [jiraConfig, adoConfig, arts] = await Promise.all([
    db.jiraConfig.findUnique({ where: { tenantId: principal.tenantId as TenantId } }),
    db.azureDevOpsConfig.findUnique({ where: { tenantId: principal.tenantId as TenantId } }),
    db.art.findMany({
      where: { tenantId: principal.tenantId },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
  ]);

  const projectKeyMap =
    jiraConfig && typeof jiraConfig.projectKeyMap === "object" && jiraConfig.projectKeyMap !== null
      ? (jiraConfig.projectKeyMap as Record<string, string>)
      : {};

  const adoProjectMap =
    adoConfig && typeof adoConfig.projectMap === "object" && adoConfig.projectMap !== null
      ? (adoConfig.projectMap as Record<string, string>)
      : {};

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "";
  const jiraWebhookUrl = `${appUrl}/api/integrations/jira/webhook?tenantId=${principal.tenantId}`;
  const adoWebhookUrl = `${appUrl}/api/integrations/azure-devops/webhook?tenantId=${principal.tenantId}`;

  return (
    <main className="p-8 max-w-3xl mx-auto space-y-10">
      <div>
        <nav className="text-sm text-muted-foreground mb-2">
          <Link href="/admin/users" className="hover:underline">
            Admin
          </Link>
          <span className="mx-1">/</span>
          <span className="text-foreground">Integrations</span>
        </nav>
        <h1 className="text-2xl font-bold text-foreground">Integrations</h1>
      </div>

      {connected === "1" && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-sm text-green-800">
          Jira connected successfully.
        </div>
      )}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg px-4 py-3 text-sm text-red-800">
          Error: {error}
        </div>
      )}

      {/* Jira Cloud */}
      <section className="border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center text-white font-bold text-sm">
              J
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Jira Cloud</h2>
              <p className="text-xs text-muted-foreground">Bidirectional story sync</p>
            </div>
          </div>

          {jiraConfig ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Connected
              </span>
              <DisconnectJiraButton />
            </div>
          ) : (
            <ConnectJiraButton />
          )}
        </div>

        {jiraConfig && (
          <>
            <div className="text-sm text-muted-foreground space-y-1">
              <p>
                <span className="font-medium">Instance:</span>{" "}
                <a
                  href={jiraConfig.instanceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {jiraConfig.instanceUrl}
                </a>
              </p>
              <p>
                <span className="font-medium">Cloud ID:</span>{" "}
                <span className="font-mono text-xs">{jiraConfig.cloudId}</span>
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">ART → Project Mapping</h3>
              <JiraProjectMapForm arts={arts} currentMap={projectKeyMap} />
            </div>

            <div className="border-t pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Webhook Setup</h3>
              <p className="text-xs text-muted-foreground">
                Register this URL in Jira (Project Settings → Webhooks) to receive status updates:
              </p>
              <code className="block bg-muted/50 border border-border rounded px-3 py-2 text-xs font-mono break-all">
                {jiraWebhookUrl}
              </code>
              <p className="text-xs text-muted-foreground/60">
                Webhook secret is stored securely and used to verify HMAC signatures.
              </p>
            </div>
          </>
        )}
      </section>

      {/* Azure DevOps */}
      <section className="border border-border rounded-xl p-6 space-y-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-800 rounded flex items-center justify-center text-white font-bold text-sm">
              A
            </div>
            <div>
              <h2 className="font-semibold text-foreground">Azure DevOps</h2>
              <p className="text-xs text-muted-foreground">Bidirectional work item sync</p>
            </div>
          </div>

          {adoConfig ? (
            <div className="flex items-center gap-3">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium bg-green-100 text-green-700">
                <span className="w-1.5 h-1.5 rounded-full bg-green-500 inline-block" />
                Connected
              </span>
              <DisconnectAdoButton />
            </div>
          ) : (
            <ConnectAdoButton />
          )}
        </div>

        {adoConfig && (
          <>
            <div className="text-sm text-muted-foreground">
              <p>
                <span className="font-medium">Organization:</span>{" "}
                <span className="font-mono text-xs">{adoConfig.organization}</span>
              </p>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold text-foreground mb-3">ART → Project Mapping</h3>
              <p className="text-xs text-muted-foreground mb-3">
                Enter the project path as <code className="font-mono">Organization/Project</code>.
              </p>
              <AdoProjectMapForm arts={arts} currentMap={adoProjectMap} />
            </div>

            <div className="border-t pt-4 space-y-2">
              <h3 className="text-sm font-semibold text-foreground">Service Hook Setup</h3>
              <p className="text-xs text-muted-foreground">
                Register this URL in Azure DevOps (Project Settings → Service Hooks → Web Hooks) for
                the <strong>Work item updated</strong> event:
              </p>
              <code className="block bg-muted/50 border border-border rounded px-3 py-2 text-xs font-mono break-all">
                {adoWebhookUrl}
              </code>
              <p className="text-xs text-muted-foreground/60">
                Set the shared secret to the value shown in your database — it is used to verify
                HMAC-SHA1 signatures.
              </p>
            </div>
          </>
        )}
      </section>
    </main>
  );
}
