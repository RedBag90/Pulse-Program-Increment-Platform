// Azure DevOps REST API client
// Docs: https://learn.microsoft.com/en-us/rest/api/azure/devops/wit/work-items

export class AzureDevOpsClient {
  private readonly base: string;
  private readonly headers: Record<string, string>;

  constructor(
    organization: string,
    private readonly project: string,
    accessToken: string,
  ) {
    this.base = `https://dev.azure.com/${organization}/${project}/_apis`;
    this.headers = {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json-patch+json",
    };
  }

  async createWorkItem(
    type: string,
    fields: { title: string; description?: string; storyPoints?: number },
  ): Promise<{ id: number; url: string }> {
    const ops = [
      { op: "add", path: "/fields/System.Title", value: fields.title },
      ...(fields.description
        ? [{ op: "add", path: "/fields/System.Description", value: fields.description }]
        : []),
      ...(fields.storyPoints !== undefined
        ? [
            {
              op: "add",
              path: "/fields/Microsoft.VSTS.Scheduling.StoryPoints",
              value: fields.storyPoints,
            },
          ]
        : []),
    ];

    const res = await fetch(
      `${this.base}/wit/workitems/$${encodeURIComponent(type)}?api-version=7.1`,
      {
        method: "POST",
        headers: this.headers,
        body: JSON.stringify(ops),
      },
    );

    if (!res.ok) throw new Error(`ADO createWorkItem failed: ${res.status} ${await res.text()}`);
    const data = (await res.json()) as { id: number; url: string };
    return { id: data.id, url: data.url };
  }

  async updateWorkItem(
    id: number,
    fields: { stateReason?: string; state?: string },
  ): Promise<void> {
    const ops = [
      ...(fields.state ? [{ op: "add", path: "/fields/System.State", value: fields.state }] : []),
    ];
    if (ops.length === 0) return;

    const res = await fetch(`${this.base}/wit/workitems/${id}?api-version=7.1`, {
      method: "PATCH",
      headers: this.headers,
      body: JSON.stringify(ops),
    });

    if (!res.ok) throw new Error(`ADO updateWorkItem failed: ${res.status}`);
  }

  async getWorkItem(id: number): Promise<{ state: string; title: string }> {
    const res = await fetch(`${this.base}/wit/workitems/${id}?api-version=7.1`, {
      headers: { ...this.headers, "Content-Type": "application/json" },
    });
    if (!res.ok) throw new Error(`ADO getWorkItem failed: ${res.status}`);
    const data = (await res.json()) as {
      fields: { "System.State": string; "System.Title": string };
    };
    return {
      state: data.fields["System.State"],
      title: data.fields["System.Title"],
    };
  }
}
