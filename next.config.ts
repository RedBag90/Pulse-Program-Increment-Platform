import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // typedRoutes (experimental) wurde in Next 15.5 strenger und lehnt dynamische
  // Template-Literal-Routen mit `?query` ab (z. B. `redirect(`/admin/users?
  // selected=…`)`), was den Vercel-Build blockierte. Da es eine reine DX-Feature
  // ist (Compile-Zeit-Routen-Strings) und der Code das Feature ohnehin mit
  // `as never`-Casts umgeht, ist es hier deaktiviert. Reaktivierbar, sobald alle
  // Query-String-Navigationen sauber getypt sind.
};

const withIntl = withNextIntl(nextConfig);
const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "1" });

export default withSentryConfig(withAnalyzer(withIntl), {
  org: process.env.SENTRY_ORG,
  project: process.env.SENTRY_PROJECT ?? "pulse",
  silent: !process.env.CI,
  widenClientFileUpload: true,
  sourcemaps: { deleteSourcemapsAfterUpload: true },
  disableLogger: true,
  automaticVercelMonitors: true,
});
