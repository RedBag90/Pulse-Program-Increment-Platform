/**
 * Admin integrations page-model — turns the two `*Config` rows + the ART
 * catalogue into the row + detail DTOs the master-detail page consumes.
 *
 * The page surfaces a fixed set of integrations (Jira Cloud · Azure DevOps);
 * future entries (Slack, GitHub, etc.) would be added here too. Each row
 * carries its connection status + mapping count so the list is scannable
 * without opening the detail pane.
 */

/** Stable kinds — drives the URL selection codec and the icon palette. */
export type IntegrationKind = "jira" | "ado";

export interface IntegrationListItem {
  kind: IntegrationKind;
  /** Display label rendered in the row + the detail header. */
  name: string;
  /** Short subtitle under the row. */
  subtitle: string;
  connected: boolean;
  mappingCount: number;
}

export interface JiraDetail {
  kind: "jira";
  name: string;
  connected: boolean;
  instanceUrl: string | null;
  cloudId: string | null;
  projectKeyMap: Record<string, string>;
  webhookUrl: string;
}

export interface AdoDetail {
  kind: "ado";
  name: string;
  connected: boolean;
  organization: string | null;
  projectMap: Record<string, string>;
  webhookUrl: string;
}

export type IntegrationDetail = JiraDetail | AdoDetail;

export interface ArtOption {
  id: string;
  name: string;
}

export interface IntegrationsPageModel {
  list: IntegrationListItem[];
  jira: JiraDetail;
  ado: AdoDetail;
  arts: ArtOption[];
}

// ---- Input row types ----

interface JiraConfigRow {
  instanceUrl: string;
  cloudId: string;
  projectKeyMap: unknown;
}

interface AdoConfigRow {
  organization: string;
  projectMap: unknown;
}

function readMap(raw: unknown): Record<string, string> {
  if (raw == null || typeof raw !== "object") return {};
  const obj = raw as Record<string, unknown>;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (typeof v === "string") out[k] = v;
  }
  return out;
}

function countNonEmpty(map: Record<string, string>): number {
  return Object.values(map).filter((v) => v.trim() !== "").length;
}

export function buildIntegrationsPageModel(input: {
  jiraConfig: JiraConfigRow | null;
  adoConfig: AdoConfigRow | null;
  arts: readonly ArtOption[];
  tenantId: string;
  appUrl: string;
}): IntegrationsPageModel {
  const { jiraConfig, adoConfig, arts, tenantId, appUrl } = input;

  const projectKeyMap = readMap(jiraConfig?.projectKeyMap);
  const projectMap = readMap(adoConfig?.projectMap);

  const jiraConnected = jiraConfig !== null;
  const adoConnected = adoConfig !== null;

  const jiraWebhookUrl = `${appUrl}/api/integrations/jira/webhook?tenantId=${tenantId}`;
  const adoWebhookUrl = `${appUrl}/api/integrations/azure-devops/webhook?tenantId=${tenantId}`;

  const list: IntegrationListItem[] = [
    {
      kind: "jira",
      name: "Jira Cloud",
      subtitle: "Bidirektionale Story-Synchronisation",
      connected: jiraConnected,
      mappingCount: countNonEmpty(projectKeyMap),
    },
    {
      kind: "ado",
      name: "Azure DevOps",
      subtitle: "Bidirektionale Work-Item-Synchronisation",
      connected: adoConnected,
      mappingCount: countNonEmpty(projectMap),
    },
  ];

  const jira: JiraDetail = {
    kind: "jira",
    name: "Jira Cloud",
    connected: jiraConnected,
    instanceUrl: jiraConfig?.instanceUrl ?? null,
    cloudId: jiraConfig?.cloudId ?? null,
    projectKeyMap,
    webhookUrl: jiraWebhookUrl,
  };

  const ado: AdoDetail = {
    kind: "ado",
    name: "Azure DevOps",
    connected: adoConnected,
    organization: adoConfig?.organization ?? null,
    projectMap,
    webhookUrl: adoWebhookUrl,
  };

  return {
    list,
    jira,
    ado,
    arts: arts.map((a) => ({ id: a.id, name: a.name })),
  };
}
