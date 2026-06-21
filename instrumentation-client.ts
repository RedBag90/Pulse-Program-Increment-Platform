import * as Sentry from "@sentry/nextjs";

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: process.env.NODE_ENV === "production" ? 0.2 : 1.0,
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
});

// Replay-Integration (~190 kB) erst nach dem Hauptbundle nachladen — spart
// das auf jeder Route, sonst waere sie eager im Shared-Chunk. Nur in
// Production, lokal ist das Bug-Repro-Tool unnoetig.
if (typeof window !== "undefined" && process.env.NODE_ENV === "production") {
  const load = () =>
    Sentry.lazyLoadIntegration("replayIntegration")
      .then((replay) => Sentry.addIntegration(replay()))
      .catch(() => undefined);
  // Warte auf idle, damit der Replay-Download den initialen Render nicht blockiert.
  if ("requestIdleCallback" in window) {
    (window as Window & typeof globalThis).requestIdleCallback(load);
  } else {
    setTimeout(load, 2000);
  }
}

export const onRouterTransitionStart = Sentry.browserTracingIntegration().options
  ?.instrumentNavigation
  ? Sentry.captureRouterTransitionStart
  : undefined;
