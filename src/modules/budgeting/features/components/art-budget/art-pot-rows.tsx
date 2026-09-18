import { Fragment, type ReactNode } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import type { ArtEpicBudget } from "@/modules/budgeting/domain/art-epic-budget";
import { formatEUR } from "@/lib/formatting";

/**
 * **Der Rahmen je ART, und wer ihn noch verteilen muss** — die Arbeitsfläche des
 * Reiters „Betrieb".
 *
 * Bewusst **nicht** die Matrix aus dem Reiter „Budget": dort geht es um das
 * Zugeteilte über alle Halbjahre, hier um genau eine offene Aufgabe in genau
 * einem Halbjahr. Dieselben drei Spalten wie die ART-Liste
 * (`/budgeting/arts`) — ein Wort, eine Bedeutung (REQ-4).
 *
 * Aufgeklappt steht darunter das Verteilformular desselben ARTs. Das ist das
 * Ziel, auf das Schritt 5 der Finanzierungskette und die persönliche Inbox
 * zeigen; vorher war es eine eigene Seite.
 *
 * Server-Komponente: der Schalter ist ein `<Link>` auf `?art=`.
 */
interface Props {
  arts: readonly { id: string; name: string }[];
  /** Rahmen je ART in diesem Halbjahr — `loadArtEpicBudgets` liefert jeden. */
  budgets: ReadonlyMap<string, ArtEpicBudget>;
  basePath: string;
  cycleKey: string;
  expandedArtId: string | null;
  expanded?: ReactNode;
  /** ARTs, für die der Betrachter Beträge sehen darf (REQ-3). */
  visibleArtIds: ReadonlySet<string>;
}

export function ArtPotRows({
  arts,
  budgets,
  basePath,
  cycleKey,
  expandedArtId,
  expanded,
  visibleArtIds,
}: Props) {
  const shown = arts.filter((a) => visibleArtIds.has(a.id));

  if (shown.length === 0) {
    return (
      <section className="space-y-2">
        <h2 className="text-sm font-medium">Rahmen je ART</h2>
        <p className="text-sm text-muted-foreground">
          Für dieses Halbjahr ist Ihnen kein ART-Rahmen dieses Wertstroms zugänglich.
        </p>
      </section>
    );
  }

  const href = (artId: string | null) =>
    artId == null
      ? `${basePath}?tab=betrieb&cycle=${cycleKey}`
      : `${basePath}?tab=betrieb&cycle=${cycleKey}&art=${artId}`;

  const sum = (pick: (b: ArtEpicBudget) => number) =>
    shown.reduce((s, a) => {
      const b = budgets.get(a.id);
      return s + (b ? pick(b) : 0);
    }, 0);

  return (
    <section className="space-y-2">
      <h2 className="text-sm font-medium">Rahmen je ART</h2>
      <p className="text-xs text-muted-foreground">
        Was jedem ART aus den Betriebspositionen zugesprochen ist — und was davon noch auf seine
        Epics zu verteilen ist. Eine Zeile öffnet das Verteilformular.
      </p>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b bg-surface-frame text-left text-xs uppercase tracking-wide text-muted-foreground">
              <th className="px-3 py-2">ART</th>
              <th className="px-3 py-2 text-right">ART-Rahmen</th>
              <th className="px-3 py-2 text-right">Aus dem Rahmen verteilt</th>
              <th className="px-3 py-2 text-right">Rahmen offen</th>
            </tr>
          </thead>
          <tbody>
            {shown.map((a) => {
              const b = budgets.get(a.id);
              const open = expandedArtId === a.id;
              return (
                <Fragment key={a.id}>
                  <tr className={`border-b ${open ? "bg-muted/30" : ""}`}>
                    <td className="px-3 py-2">
                      <Link
                        href={href(open ? null : a.id)}
                        aria-expanded={open}
                        className="-mx-1 inline-flex items-center gap-1 rounded-md px-1 py-0.5 font-medium hover:bg-muted focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
                      >
                        {open ? (
                          <ChevronDown className="size-3.5 shrink-0" aria-hidden />
                        ) : (
                          <ChevronRight className="size-3.5 shrink-0" aria-hidden />
                        )}
                        {a.name}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {b && b.total > 0 ? (
                        formatEUR(b.total)
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEUR(b?.distributed ?? 0)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEUR(b?.remaining ?? 0)}
                    </td>
                  </tr>
                  {open && expanded != null && (
                    <tr className="border-b bg-muted/20">
                      <td colSpan={4} className="p-3">
                        {expanded}
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
            <tr className="border-t bg-surface-frame font-medium">
              <td className="px-3 py-2">Summe</td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatEUR(sum((b) => b.total))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatEUR(sum((b) => b.distributed))}
              </td>
              <td className="px-3 py-2 text-right tabular-nums">
                {formatEUR(sum((b) => b.remaining))}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
