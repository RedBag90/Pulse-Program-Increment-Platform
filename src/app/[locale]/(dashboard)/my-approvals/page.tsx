import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listMyApprovals, type MyApprovalRow } from "@/server/services/my-approvals";
import { ApprovalActions } from "@/features/my-approvals/components/approval-actions";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";
import type { ApprovalParty } from "@/domain/business-case";
import type { ApprovalSection } from "@/domain/epic-approval";

/**
 * "Meine Freigaben" — the personal approval inbox. One page lists every pending
 * Epic approval assigned to the principal (Hypothesis, Party, Section),
 * grouped by kind. Feature-QS war hier 2026-06 entfernt — Features brauchen
 * keine Freigabe mehr.
 */

const KIND_LABELS: Record<MyApprovalRow["kind"], string> = {
  epic_hypothesis: "Epic-Hypothesen",
  epic_party: "Epic-Stakeholder-Freigaben",
  epic_section: "Epic-Abschnitte (Breakdown / KPIs)",
};

const KIND_ORDER: MyApprovalRow["kind"][] = ["epic_hypothesis", "epic_party", "epic_section"];

const PARTY_LABELS: Record<ApprovalParty, string> = {
  mgmt: "MGMT",
  business_owner: "Business Owner",
  finance: "Finance",
  irt_owner: "IRT-Owner",
  lace_vmo: "LACE/VMO",
};

const SECTION_LABELS: Record<ApprovalSection, string> = {
  breakdown: "Breakdown",
  kpis: "KPIs",
};

/** Renders the per-row context column — what makes this approval distinct. */
function ContextCell({ row }: { row: MyApprovalRow }) {
  const bits: string[] = [];
  if (row.context.party) bits.push(PARTY_LABELS[row.context.party]);
  if (row.context.section) bits.push(SECTION_LABELS[row.context.section]);
  if (row.context.valueStreamName) bits.push(row.context.valueStreamName);
  if (row.context.artName) bits.push(row.context.artName);
  if (row.context.parentTitle) bits.push(row.context.parentTitle);
  return (
    <p className="text-xs text-muted-foreground">{bits.length > 0 ? bits.join(" · ") : "—"}</p>
  );
}

export default async function MyApprovalsPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const rows = await listMyApprovals(db, principal);

  const byKind = new Map<MyApprovalRow["kind"], MyApprovalRow[]>();
  for (const r of rows) {
    const list = byKind.get(r.kind) ?? [];
    list.push(r);
    byKind.set(r.kind, list);
  }

  return (
    <main className="space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Meine Freigaben</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alle Freigaben, die aktuell auf deine Entscheidung warten — Hypothesen,
          Stakeholder-Freigaben und Abschnitts-Sign-offs in einer Liste.
        </p>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border bg-muted/30 px-6 py-12 text-center">
          <p className="text-sm text-muted-foreground">Nichts Offenes — alle Freigaben erledigt.</p>
        </div>
      ) : (
        <div className="space-y-8">
          {KIND_ORDER.filter((k) => (byKind.get(k)?.length ?? 0) > 0).map((kind) => {
            const group = byKind.get(kind)!;
            return (
              <section key={kind} className="space-y-2">
                <div className="flex items-baseline justify-between">
                  <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                    {KIND_LABELS[kind]}
                  </h2>
                  <span className="text-xs text-muted-foreground">{group.length} offen</span>
                </div>
                <div className="divide-y rounded-lg border">
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
              </section>
            );
          })}
        </div>
      )}
    </main>
  );
}
