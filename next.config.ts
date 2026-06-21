import type { NextConfig } from "next";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  experimental: {
    typedRoutes: true,
  },
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
