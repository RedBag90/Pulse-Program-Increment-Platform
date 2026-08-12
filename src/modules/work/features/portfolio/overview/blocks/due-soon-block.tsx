import { Link } from "@/i18n/navigation";
import { Clock, AlertTriangle } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { DueSoonItem } from "@/modules/work/server/views/portfolio-overview";

/** ISO yyyy-mm-dd → "dd.MM." */
function shortDate(iso: string): string {
  const [, m, d] = iso.split("-");
  return `${d}.${m}.`;
}

/** Signed days-until → German relative label. */
function relative(daysUntil: number): string {
  if (daysUntil < 0) return `überfällig · ${Math.abs(daysUntil)} T`;
  if (daysUntil === 0) return "heute";
  if (daysUntil === 1) return "morgen";
  return `in ${daysUntil} Tagen`;
}

/**
 * Generic "fällig"-Liste for the Portfolio-Übersicht — a Card of work landing
 * soon (or overdue), sorted soonest/most-overdue first. Overdue rows read red.
 * Used twice: Epics (L4-Abschluss, `hrefBase="/portfolio/epics"`) and Features
 * (`hrefBase="/feature"`, each row also linking its parent Epic). Server-only.
 */
export function DueSoonBlock({
  label,
  items,
  hrefBase,
  emptyText,
}: {
  label: string;
  items: DueSoonItem[];
  hrefBase: string;
  emptyText: string;
}) {
  return (
    <Card className="space-y-3 p-4">
      <div className="flex items-center justify-between gap-2">
        <SectionLabel>{label}</SectionLabel>
        {items.length > 0 && (
          <span className="font-mono text-xs tabular-nums text-muted-foreground">
            {items.length}
          </span>
        )}
      </div>

      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{emptyText}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((it) => (
            <li key={it.id} className="flex items-start gap-2">
              {it.overdue ? (
                <AlertTriangle className="mt-0.5 size-4 shrink-0 text-rose-500" />
              ) : (
                <Clock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
              )}
              <div className="min-w-0 flex-1">
                <div className="flex items-baseline justify-between gap-3">
                  <Link
                    href={`${hrefBase}/${it.id}`}
                    className="truncate text-sm font-medium hover:text-primary hover:underline"
                    title={it.title}
                  >
                    {it.title}
                  </Link>
                  <span
                    className={`shrink-0 text-xs tabular-nums ${
                      it.overdue ? "font-medium text-rose-600" : "text-muted-foreground"
                    }`}
                  >
                    {shortDate(it.dateIso)} · {relative(it.daysUntil)}
                  </span>
                </div>
                {(it.subtitle || it.epic) && (
                  <p className="truncate text-xs text-muted-foreground">
                    {it.subtitle}
                    {it.subtitle && it.epic ? " · " : ""}
                    {it.epic && (
                      <>
                        Epic:{" "}
                        <Link
                          href={`/portfolio/epics/${it.epic.id}`}
                          className="hover:text-primary hover:underline"
                        >
                          {it.epic.title}
                        </Link>
                      </>
                    )}
                  </p>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
