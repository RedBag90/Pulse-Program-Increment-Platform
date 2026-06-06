import { Link2 } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Stub für die Cross-PI Dependencies-Liste. PR 4 ersetzt diese Seite
 * durch die echte aggregierte Sicht mit Type-Funnel und cross-ART
 * Filter, basierend auf `buildDependenciesListModel`.
 */
export default function DependenciesOverviewStub() {
  return (
    <main className="p-8">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm">
        <Link2 className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 text-xl font-semibold">Dependencies — in Arbeit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Die globale Abhängigkeits-Sicht (cross-PI) folgt im nächsten Inkrement. Bis dahin pflegst
          du Abhängigkeiten pro PI:
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          <Link href="/structure?tab=timeline" className="text-primary hover:underline">
            → PI auswählen → Dependencies
          </Link>
        </div>
      </div>
    </main>
  );
}
