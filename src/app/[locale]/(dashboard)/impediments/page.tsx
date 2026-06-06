import { AlertOctagon } from "lucide-react";
import { Link } from "@/i18n/navigation";

/**
 * Stub für die Cross-ART ROAM-Liste. PR 3 ersetzt diese Seite durch
 * eine echte Liste mit ROAM-Funnel (open / resolved / owned / accepted /
 * mitigated), Filter und Bulk-ROAM-Setzen.
 */
export default function ImpedimentsOverviewStub() {
  return (
    <main className="p-8">
      <div className="mx-auto max-w-2xl rounded-2xl border bg-card p-8 text-center shadow-sm">
        <AlertOctagon className="mx-auto size-8 text-primary" />
        <h1 className="mt-3 text-xl font-semibold">Risks &amp; Impediments — in Arbeit</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          Die globale ROAM-Sicht (cross-ART) folgt im nächsten Inkrement. Bis dahin pflegst du
          Impediments per ART:
        </p>
        <div className="mt-4 flex flex-wrap justify-center gap-2 text-sm">
          <Link href="/structure?tab=arts" className="text-primary hover:underline">
            → ART auswählen → Impediments
          </Link>
        </div>
      </div>
    </main>
  );
}
