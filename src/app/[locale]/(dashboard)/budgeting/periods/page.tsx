import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { loadPeriodsGallery } from "@/modules/budgeting/server/views/periods-gallery";
import { PeriodTileCard } from "@/modules/budgeting/features/components/period/period-tile";
import { CreatePeriodDialog } from "@/modules/budgeting/features/components/period/create-period-dialog";
import { BudgetingDefaultsForm } from "@/modules/budgeting/features/components/period/budgeting-defaults-form";
import { SectionLabel } from "@/components/ui/section-label";
import { Stat, StatStrip } from "@/components/ui/stat";
import { formatCompactEUR } from "@/lib/formatting";
import { Page, PageHeader } from "@/components/layout";

/**
 * Budgeting-Zeiträume als Kachel-Gallery. Je Kachel ein Zeitraum; in der Kachel
 * lebt der **ganze** Ablauf. Kommende + laufende Kacheln stehen im Fokus,
 * abgeschlossene wandern ausgegraut nach unten.
 *
 * Der Kopf trägt die vier Zahlen, die früher auf der Controlling-Seite standen —
 * dort bezogen sie sich auf einen tenant-weiten „aktiven Zyklus" und rechneten
 * gegen einen Topf, den niemand mehr pflegen konnte. Hier beziehen sie sich auf
 * die laufende Kachel.
 */
export default async function BudgetingPeriodsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const canManage = hasCapability(principal, "budget.round.manage", {
    tenantId: principal.tenantId,
  });
  const [model, tenant] = await Promise.all([
    loadPeriodsGallery(db, principal.tenantId, canManage),
    canManage
      ? db.tenant.findUnique({
          where: { id: principal.tenantId },
          select: { defaultHypothesisEffort: true },
        })
      : Promise.resolve(null),
  ]);
  // Jüngste Kachel (Gallery nach Start-Termin sortiert) für Topf-Vorgabe + Übernahme.
  const latest = model.focus[0] ?? model.past[0];

  return (
    <Page>
      <PageHeader
        eyebrow="Participatory Budgeting"
        title="Budgeting-Zeiträume"
        subtitle="Je Kachel ein Zeitraum — Beteiligte, Gruppen, Verteilung und Finalisierung leben darin."
        actions={
          model.canManage ? (
            <CreatePeriodDialog
              defaultPool={latest?.poolTotal ?? 0}
              hasPrevious={!!latest}
              carriableReserves={model.carriableReserves}
            />
          ) : undefined
        }
      />

      {model.active && (
        <StatStrip>
          <Stat
            label="Laufende Kachel"
            value={<span className="text-xl">{model.active.label}</span>}
            delta={{ tone: "flat", text: model.active.phase }}
          />
          <Stat
            label="Topf"
            value={<span className="text-xl">{formatCompactEUR(model.active.poolTotal)}</span>}
          />
          <Stat
            label="Abgaben"
            value={
              <span className="text-xl">
                {model.active.submittedCount} / {model.active.groupCount}
              </span>
            }
            delta={{
              tone:
                model.active.groupCount > 0 &&
                model.active.submittedCount >= model.active.groupCount
                  ? "up"
                  : "flat",
              text: `${model.active.participantCount} Beteiligte`,
            }}
          />
          <Stat
            label="Letzter Stand"
            value={<span className="text-xl">{model.lastCapturedLabel ?? "—"}</span>}
            delta={
              model.lastCapturedLabel
                ? { tone: "flat", text: "eingefroren" }
                : { tone: "down", text: "noch keiner" }
            }
          />
        </StatStrip>
      )}

      {model.canManage && (
        <div className="mb-6">
          <BudgetingDefaultsForm
            current={
              tenant?.defaultHypothesisEffort != null
                ? Number(tenant.defaultHypothesisEffort)
                : null
            }
          />
        </div>
      )}

      {model.focus.length === 0 && model.past.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Noch keine Budgeting-Zeiträume.{" "}
            {model.canManage ? "Lege die erste Kachel an." : "Ein Admin/Finance legt sie an."}
          </p>
        </div>
      ) : (
        <div className="space-y-6">
          {model.focus.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>Im Fokus</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {model.focus.map((t) => (
                  <PeriodTileCard key={t.id} tile={t} />
                ))}
              </div>
            </section>
          )}

          {model.past.length > 0 && (
            <section className="space-y-2">
              <SectionLabel>Abgeschlossen</SectionLabel>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {model.past.map((t) => (
                  <PeriodTileCard key={t.id} tile={t} muted />
                ))}
              </div>
            </section>
          )}
        </div>
      )}
    </Page>
  );
}
