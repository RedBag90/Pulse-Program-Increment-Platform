"use client";

import { useState } from "react";
import { Copy, Check, ExternalLink } from "lucide-react";
import { saveJiraProjectMapAction } from "@/features/integrations/actions/jira";
import { saveAdoProjectMapAction } from "@/features/integrations/actions/azure-devops";
import { ConnectJiraButton } from "@/features/integrations/components/connect-jira-button";
import { DisconnectJiraButton } from "@/features/integrations/components/disconnect-jira-button";
import { ConnectAdoButton } from "@/features/integrations/components/connect-ado-button";
import { DisconnectAdoButton } from "@/features/integrations/components/disconnect-ado-button";
import { Button } from "@/components/ui/button";
import { ProjectMappingForm } from "@/features/admin/components/project-mapping-form";
import type { IntegrationDetail, ArtOption } from "@/server/views/admin-integrations";

interface Props {
  detail: IntegrationDetail;
  arts: ArtOption[];
  canManage: boolean;
}

/**
 * Right pane for the selected integration. Three cards in the standard
 * Header / Leaf-list / Related-data stack:
 *
 * - **Header** — name + connection status + Connect/Disconnect buttons +
 *   instance metadata (URL + cloudId for Jira, organization for ADO).
 * - **Mappings** — the shared `<ProjectMappingForm>` driving the per-ART →
 *   external-project key map. One Save button at the bottom.
 * - **Webhook** — the URL to register in the external tool + copy-to-
 *   clipboard button + a short note about HMAC signatures.
 *
 * The Connect / Disconnect buttons are kept as their existing self-contained
 * client components (OAuth redirects, confirm-then-mutate).
 */
export function IntegrationDetailPane({ detail, arts, canManage }: Props) {
  return (
    <div className="space-y-6">
      {detail.kind === "jira" ? (
        <JiraDetailBlocks detail={detail} arts={arts} canManage={canManage} />
      ) : (
        <AdoDetailBlocks detail={detail} arts={arts} canManage={canManage} />
      )}
    </div>
  );
}

function JiraDetailBlocks({
  detail,
  arts,
  canManage,
}: {
  detail: Extract<IntegrationDetail, { kind: "jira" }>;
  arts: ArtOption[];
  canManage: boolean;
}) {
  return (
    <>
      <HeaderCard
        name={detail.name}
        connected={detail.connected}
        canManage={canManage}
        connect={<ConnectJiraButton />}
        disconnect={<DisconnectJiraButton />}
      >
        {detail.connected && (
          <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">Instance</dt>
            <dd>
              <a
                href={detail.instanceUrl ?? "#"}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-primary hover:underline"
              >
                {detail.instanceUrl ?? "—"}
                <ExternalLink className="size-3" />
              </a>
            </dd>
            <dt className="text-muted-foreground">Cloud-ID</dt>
            <dd className="font-mono">{detail.cloudId ?? "—"}</dd>
          </dl>
        )}
      </HeaderCard>

      {detail.connected && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="font-heading text-sm font-medium">ART → Jira-Projekt</h2>
          <ProjectMappingForm
            arts={arts}
            currentMap={detail.projectKeyMap}
            save={saveJiraProjectMapAction}
            helpText="Ordne jedem ART seinen Jira-Projekt-Key zu. Storys, die in diesem ART angelegt werden, landen im verknüpften Jira-Projekt."
            placeholder="z. B. PROJ"
            uppercase
          />
        </section>
      )}

      {detail.connected && (
        <WebhookCard
          url={detail.webhookUrl}
          helpText="Trage diese URL in Jira (Projektkonfiguration → Webhooks) ein, um Status-Updates zu empfangen. Das Webhook-Secret wird sicher gespeichert und für die HMAC-Signaturprüfung verwendet."
        />
      )}
    </>
  );
}

function AdoDetailBlocks({
  detail,
  arts,
  canManage,
}: {
  detail: Extract<IntegrationDetail, { kind: "ado" }>;
  arts: ArtOption[];
  canManage: boolean;
}) {
  return (
    <>
      <HeaderCard
        name={detail.name}
        connected={detail.connected}
        canManage={canManage}
        connect={<ConnectAdoButton />}
        disconnect={<DisconnectAdoButton />}
      >
        {detail.connected && (
          <dl className="grid grid-cols-[120px_1fr] gap-y-1 text-xs">
            <dt className="text-muted-foreground">Organisation</dt>
            <dd className="font-mono">{detail.organization ?? "—"}</dd>
          </dl>
        )}
      </HeaderCard>

      {detail.connected && (
        <section className="space-y-3 rounded-lg border bg-card p-4">
          <h2 className="font-heading text-sm font-medium">ART → Azure-DevOps-Projekt</h2>
          <ProjectMappingForm
            arts={arts}
            currentMap={detail.projectMap}
            save={saveAdoProjectMapAction}
            helpText={`Gib den Projekt-Pfad als „Organisation/Projekt“ an. Storys aus diesem ART werden in das verknüpfte Azure-DevOps-Projekt geschrieben.`}
            placeholder="z. B. acme/Mobile"
          />
        </section>
      )}

      {detail.connected && (
        <WebhookCard
          url={detail.webhookUrl}
          helpText={`Trage diese URL in Azure DevOps (Projekteinstellungen → Service Hooks → Web Hooks) für den Event „Work item updated“ ein. Setze das Shared-Secret auf den in der Datenbank hinterlegten Wert — er wird für die HMAC-SHA1-Signaturprüfung verwendet.`}
        />
      )}
    </>
  );
}

function HeaderCard({
  name,
  connected,
  connect,
  disconnect,
  canManage,
  children,
}: {
  name: string;
  connected: boolean;
  connect: React.ReactNode;
  disconnect: React.ReactNode;
  canManage: boolean;
  children?: React.ReactNode;
}) {
  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <p className="text-xs uppercase tracking-wide text-muted-foreground">Integration</p>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <h2 className="font-heading text-base font-medium">{name}</h2>
        <div className="flex items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-[11px] ${
              connected ? "bg-emerald-100 text-emerald-700" : "bg-muted text-muted-foreground"
            }`}
          >
            {connected ? "verbunden" : "getrennt"}
          </span>
          {canManage && (connected ? disconnect : connect)}
        </div>
      </div>
      {children}
    </section>
  );
}

function WebhookCard({ url, helpText }: { url: string; helpText: string }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // Some browsers / contexts block the clipboard API; nothing actionable.
    }
  }

  return (
    <section className="space-y-3 rounded-lg border bg-card p-4">
      <h2 className="font-heading text-sm font-medium">Webhook-URL</h2>
      <p className="text-xs text-muted-foreground">{helpText}</p>
      <div className="flex items-center gap-2">
        <code className="block flex-1 break-all rounded border border-input bg-muted/30 px-3 py-2 text-[11px] font-mono">
          {url}
        </code>
        <Button type="button" size="sm" variant="outline" onClick={copy}>
          {copied ? <Check className="size-3.5" /> : <Copy className="size-3.5" />}
          {copied ? "Kopiert" : "Kopieren"}
        </Button>
      </div>
    </section>
  );
}
