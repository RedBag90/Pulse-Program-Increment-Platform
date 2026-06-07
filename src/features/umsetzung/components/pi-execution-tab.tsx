"use client";

import { useActionState, startTransition } from "react";
import { Play, PauseOctagon, CheckCircle2, XCircle, RotateCw, type LucideIcon } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { setFeatureDeliveryStatusAction } from "@/features/art/actions/feature";
import { canDeliveryTransition, type DeliveryStatus } from "@/domain/initiative-status";

export interface ExecutionFeature {
  id: string;
  title: string;
  status: string;
  wsjfJobSize: number | null;
  wsjfComputed: number | null;
  ownerLabel: string | null;
}

interface Props {
  features: ExecutionFeature[];
  canTransition: boolean;
}

const COLUMNS: { key: DeliveryStatus; label: string; tone: string }[] = [
  { key: "approved", label: "Bereit", tone: "bg-muted/40 border-input" },
  { key: "in_progress", label: "In Umsetzung", tone: "bg-blue-50 border-blue-200" },
  { key: "blocked", label: "Blockiert", tone: "bg-red-50 border-red-200" },
  { key: "completed", label: "Abgeschlossen", tone: "bg-emerald-50 border-emerald-200" },
];

const TRANSITION_LABEL: Record<DeliveryStatus, string> = {
  approved: "→ Bereit",
  in_progress: "→ Start",
  blocked: "→ Block",
  completed: "→ Abschluss",
  cancelled: "→ Abbruch",
};
const TRANSITION_ICON: Record<DeliveryStatus, LucideIcon> = {
  approved: RotateCw,
  in_progress: Play,
  blocked: PauseOctagon,
  completed: CheckCircle2,
  cancelled: XCircle,
};

/**
 * Execution-Tab: Feature-Kanban gefiltert auf den PI. Vier Spalten
 * (Bereit · In Umsetzung · Blockiert · Abgeschlossen) plus
 * Click-to-transition-Knoepfe pro Card, gated auf
 * feature.delivery.set. Drag&Drop kommt spaeter; click first.
 */
export function PiExecutionTab({ features, canTransition }: Props) {
  if (features.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Keine Features auf dieses PI zugeordnet. Verteile Features im Plan-Tab oder auf der
          Features-Uebersicht.
        </p>
      </section>
    );
  }

  // Nur Status, die zum Delivery-Lifecycle gehoeren — draft/in_review werden
  // im Approval-Tab (Roadmap-P2.C) angezeigt, nicht hier.
  const buckets: Record<string, ExecutionFeature[]> = Object.fromEntries(
    COLUMNS.map((c) => [c.key, []]),
  );
  const off: ExecutionFeature[] = [];
  for (const f of features) {
    if (Object.prototype.hasOwnProperty.call(buckets, f.status)) {
      buckets[f.status]!.push(f);
    } else {
      off.push(f);
    }
  }

  return (
    <div className="space-y-4">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {COLUMNS.map((col) => (
          <section key={col.key} className={`rounded-lg border ${col.tone}`}>
            <header className="flex items-center justify-between border-b px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              <span>{col.label}</span>
              <span className="tabular-nums">{buckets[col.key]!.length}</span>
            </header>
            <ul className="space-y-2 p-2">
              {buckets[col.key]!.length === 0 ? (
                <li className="rounded-md border border-dashed py-4 text-center text-[11px] text-muted-foreground/60">
                  leer
                </li>
              ) : (
                buckets[col.key]!.map((f) => (
                  <FeatureCard key={f.id} feature={f} canTransition={canTransition} />
                ))
              )}
            </ul>
          </section>
        ))}
      </div>

      {off.length > 0 && (
        <section className="rounded-lg border bg-card p-4">
          <h3 className="text-sm font-medium">
            Andere ({off.length}) — z.B. draft / in_review / cancelled
          </h3>
          <ul className="mt-2 space-y-1.5">
            {off.map((f) => (
              <li key={f.id} className="text-sm text-muted-foreground">
                <Link
                  href={`/umsetzung/feature/${f.id}` as never}
                  className="text-primary hover:underline"
                >
                  {f.title}
                </Link>
                <span className="ml-2 rounded bg-muted px-1.5 text-[10px]">{f.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </div>
  );
}

function FeatureCard({
  feature,
  canTransition,
}: {
  feature: ExecutionFeature;
  canTransition: boolean;
}) {
  const allowed = (["approved", "in_progress", "blocked", "completed"] as DeliveryStatus[]).filter(
    (to) => canDeliveryTransition(feature.status, to),
  );

  return (
    <li className="space-y-2 rounded-md border bg-background p-2 text-xs">
      <Link
        href={`/umsetzung/feature/${feature.id}` as never}
        className="block truncate font-medium text-primary hover:underline"
        title={feature.title}
      >
        {feature.title}
      </Link>
      <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
        {feature.wsjfJobSize != null && (
          <span className="rounded bg-muted px-1.5 py-0.5 tabular-nums">
            JS {feature.wsjfJobSize}
          </span>
        )}
        {feature.wsjfComputed != null && (
          <span className="rounded bg-muted px-1.5 py-0.5 tabular-nums">
            WSJF {feature.wsjfComputed.toFixed(2)}
          </span>
        )}
        {feature.ownerLabel && <span>· {feature.ownerLabel}</span>}
      </div>
      {canTransition && allowed.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {allowed.map((to) => (
            <TransitionButton key={to} featureId={feature.id} to={to} />
          ))}
        </div>
      )}
    </li>
  );
}

function TransitionButton({ featureId, to }: { featureId: string; to: DeliveryStatus }) {
  const [state, dispatch, pending] = useActionState(setFeatureDeliveryStatusAction, {});
  const Icon = TRANSITION_ICON[to];
  function fire() {
    const fd = new FormData();
    fd.set("id", featureId);
    fd.set("to", to);
    startTransition(() => dispatch(fd));
  }
  return (
    <button
      type="button"
      onClick={fire}
      disabled={pending}
      title={state.error ?? undefined}
      className="inline-flex items-center gap-1 rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium shadow-xs hover:bg-muted/50 disabled:opacity-50"
    >
      <Icon className="size-3" />
      {TRANSITION_LABEL[to]}
    </button>
  );
}
