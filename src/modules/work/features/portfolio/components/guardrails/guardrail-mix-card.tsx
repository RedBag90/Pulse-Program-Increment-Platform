import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardAction,
  CardContent,
} from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { ProgressBar } from "@/components/ui/progress-bar";
import { formatCompactEUR, formatPercent, formatPp } from "@/lib/formatting";
import type {
  GuardrailStatus,
  MixRow,
} from "@/modules/work/server/views/portfolio-guardrails-view";
import { GuardrailStatusBadge } from "./guardrail-status-badge";

/** Welche der zwei Sichten die Karte gerade zeigt. */
export type MixView = "count" | "amount";

/** Ein Bucket der Achse — Reihenfolge der Anzeige = Reihenfolge im Array. */
export interface MixBucketSpec<B extends string> {
  id: B;
  label: string;
  /** Farbwert des Ist-Balkens. */
  color: string;
}

/**
 * Eine Guardrail-Mix-Achse als Karte: je Bucket ein Ist-Balken mit Soll-Marker
 * und dem Delta in Prozentpunkten.
 *
 * Generisch ueber die Bucket-Menge — Horizon (4) und Capacity (2) sind
 * derselbe Bauteil, und eine spaetere dritte Mix-Achse braucht keinen neuen
 * Code. Rein praesentational; die Mathematik kommt fertig aus dem Page-Model.
 */
export function GuardrailMixCard<B extends string>({
  title,
  subtitle,
  view,
  buckets,
  rows,
  status,
  unclassifiedCount,
  unclassifiedAmount,
  unclassifiedNoun,
  totalCount,
  coverageThin,
}: {
  title: string;
  subtitle: string;
  view: MixView;
  buckets: ReadonlyArray<MixBucketSpec<B>>;
  rows: Record<B, MixRow>;
  status: GuardrailStatus;
  unclassifiedCount: number;
  unclassifiedAmount: number;
  /** Was den Epics fehlt — „Horizont" bzw. „Typ". */
  unclassifiedNoun: string;
  totalCount: number;
  coverageThin: boolean;
}) {
  const share = (r: MixRow) => (view === "count" ? r.countShare : r.amountShare);
  const delta = (r: MixRow) => (view === "count" ? r.deltaCount : r.deltaAmount);

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription className="text-xs">{subtitle}</CardDescription>
        <CardAction>
          <GuardrailStatusBadge status={status} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {status === "unknown" ? (
          <EmptyState
            title="Noch keine klassifizierten Epics"
            body={`Der Mix erscheint, sobald Epics einen ${unclassifiedNoun} tragen.`}
            className="p-6"
          />
        ) : (
          <>
            {/* pt-4 laesst Platz fuer die Soll-Beschriftung ueber dem ersten Balken. */}
            <ul className="space-y-3 pt-4">
              {buckets.map((b) => {
                const row = rows[b.id];
                const d = delta(row);
                return (
                  <li key={b.id} className="grid grid-cols-[92px_1fr_auto] items-center gap-3">
                    <span className="flex items-center gap-2 text-[13px] text-muted-foreground">
                      <span
                        className="size-2 shrink-0 rounded-[2px]"
                        style={{ backgroundColor: b.color }}
                        aria-hidden
                      />
                      <span className="truncate" title={b.label}>
                        {b.label}
                      </span>
                    </span>
                    <ProgressBar
                      actual={share(row)}
                      target={row.target}
                      tier="neutral"
                      color={b.color}
                      targetLabel={String(Math.round(row.target * 100))}
                      className="h-4"
                    />
                    <span className="text-right font-mono text-xs tabular-nums">
                      {formatPercent(share(row))}{" "}
                      <span className={deltaClass(d)}>{formatPp(d)}</span>
                    </span>
                  </li>
                );
              })}
            </ul>

            {/* Immer sichtbar, auch bei 0 — sonst liest man den Mix als vollstaendig. */}
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 border-t border-dashed pt-2.5 text-xs text-muted-foreground">
              <span>
                {unclassifiedCount} von {totalCount} Epics ohne {unclassifiedNoun}
                {totalCount > 0 && ` (${formatPercent(unclassifiedCount / totalCount)})`}
              </span>
              {view === "amount" && unclassifiedAmount > 0 && (
                <span>Σ {formatCompactEUR(unclassifiedAmount)} außerhalb des Mix</span>
              )}
            </div>

            {coverageThin && (
              <p className="mt-2 rounded-r-sm border-l-2 border-amber-500 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-700 dark:text-amber-400">
                Über 20 % unklassifiziert — der Mix ist nur ein Indiz.
              </p>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}

/**
 * Delta-Einfaerbung. Wiederholt bewusst die Ampel-Semantik (ueber Ziel = rot,
 * darunter = amber, innerhalb ±5 pp = neutral), statt eine zweite Skala
 * einzufuehren — 5 pp ist dieselbe Schwelle wie in `statusFor`.
 */
function deltaClass(delta: number): string {
  if (delta > 0.05) return "text-destructive";
  if (delta < -0.05) return "text-amber-600 dark:text-amber-400";
  return "text-muted-foreground";
}
