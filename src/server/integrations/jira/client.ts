/**
 * Jira Cloud REST API client (v3).
 * Instantiate with a valid access token and the site's cloudId.
 */

const ATLASSIAN_API_BASE = "https://api.atlassian.com";

export interface JiraIssueFields {
  summary: string;
  description?: string;
  issuetype: { name: string }; // e.g. "Story"
  project: { key: string };
  // Optional story points via story-points field
  story_points?: number;
}

export interface JiraIssueCreated {
  id: string;
  key: string; // e.g. "PROJ-42"
  self: string;
}

export interface JiraIssueStatus {
  key: string;
  fields: {
    status: { name: string; statusCategory: { key: string } };
    summary: string;
  };
}

export class JiraClient {
  private readonly base: string;

  constructor(
    private readonly cloudId: string,
    private readonly accessToken: string,
  ) {
    this.base = `${ATLASSIAN_API_BASE}/ex/jira/${cloudId}/rest/api/3`;
  }

  private async request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${this.base}${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    });

    if (!res.ok) {
      const text = await res.text();
      throw new Error(`Jira API ${method} ${path} → ${res.status}: ${text}`);
    }

    // 204 No Content
    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }

  async createIssue(fields: JiraIssueFields): Promise<JiraIssueCreated> {
    return this.request<JiraIssueCreated>("POST", "/issue", {
      fields: {
        summary: fields.summary,
        project: fields.project,
        issuetype: fields.issuetype,
        ...(fields.description !== undefined && {
          description: {
            type: "doc",
            version: 1,
            content: [
              {
                type: "paragraph",
                content: [{ type: "text", text: fields.description }],
              },
            ],
          },
        }),
        ...(fields.story_points !== undefined && {
          story_points: fields.story_points,
        }),
      },
    });
  }

  async getIssue(issueKey: string): Promise<JiraIssueStatus> {
    return this.request<JiraIssueStatus>("GET", `/issue/${issueKey}?fields=summary,status`);
  }

  async transitionIssue(issueKey: string, transitionId: string): Promise<void> {
    await this.request<void>("POST", `/issue/${issueKey}/transitions`, {
      transition: { id: transitionId },
    });
  }

  async getTransitions(issueKey: string): Promise<{ id: string; name: string }[]> {
    const data = await this.request<{ transitions: { id: string; name: string }[] }>(
      "GET",
      `/issue/${issueKey}/transitions`,
    );
    return data.transitions;
  }

  /**
   * Registers a Jira webhook for issue_updated events.
   * Returns the created webhook ID.
   */
  async registerWebhook(callbackUrl: string, secret: string): Promise<number> {
    const data = await this.request<{ webhookRegistrationResult: { createdWebhookId: number }[] }>(
      "POST",
      "/webhook",
      {
        url: callbackUrl,
        webhooks: [
          {
            events: ["jira:issue_updated", "jira:issue_created"],
            jqlFilter: "",
          },
        ],
        secret,
      },
    );
    const result = data.webhookRegistrationResult[0];
    if (!result) throw new Error("Webhook registration returned no result");
    return result.createdWebhookId;
  }
}
