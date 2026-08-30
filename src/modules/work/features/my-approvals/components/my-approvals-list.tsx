import { Link } from "@/i18n/navigation";
import { PageSection } from "@/components/layout";
import { ApprovalActions } from "@/modules/work/features/my-approvals/components/approval-actions";
import type { MyApprovalRow } from "@/modules/work/server/services/my-approvals";

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
  const bits: string[] = [];
  if (row.context.fromGate && row.context.toGate) {
    bits.push(`${row.context.fromGate} → ${row.context.toGate}`);
  }
  if (row.context.roleLabel) bits.push(row.context.roleLabel);
  if (row.context.valueStreamName) bits.push(row.context.valueStreamName);
  if (row.context.artName) bits.push(row.context.artName);
  if (row.context.parentTitle) bits.push(row.context.parentTitle);
  return (
    <p className="text-xs text-muted-foreground">{bits.length > 0 ? bits.join(" · ") : "—"}</p>
  );
}

export function MyApprovalsList({ rows }: { rows: MyApprovalRow[] }) {
  const byKind = new Map<MyApprovalRow["kind"], MyApprovalRow[]>();
  for (const r of rows) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }

  return (
    <section className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Meine Freigaben</h2>
        <p className="text-sm text-muted-foreground">
          Alle Freigaben, die aktuell auf deine Entscheidung warten.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 px-6 py-8 text-center">
          <p className="text-sm text-muted-foreground">Nichts Offenes — alle Freigaben erledigt.</p>
        </div>
      ) : (
        KIND_ORDER.filter((k) => (byKind.get(k)?.length ?? 0) > 0).map((kind) => {
          const group = byKind.get(kind)!;
          return (
            <PageSection
              key={kind}
              title={KIND_LABELS[kind]}
              actions={<span className="text-xs text-muted-foreground">{group.length} offen</span>}
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
