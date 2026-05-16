import * as Sentry from "@sentry/nextjs";

export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    Sentry.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV,
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
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
      tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
    });
  }
}

export const onRequestError = Sentry.captureRequestError;
