import {
  CheckCircle2,
  XCircle,
  TrendingUp,
  PlusCircle,
  Link2,
  Trash2,
  PencilLine,
  History,
  type LucideIcon,
} from "lucide-react";
import { actionLabel, userLabel } from "@/components/detail/initiative-labels";

interface HistoryEvent {
  id: string;
  action: string;
  detail?: string | null | undefined;
  actorId?: string | null | undefined;
  occurredAt: Date | string;
  comment?: string | null | undefined;
}

/** Klassifiziert ein Audit-Event nach Aktions-Typ → Icon + semantische Farbe. */
function eventStyle(action: string): { Icon: LucideIcon; cls: string } {
  const a = action.toLowerCase();
  if (/reject/.test(a))
    return { Icon: XCircle, cls: "bg-red-100 text-red-700 dark:bg-red-950/60 dark:text-red-300" };
  if (/approv|signoff|sign_off|confirm/.test(a))
    return {
      Icon: CheckCircle2,
      cls: "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-300",
    };
  if (/stage_gate|advanced/.test(a)) return { Icon: TrendingUp, cls: "bg-primary/10 text-primary" };
  if (/created/.test(a)) return { Icon: PlusCircle, cls: "bg-primary/10 text-primary" };
  if (/deleted|unlinked/.test(a)) return { Icon: Trash2, cls: "bg-muted text-muted-foreground" };
  if (/linked/.test(a))
    return { Icon: Link2, cls: "bg-sky-100 text-sky-700 dark:bg-sky-950/60 dark:text-sky-300" };
  return { Icon: PencilLine, cls: "bg-muted text-muted-foreground" };
}

/**
 * History-Tab — das Audit-Log als vertikale Timeline: je Event ein Icon-Knoten
 * (typ-abhängig eingefärbt) auf einer durchgehenden Spine, die eigentliche
 * Meldung in einer Card. Ersetzt die flache divide-y-Liste. Rein.
 */
export function EpicHistoryTimeline({
  events,
  userLabels,
}: {
  events: HistoryEvent[];
  userLabels: Record<string, string>;
}) {
  if (events.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-lg border border-dashed bg-card/50 px-4 py-10 text-center">
        <History className="size-6 text-muted-foreground/60" />
        <p className="text-sm text-muted-foreground">Noch keine Historie.</p>
      </div>
    );
  }
  return (
    <ol className="space-y-0">
      {events.map((e, i) => {
        const { Icon, cls } = eventStyle(e.action);
        const last = i === events.length - 1;
        return (
          <li key={e.id} className="relative flex gap-3 pb-4">
            {!last && <span className="absolute top-6 bottom-0 left-[0.6875rem] w-px bg-border" />}
            <span
              className={`relative z-10 grid size-[1.375rem] shrink-0 place-items-center rounded-full ${cls}`}
            >
              <Icon className="size-3.5" />
            </span>
            <div className="min-w-0 flex-1 rounded-lg border bg-card px-3 py-2 shadow-xs">
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-sm">
                <span className="font-medium">{actionLabel(e.action)}</span>
                {e.detail && (
                  <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
                    {e.detail}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {userLabel(e.actorId, userLabels)}
                </span>
                <span className="ml-auto text-xs tabular-nums text-muted-foreground">
                  {new Date(e.occurredAt).toLocaleString("de-DE")}
                </span>
              </div>
              {e.comment && (
                <p className="mt-1 border-l-2 border-border pl-2 text-sm whitespace-pre-wrap text-foreground/80">
                  {e.comment}
                </p>
              )}
            </div>
          </li>
        );
      })}
    </ol>
  );
}
