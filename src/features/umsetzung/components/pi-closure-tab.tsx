import { PiClosureWizard } from "@/features/pi/components/pi-closure-wizard";

export interface ClosureOpenImpediment {
  id: string;
  title: string;
  severity: string;
  roamStatus: string;
  artId: string;
}

interface Props {
  piId: string;
  piName: string;
  status: string;
  systemDemoAt: string | null;
  inspectAdaptAt: string | null;
  retrospectiveNotes: string | null;
  issues: string[];
  openImpediments: ClosureOpenImpediment[];
}

/**
 * Closure-Tab des PI-Workspaces. Wrappt den bestehenden
 * `PiClosureWizard` und zeigt zusaetzlich den aktuellen
 * Pre-Check-Status auf einen Blick. Der Wizard selbst ist als
 * Modal-Trigger gebaut — der Tab liefert den Knopf in Kontext und
 * faengt fruehe Hinweise ab, wenn der PI noch nicht aktiv ist.
 */
export function PiClosureTab({
  piId,
  piName,
  status,
  systemDemoAt,
  inspectAdaptAt,
  retrospectiveNotes,
  issues,
  openImpediments,
}: Props) {
  return (
    <div className="space-y-4">
      <section className="rounded-lg border bg-card p-6">
        <h2 className="text-lg font-medium">Closure</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          Der PI-Closure-Wizard prueft Objectives, ROAM, Demo & I&A-Termine und Retrospektive —
          alles muss gruen sein, bevor der PI abgeschlossen werden kann.
        </p>

        {status !== "active" ? (
          <p className="mt-3 rounded-md border border-dashed bg-muted/30 px-4 py-3 text-sm text-muted-foreground">
            Der Closure-Wizard ist nur fuer aktive PIs verfuegbar. Aktueller Status:{" "}
            <strong>{status}</strong>.
          </p>
        ) : (
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <PiClosureWizard
              piId={piId}
              piName={piName}
              systemDemoAt={systemDemoAt}
              inspectAdaptAt={inspectAdaptAt}
              retrospectiveNotes={retrospectiveNotes}
              issues={issues}
              openImpediments={openImpediments}
            />
            <span className="text-sm text-muted-foreground">
              {issues.length === 0 ? "Alle Pre-Checks gruen" : `${issues.length} offene Pre-Checks`}
            </span>
          </div>
        )}
      </section>

      {issues.length > 0 && (
        <section className="rounded-lg border border-amber-200 bg-amber-50/60 p-4">
          <h3 className="text-sm font-semibold text-amber-900">Pre-Checks</h3>
          <ul className="mt-2 list-inside list-disc space-y-1 text-sm text-amber-900">
            {issues.map((i, idx) => (
              <li key={idx}>{i}</li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}
