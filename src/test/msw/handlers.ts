import { http, HttpResponse } from "msw";

export const handlers = [
  http.post("https://*.atlassian.net/rest/api/3/issue", () =>
    HttpResponse.json({ key: "MOCK-1", id: "10001" }, { status: 201 }),
  ),

  http.post("https://api.resend.com/emails", () => HttpResponse.json({ id: "resend-mock-id" })),
];
