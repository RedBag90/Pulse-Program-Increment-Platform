import { describe, it, expect } from "vitest";
import { buildIntegrationsPageModel } from "@/server/views/admin-integrations";

const baseInput = {
  jiraConfig: null,
  adoConfig: null,
  arts: [{ id: "art1", name: "Mobile ART" }],
  tenantId: "tenant-1",
  appUrl: "https://app.example.com",
};

describe("buildIntegrationsPageModel", () => {
  it("emits both integrations even when neither is connected", () => {
    const m = buildIntegrationsPageModel(baseInput);
    expect(m.list.map((i) => i.kind)).toEqual(["jira", "ado"]);
    expect(m.list.every((i) => !i.connected)).toBe(true);
    expect(m.list.every((i) => i.mappingCount === 0)).toBe(true);
    expect(m.jira.connected).toBe(false);
    expect(m.ado.connected).toBe(false);
  });

  it("marks an integration as connected when its config exists", () => {
    const m = buildIntegrationsPageModel({
      ...baseInput,
      jiraConfig: {
        instanceUrl: "https://acme.atlassian.net",
        cloudId: "abc-123",
        projectKeyMap: { art1: "PROJ" },
      },
    });
    const jiraRow = m.list.find((i) => i.kind === "jira")!;
    expect(jiraRow.connected).toBe(true);
    expect(jiraRow.mappingCount).toBe(1);
    expect(m.jira.instanceUrl).toBe("https://acme.atlassian.net");
    expect(m.jira.projectKeyMap).toEqual({ art1: "PROJ" });
  });

  it("counts non-empty mappings only (empty strings don't count)", () => {
    const m = buildIntegrationsPageModel({
      ...baseInput,
      adoConfig: {
        organization: "acme",
        projectMap: { art1: "acme/Mobile", art2: "" },
      },
    });
    expect(m.list.find((i) => i.kind === "ado")!.mappingCount).toBe(1);
  });

  it("builds webhook URLs using the appUrl + tenantId", () => {
    const m = buildIntegrationsPageModel({
      ...baseInput,
      tenantId: "t-42",
      appUrl: "https://pulse.example.com",
    });
    expect(m.jira.webhookUrl).toBe(
      "https://pulse.example.com/api/integrations/jira/webhook?tenantId=t-42",
    );
    expect(m.ado.webhookUrl).toBe(
      "https://pulse.example.com/api/integrations/azure-devops/webhook?tenantId=t-42",
    );
  });

  it("tolerates malformed map JSON (returns empty object)", () => {
    const m = buildIntegrationsPageModel({
      ...baseInput,
      jiraConfig: {
        instanceUrl: "https://x.atlassian.net",
        cloudId: "cid",
        projectKeyMap: "not-an-object",
      },
    });
    expect(m.jira.projectKeyMap).toEqual({});
  });
});
