import { Link } from "@/i18n/navigation";
import { userLabel } from "@/components/detail/initiative-labels";
import type { HelpRequestTask } from "@/modules/work/server/services/my-help-requests";

/**
 * My-Tasks-Sektion für VMO / Portfolio-Management: Epics, deren Owner um
 * Unterstützung gebeten hat. Verschwindet automatisch, sobald die Bitte
 * zurückgenommen ist (der Loader liefert dann nichts). Rein präsentational.
 *
 * Trägt die Form ihrer Geschwister im Abschnitt „Meine Tasks" (Epics,
 * Features): `space-y-2` und eine kleine Versal-Überschrift. Bis September 2026
 * war es ein randloser Streifen **über** dem Seitenkopf — damit stand eine
 * Aufgabe ausserhalb des Abschnitts, zu dem sie gehört.
 */
export function HelpRequestsSection({
  tasks,
  userLabels,
}: {
  tasks: HelpRequestTask[];
  userLabels: Record<string, string>;
}) {
  if (tasks.length === 0) return null;

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
        Unterstützung angefragt
      </h2>
      <ul className="mt-2 space-y-2">
        {tasks.map((t) => (
          <li
            key={t.epicId}
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card px-4 py-3"
          >
            <div className="text-sm">
              <span className="font-medium">🆘 {t.title}</span> braucht Unterstützung
              {t.ownerId && (
                <>
                  {" "}
                  — Owner: <span className="font-medium">{userLabel(t.ownerId, userLabels)}</span>
                </>
              )}
              {t.valueStreamName && (
                <span className="ml-1 text-xs text-muted-foreground">{t.valueStreamName}</span>
              )}
            </div>
            <Link
              href={`/portfolio/epics/${t.epicId}`}
              className="rounded bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90"
            >
              Zum Epic →
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
