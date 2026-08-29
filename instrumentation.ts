// Sentry-Laufzeit-Init. Auf Produktion beschränkt: Im Dev blockiert das
// Edge-Runtime-Bundling von `@sentry/nextjs` (samt `require-in-the-middle` /
// `import-in-the-middle`) den `next dev`-Schritt „Compiling instrumentation
// Edge" dauerhaft (Deadlock, 0 % CPU, kein „Ready"). Gleiche Begründung wie das
// bereits nur in Produktion angewandte Sentry-Webpack-Plugin in `next.config.ts`.
// Der dynamische `import()` hält `@sentry/nextjs` komplett aus dem Dev-Bundle.
import type * as SentryType from "@sentry/nextjs";

export async function register() {
  if (process.env.NODE_ENV !== "production") return;
  const Sentry = await import("@sentry/nextjs");

  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.2,
      beforeSend(event) {
        const data = event.request?.data as Record<string, unknown> | undefined;
        if (data) {
          if ("password" in data) data["password"] = "[Filtered]";
          if ("token" in data) data["token"] = "[Filtered]";
        }
        return event;
      },
    });
  }

  if (process.env.NEXT_RUNTIME === "edge") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: 0.2,
    });
  }
}

export async function onRequestError(
  ...args: Parameters<typeof SentryType.captureRequestError>
): Promise<void> {
  if (process.env.NODE_ENV !== "production") return;
  const Sentry = await import("@sentry/nextjs");
  Sentry.captureRequestError(...args);
}
