import { Link } from "@/i18n/navigation";
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
import { SectionLabel } from "@/components/ui/section-label";
import { Stat } from "@/components/ui/stat";
import { formatPercent } from "@/lib/formatting";
import { thresholdTier } from "@/modules/work/domain/portfolio-ampel";
import type { EngagementGuardrailModel } from "@/modules/work/server/views/portfolio-guardrails-view";
import { GuardrailStatusBadge } from "./guardrail-status-badge";

/**
 * Guardrail 4 — Business-Owner-Engagement. Zwei Quoten (Abdeckung, Reaktion)
 * plus die Liste der ueberfaelligen Freigaben.
 *
 * Die Liste haengt bewusst an derselben Karte und nicht auf einer Unterseite:
 * ohne sie waere die Quote folgenlos — man saehe, dass etwas klemmt, aber nicht
 * wo. Leerer Scope ergibt einen Empty State, keine 0-%-Ampel; ein junger Tenant
 * stuende sonst grundlos auf Rot.
 */
export function BoEngagementCard({ model }: { model: EngagementGuardrailModel }) {
  const {
    scopeCount,
    coveredCount,
    coverageRatio,
    approvalCount,
    timelyCount,
    responseRatio,
    overdue,
    coverageTarget,
    responseDays,
    status,
  } = model;

  return (
    <Card className="gap-3">
      <CardHeader>
        <CardTitle>Business-Owner-Engagement</CardTitle>
        <CardDescription className="text-xs">
          Guardrail 4 · {scopeCount} Epics im Freigabelauf
        </CardDescription>
        <CardAction>
          <GuardrailStatusBadge status={status} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {scopeCount === 0 ? (
          <EmptyState
            title="Noch keine Epics im Freigabelauf"
            body="Die Messung startet, sobald das erste Epic seinen Business Case einreicht."
            className="p-6"
          />
        ) : (
          <div className="space-y-4">
            <Quote
              label="Abdeckung"
              ratio={coverageRatio}
              target={coverageTarget / 100}
              targetLabel={`Ziel ${coverageTarget} %`}
              note={`${coveredCount} von ${scopeCount} Epics mit benanntem Business Owner`}
            />
            <Quote
              label={`Reaktion ≤ ${responseDays} Tage`}
              ratio={responseRatio}
              target={coverageTarget / 100}
              targetLabel={`Ziel ${coverageTarget} %`}
              note={
                approvalCount === 0
                  ? "Noch keine Freigabe angefordert"
                  : `${timelyCount} von ${approvalCount} Freigaben rechtzeitig bedient`
              }
            />

            <div className="border-t pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <SectionLabel>Überfällig</SectionLabel>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {overdue.length}
                </span>
              </div>
              {overdue.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  Keine offene Freigabe älter als {responseDays} Tage.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <tbody>
                    {overdue.map((o) => (
                      <tr key={o.epicId} className="border-b last:border-0">
                        <td className="py-1.5 pr-2">
                          <Link
                            href={`/portfolio/epics/${o.epicId}`}
                            className="block truncate font-medium hover:text-primary hover:underline"
                            title={o.epicTitle}
                          >
                            {o.epicTitle}
                          </Link>
                        </td>
                        {/* „nicht zugewiesen" ist ein anderer Mangel als „liegt lange"
                            — und der einzige, den man sofort beheben kann. */}
                        <td
                          className={`py-1.5 pr-2 text-xs ${
                            o.approverLabel == null ? "text-destructive" : "text-muted-foreground"
                          }`}
                        >
                          {o.approverLabel ?? "nicht zugewiesen"}
                        </td>
                        <td className="whitespace-nowrap py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {o.daysOpen} T
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

/** Eine Quote: Kennzahl + Herleitung + derselbe Soll-Marker wie die Mix-Karten. */
function Quote({
  label,
  ratio,
  target,
  targetLabel,
  note,
}: {
  label: string;
  ratio: number | null;
  target: number;
  targetLabel: string;
  note: string;
}) {
  return (
    <div>
      <Stat
        label={label}
        value={ratio == null ? "—" : formatPercent(ratio)}
        delta={{ tone: "flat", text: note }}
        className="px-0 py-0"
      />
      <div className="mt-3">
        {/* Fill traegt die Ampelfarbe der Quote selbst (90/70 wie im LPM-Review). */}
        <ProgressBar
          actual={ratio}
          target={target}
          tier={ratio == null ? "neutral" : thresholdTier(ratio)}
          targetLabel={targetLabel}
        />
      </div>
    </div>
  );
}
