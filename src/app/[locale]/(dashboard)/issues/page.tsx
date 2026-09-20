import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { hasCapability } from "@/server/auth/authorize";
import { createPrismaClient } from "@/server/db/prisma";
import { loadIssues } from "@/modules/risks/server/views/issues";
import { listSavedFilters } from "@/server/services/saved-filter";
import {
  ISSUE_FILTER_KEYS,
  criteriaToParams,
  hasAnyCriteria,
} from "@/modules/risks/domain/issue-filter-keys";
import { IssuesListShell } from "@/modules/risks/features/issue/components/issues-list-shell";

/**
 * Issue register — the tenant-wide unified board of risks + impediments (ROAM
 * funnel + probability×impact matrix + facet filters + bulk), scoped reads
 * (`issueReadFilter`). Composition root for the merged risks/impediment surface.
 */
export default async function IssuesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const params = await searchParams;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const savedFilters = await listSavedFilters(db, principal, "issues", ISSUE_FILTER_KEYS);

  // **Auto-Standard**: keine Filter-Parameter in der URL UND kein „leer"-Marker
  // → den als Standard markierten Filter anwenden, und zwar als **Umleitung**,
  // damit die URL die eine Wahrheit bleibt und teilbar ist. Dasselbe Vorgehen
  // wie auf der Ziele-Seite und der Portfolio-Übersicht.
  const gesetzt = (k: string) => typeof params[k] === "string" && params[k] !== "";
  if (!ISSUE_FILTER_KEYS.some(gesetzt) && params["f"] !== "0") {
    const c = savedFilters.find((x) => x.isDefault)?.criteria;
    if (c && hasAnyCriteria(c)) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(criteriaToParams(c))) if (v) qs.set(k, v);
      redirect(`/issues?${qs.toString()}`);
    }
  }

  const { model, userLabels } = await loadIssues(db, principal, { kind: "tenant" });

  const scope = { tenantId: principal.tenantId };
  const caps = {
    canDocument: hasCapability(principal, "risk.document", scope),
    canUpdate: hasCapability(principal, "risk.update", scope),
    canRoam: hasCapability(principal, "risk.roam", scope),
    canLink: hasCapability(principal, "risk.link", scope),
    canDelete: hasCapability(principal, "risk.delete", scope),
    canReview: hasCapability(principal, "risk.review", scope),
    canManageSettings: hasCapability(principal, "risk.settings.manage", scope),
  };

  return (
    <Suspense fallback={null}>
      <IssuesListShell
        model={model}
        userLabels={userLabels}
        caps={caps}
        savedFilters={savedFilters}
      />
    </Suspense>
  );
}
