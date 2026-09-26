import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { PageSection } from "@/components/layout";
import { ApprovalActions } from "@/modules/work/features/my-approvals/components/approval-actions";
import type { MyApprovalRow } from "@/modules/work/server/services/my-approvals";
import { gateStepLabel } from "@/modules/work/domain/stage-gate";

/**
 * „Meine Freigaben" — der persönliche Posteingang, nach Art gruppiert.
 *
 * Die Gruppierung ist geblieben, die Arten sind es nicht: Hypothesen- und
 * Stakeholder-Freigaben sind in die Reifegrad-Abnahmen aufgegangen, also steht
 * hier heute genau eine Gruppe. Server-Komponente; nur die Entscheid-Tasten
 * (`ApprovalActions`) sind Client-Code.
 */

const KIND_LABELS: Record<MyApprovalRow["kind"], string> = {
  epic_gate: "Reifegrad-Wechsel",
};

const KIND_ORDER: MyApprovalRow["kind"][] = ["epic_gate"];

/** Renders the per-row context column — what makes this approval distinct. */
function ContextCell({ row }: { row: MyApprovalRow }) {
  const t = useTranslations();
  const bits: string[] = [];
  if (row.context.fromGate && row.context.toGate) {
    // Bisher stand hier der rohe Schrittcode — dieselbe Beschriftung wie auf
    // der Gate-Karte, damit „L4" und „L4.1" nicht zwei Dinge zu sein scheinen.
    bits.push(
      `${gateStepLabel(row.context.fromGate, t)} → ${gateStepLabel(row.context.toGate, t)}`,
    );
  }
  if (row.context.roleLabelKey) bits.push(t(row.context.roleLabelKey));
  if (row.context.valueStreamName) bits.push(row.context.valueStreamName);
  if (row.context.artName) bits.push(row.context.artName);
  if (row.context.parentTitle) bits.push(row.context.parentTitle);
  return (
    <p className="text-xs text-muted-foreground">{bits.length > 0 ? bits.join(" · ") : "—"}</p>
  );
}

export function MyApprovalsList({ rows }: { rows: MyApprovalRow[] }) {
  const t = useTranslations();
  const byKind = new Map<MyApprovalRow["kind"], MyApprovalRow[]>();
  for (const r of rows) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">
          {t("work.myApprovals.meineFreigaben")}
        </h2>
        <p className="text-sm text-muted-foreground">
          {t("work.myApprovals.alleFreigabenDieAktuell")}
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">
            {t("work.myApprovals.nichtsOffenesAlleFreigaben")}
          </p>
        </div>
      ) : (
        KIND_ORDER.filter((k) => (byKind.get(k)?.length ?? 0) > 0).map((kind) => {
          const group = byKind.get(kind)!;
          return (
            <PageSection
              key={kind}
              title={KIND_LABELS[kind]}
              actions={
                <span className="text-xs text-muted-foreground">
                  {t("work.myApprovals.anzahlOffen", { count: group.length })}
                </span>
              }
            >
              <div className="divide-y rounded-lg border" data-tour="approvals-list">
                {group.map((row) => (
                  <div
                    key={row.id}
                    className="grid gap-4 px-4 py-3 md:grid-cols-[1fr_auto] md:items-start"
                  >
                    <div className="min-w-0 space-y-1">
                      <Link href={row.href} className="font-medium text-primary hover:underline">
                        {row.title}
                      </Link>
                      <ContextCell row={row} />
                    </div>
                    <div className="shrink-0 md:min-w-[320px]">
                      <ApprovalActions row={row} />
                    </div>
                  </div>
                ))}
              </div>
            </PageSection>
          );
        })
      )}
    </section>
  );
}
