import type { NextConfig } from "next";
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";
import { withSentryConfig } from "@sentry/nextjs";
import withBundleAnalyzer from "@next/bundle-analyzer";

const withNextIntl = createNextIntlPlugin("./src/i18n/request.ts");

const nextConfig: NextConfig = {
  // Workspace-Root explizit auf dieses Projekt pinnen. Next inferiert sonst über
  // ein verirrtes `~/package-lock.json` das Home-Verzeichnis als Root und scannt
  // beim File-Tracing das ganze Home (blockiert `next dev` auf FS/iCloud-I/O).
  outputFileTracingRoot: dirname(fileURLToPath(import.meta.url)),
  // Barrel-/Tree-Shaking-Optimierung für schwere Pakete (nur die tatsächlich
  // genutzten Exporte landen im Bundle). Wirkt app-weit, additiv.
  experimental: {
    optimizePackageImports: ["lucide-react", "recharts", "@xyflow/react", "@dagrejs/dagre"],
  },
  // typedRoutes (experimental) wurde in Next 15.5 strenger und lehnt dynamische
  // Template-Literal-Routen mit `?query` ab (z. B. `redirect(`/admin/users?
  // selected=…`)`), was den Vercel-Build blockierte. Da es eine reine DX-Feature
  // ist (Compile-Zeit-Routen-Strings) und der Code das Feature ohnehin mit
  // `as never`-Casts umgeht, ist es hier deaktiviert. Reaktivierbar, sobald alle
  // Query-String-Navigationen sauber getypt sind.
};

const withIntl = withNextIntl(nextConfig);
const withAnalyzer = withBundleAnalyzer({ enabled: process.env.ANALYZE === "1" });

const composed = withAnalyzer(withIntl);

// Der Sentry-Webpack-Plugin (Source-Map-Upload + Build-Instrumentierung) wird
// NUR für Produktions-Builds gebraucht. In `next dev` blockiert er die
// `/middleware`-Kompilierung dauerhaft (Compile hängt bei ~1% CPU, Requests
// timen aus). Die Laufzeit-Fehlererfassung läuft ohnehin über
// `instrumentation.ts` (Sentry.init) und ist davon unberührt. Daher: Wrapper
// nur in Produktion anwenden. Mit `DISABLE_SENTRY=1` auch für Prod-Builds abschaltbar.
const useSentry =
  process.env.NODE_ENV === "production" && process.env.DISABLE_SENTRY !== "1";

export default useSentry
  ? withSentryConfig(composed, {
      org: process.env.SENTRY_ORG,
      project: process.env.SENTRY_PROJECT ?? "pulse",
      silent: !process.env.CI,
      widenClientFileUpload: true,
      sourcemaps: { deleteSourcemapsAfterUpload: true },
      disableLogger: true,
      automaticVercelMonitors: true,
    })
  : composed;
