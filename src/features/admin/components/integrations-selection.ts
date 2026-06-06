import type { IntegrationKind } from "@/server/views/admin-integrations";

/**
 * URL-driven selection on the admin integrations page. With only two
 * integrations the codec is small but the shape mirrors the goals / users
 * pages so future entries (Slack, GitHub) drop in by adding a kind to
 * `IntegrationKind`.
 *
 * Encoding (`?selected=`):
 * - `integration_jira` → Jira Cloud
 * - `integration_ado` → Azure DevOps
 * - missing → nothing selected (the shell defaults to the first connected
 *   integration, or to Jira if none)
 */
export type Selection = { kind: "integration"; integration: IntegrationKind } | { kind: "none" };

const KINDS = new Set<IntegrationKind>(["jira", "ado"]);

export function parseSelection(raw: string | null | undefined): Selection {
  if (!raw) return { kind: "none" };
  if (raw.startsWith("integration_")) {
    const id = raw.slice("integration_".length) as IntegrationKind;
    if (KINDS.has(id)) return { kind: "integration", integration: id };
  }
  return { kind: "none" };
}

export function encodeSelection(sel: Selection): string | null {
  if (sel.kind === "none") return null;
  return `integration_${sel.integration}`;
}
