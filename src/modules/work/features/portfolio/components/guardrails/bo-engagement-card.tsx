import { useLocale, useTranslations } from "next-intl";
import type { Locale } from "@/i18n/routing";
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
  const t = useTranslations();
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
        <CardTitle>{t("work.guardrails.businessOwnerEngagement")}</CardTitle>
        <CardDescription className="text-xs">
          {t("work.guardrails.guardrail4EpicsImFreigabelauf", { count: scopeCount })}
        </CardDescription>
        <CardAction>
          <GuardrailStatusBadge status={status} />
        </CardAction>
      </CardHeader>
      <CardContent>
        {scopeCount === 0 ? (
          <EmptyState
            title={t("work.guardrails.nochKeineEpicsIm")}
            body={t("work.guardrails.dieMessungStartetSobald")}
            className="p-6"
          />
        ) : (
          <div className="space-y-4">
            <Quote
              label={t("work.guardrails.abdeckung")}
              ratio={coverageRatio}
              target={coverageTarget / 100}
              targetLabel={t("work.guardrails.zielProzent", { target: coverageTarget })}
              note={t("work.guardrails.epicsMitBenanntemBusinessOwner", {
                covered: coveredCount,
                scope: scopeCount,
              })}
            />
            <Quote
              label={t("work.guardrails.reaktionInTagen", { days: responseDays })}
              ratio={responseRatio}
              target={coverageTarget / 100}
              targetLabel={t("work.guardrails.zielProzent", { target: coverageTarget })}
              note={
                approvalCount === 0
                  ? t("work.guardrails.nochKeineFreigabeAngefordert")
                  : t("work.guardrails.freigabenRechtzeitigBedient", {
                      timely: timelyCount,
                      total: approvalCount,
                    })
              }
            />

            <div className="border-t pt-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <SectionLabel>{t("work.guardrails.ueberfaellig")}</SectionLabel>
                <span className="font-mono text-xs tabular-nums text-muted-foreground">
                  {overdue.length}
                </span>
              </div>
              {overdue.length === 0 ? (
                <p className="text-xs text-muted-foreground">
                  {t("work.guardrails.keineOffeneFreigabeAelterAls", { days: responseDays })}
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
                          {o.approverLabel ?? t("work.guardrails.freigabeNichtZugewiesen")}
                        </td>
                        <td className="whitespace-nowrap py-1.5 text-right font-mono text-xs tabular-nums text-muted-foreground">
                          {t("work.guardrails.tageKurz", { days: o.daysOpen })}
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
  const locale = useLocale() as Locale;
  return (
    <div>
      <Stat
        label={label}
        value={ratio == null ? "—" : formatPercent(ratio, locale)}
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
