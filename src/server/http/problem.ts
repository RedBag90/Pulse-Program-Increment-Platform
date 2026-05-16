/** RFC 7807 Problem Details for HTTP APIs */
export interface ProblemDetails {
  type: string;
  title: string;
  status: number;
  detail?: string;
  instance?: string;
  [key: string]: unknown;
}

const BASE_URL = "https://pulse.example.com/errors";

const PROBLEM_TYPES: Record<string, string> = {
  unauthenticated: "Unauthenticated",
  forbidden: "Forbidden",
  "not-found": "Not Found",
  "validation-failed": "Validation Failed",
  "idempotency-key-required": "Idempotency Key Required",
  "hierarchy-violation": "Invalid Parent-Child Level Relationship",
  conflict: "Conflict",
  "internal-error": "Internal Server Error",
};

export function problemJson(
  status: number,
  errorCode: string,
  extra?: Record<string, unknown>,
): Response {
  const body: ProblemDetails = {
    type: `${BASE_URL}/${errorCode}`,
    title: PROBLEM_TYPES[errorCode] ?? errorCode,
    status,
    ...extra,
  };

  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/problem+json" },
  });
}

export function forbidden(reason?: string): Response {
  return problemJson(403, "forbidden", reason ? { detail: reason } : undefined);
}

export function notFound(resource?: string): Response {
  return problemJson(404, "not-found", resource ? { detail: `${resource} not found` } : undefined);
}

export function unprocessable(errors: unknown): Response {
  return problemJson(422, "validation-failed", { errors });
}

export function unauthorized(): Response {
  return problemJson(401, "unauthenticated");
}
