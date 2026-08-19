import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { authorize } from "@/server/auth/authorize";
import { loadControllingModel } from "@/modules/budgeting/server/views/controlling-overview";
import { CaptureRevisionButton } from "@/modules/budgeting/features/components/revision/capture-revision-button";
import { GuardrailTargetsForm } from "@/modules/work/features/portfolio/components/guardrail-targets-form";
import { GuardrailTargetsReadOnly } from "@/modules/work/features/portfolio/components/guardrail-targets-readonly";
import { SectionLabel } from "@/components/ui/section-label";
import { Stat, StatStrip } from "@/components/ui/stat";
import { formatEUR } from "@/lib/formatting";
import { userLabel } from "@/components/detail/initiative-labels";
import { Link } from "@/i18n/navigation";
import { Page, PageHeader } from "@/components/layout";

/**
 * Controlling-Übersicht — die Landing-Seite für budgetdisziplin und
 * KPI-Wertbeitrag. Surfacet die aktuelle Budget-Plan-Revision (oder eine
 * Empty-State-CTA, wenn noch keine existiert), eine Liste vergangener
 * Revisionen und die KPI-Tree-Headlines.
 */
export default async function ControllingOverviewPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });

  const canCapture = authorize(
    "budget_plan.revision.capture",
    { tenantId: principal.tenantId },
    principal,
  ).allow;
  const canManageTargets = authorize(
    "target.manage",
    { tenantId: principal.tenantId },
    principal,
  ).allow;

  const { cycleLabel, latest, latestIsCurrentCycle, history, userLabels, guardrailTargets } =
    await loadControllingModel(db, principal.tenantId, { canCapture, canManageTargets });

  return (
    <Page>
      <PageHeader
        title="Controlling-Übersicht"
        subtitle="Budget-Disziplin und Wertbeitrag in einer Sicht."
      />

      <StatStrip>
        <Stat
          label="Aktiver Zyklus"
          value={<span className="text-xl">{cycleLabel}</span>}
          delta={
            latest
              ? {
                  tone: latestIsCurrentCycle ? "up" : "flat",
                  text: latestIsCurrentCycle
                    ? "Aktuelle Revision verfügbar"
                    : `Letzte Revision: ${latest.cycleLabel}`,
                }
              : { tone: "down", text: "Noch keine Revision" }
          }
        />
        <Stat
          label="Σ Zyklus-Budget"
          value={<span className="text-xl">{latest ? formatEUR(latest.cycleBudgetSum) : "—"}</span>}
          {...(latest && {
            delta: { tone: "flat" as const, text: `${latest.epicCount} Epics priorisiert` },
          })}
        />
        <Stat
          label="Σ Folgebudgets"
          value={
            <span className="text-xl">{latest ? formatEUR(latest.followBudgetSum) : "—"}</span>
          }
        />
      </StatStrip>

      {/* Aktuelle Revision */}
      <section className="space-y-3">
        <div className="flex items-baseline justify-between">
          <SectionLabel>Aktuelle Revision</SectionLabel>
          {canCapture && (
            <CaptureRevisionButton
              cycleLabel={cycleLabel}
              variant={latest ? "compact" : "primary"}
            />
          )}
        </div>
        {latest ? (
          <div className="rounded-lg border bg-card p-4">
            <div className="flex items-baseline justify-between">
              <p className="text-sm">
                <span className="font-medium">{latest.cycleLabel}</span> · erfasst am{" "}
                {latest.capturedAt.toLocaleDateString("de-DE")} von{" "}
                {userLabel(latest.capturedBy, userLabels)}
              </p>
              <Link
                href={`/budgeting/budget-plan/${latest.id}`}
                className="text-sm font-medium text-primary hover:underline"
              >
                Volle Revision öffnen →
              </Link>
            </div>
            <div className="mt-3 grid grid-cols-3 gap-3 text-xs">
              <div>
                <p className="text-muted-foreground">Top-Epics (Σ-Budget)</p>
                <ul className="mt-1 space-y-0.5">
                  {latest.snapshot.epics.slice(0, 5).map((e, i) => (
                    <li key={e.epicId} className="flex justify-between gap-2">
                      <span className="truncate">
                        <span className="text-muted-foreground">{i + 1}.</span> {e.title}
                      </span>
                      <span className="shrink-0 tabular-nums">{formatEUR(e.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground">Wertströme</p>
                <ul className="mt-1 space-y-0.5">
                  {latest.snapshot.valueStreams.slice(0, 5).map((vs) => (
                    <li key={vs.valueStreamId} className="flex justify-between gap-2">
                      <span className="truncate">{vs.name}</span>
                      <span className="shrink-0 tabular-nums">{formatEUR(vs.total)}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="text-muted-foreground">Halbjahres-Pool</p>
                <ul className="mt-1 space-y-0.5">
                  {latest.snapshot.periods.map((p) => (
                    <li key={p.key} className="flex justify-between gap-2">
                      <span>{p.label}</span>
                      <span className="shrink-0 tabular-nums">
                        {formatEUR(latest.snapshot.budgetPoolByPeriod[p.key] ?? 0)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        ) : (
          <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-10 text-center">
            <p className="text-sm text-muted-foreground">
              Noch keine Budget-Plan-Revision erfasst. Friere den aktuellen Stand der teilnehmenden
              Budgetierung ein, um eine reproduzierbare Sicht je Halbjahr zu erhalten.
            </p>
            {canCapture && (
              <div className="mt-4 flex justify-center">
                <CaptureRevisionButton cycleLabel={cycleLabel} variant="primary" />
              </div>
            )}
          </div>
        )}
      </section>

      {/* Portfolio-Guardrails — Targets-Pflege */}
      <section className="space-y-3">
        <SectionLabel>Portfolio-Guardrails</SectionLabel>
        {canManageTargets ? (
          <GuardrailTargetsForm targets={guardrailTargets} />
        ) : (
          <GuardrailTargetsReadOnly targets={guardrailTargets} />
        )}
      </section>

      {/* Vergangene Revisionen */}
      {history.length > 1 && (
        <section className="space-y-3">
          <SectionLabel>Vergangene Revisionen</SectionLabel>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Zyklus</th>
                  <th className="px-3 py-2">Erfasst am</th>
                  <th className="px-3 py-2">Erfasst von</th>
                  <th className="px-3 py-2 text-right">Epics</th>
                  <th className="px-3 py-2 text-right">Σ Zyklus-Budget</th>
                  <th className="px-3 py-2 text-right">Σ Folgebudgets</th>
                </tr>
              </thead>
              <tbody>
                {history.map((h) => (
                  <tr key={h.id} className="border-b last:border-b-0 hover:bg-muted/30">
                    <td className="px-3 py-2">
                      <Link
                        href={`/budgeting/budget-plan/${h.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {h.cycleLabel}
                      </Link>
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {h.capturedAt.toLocaleString("de-DE", {
                        day: "2-digit",
                        month: "2-digit",
                        year: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      {userLabel(h.capturedBy, userLabels)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{h.epicCount}</td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {formatEUR(h.cycleBudgetSum)}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-muted-foreground">
                      {formatEUR(h.followBudgetSum)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}
    </Page>
  );
}
