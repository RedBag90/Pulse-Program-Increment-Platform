import { Hammer } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Stub für die Cross-VS/Cross-ART Features-Übersicht. PR 2 ersetzt
 * diese Seite durch eine echte aggregierte Liste mit Funnel + Filter +
 * Bulk-Bar, basierend auf `buildFeaturesOverviewModel`. Bis dahin
 * lenkt der Hinweis hier auf die existierende per-ART-Sicht.
 */
export default function FeaturesOverviewStub() {
  return (
    <main className="p-8">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Hammer className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 text-xl font-semibold">Features-Übersicht — in Arbeit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Die Cross-Value-Stream-/Cross-ART-Sicht auf alle Features kommt im nächsten Inkrement
          (Funnel + Filter + Bulk-PI-Reassign). Bis dahin gibt es die per-ART-Sicht direkt unter dem
          ART:
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          <Link href="/structure?tab=arts" className="text-primary hover:underline">
            → ART auswählen
          </Link>
          <span className="text-muted-foreground">·</span>
          <Link href="/portfolio/epics" className="text-primary hover:underline">
            → Portfolio-Epics
          </Link>
        </div>
      </div>
    </main>
  );
}
