import { Link } from "@/i18n/navigation";
import { userLabel } from "@/components/detail/initiative-labels";
import type { HelpRequestTask } from "@/modules/work/server/services/my-help-requests";

/**
 * My-Tasks-Sektion für VMO / Portfolio-Management: Epics, deren Owner um
 * Unterstützung gebeten hat. Verschwindet automatisch, sobald die Bitte
 * zurückgenommen ist (der Loader liefert dann nichts). Rein präsentational.
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
    <section className="border-b bg-surface-frame px-6 py-4">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
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
