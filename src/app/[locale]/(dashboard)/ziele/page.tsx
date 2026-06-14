import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadZieleModel, type ZieleSubTab } from "@/server/views/ziele-view";
import { ZieleShell } from "@/features/ziele/components/ziele-shell";

/**
 * Ziele-Modul — reine **Wert-Anzeige** (Refactor-Plan Stage D).
 *
 * Drei Sub-Tabs: Strategie · OKRs · Money. Alle read-only. Pflege
 * der Strategie-Kaskade (Vision/Theme/Objective/KR) lebt unter
 * `/strategy`; KPI-Coverage + Bindungen unter `/controlling`.
 *
 * Auch wenn der User `target.manage` haette: hier ist kein Edit
 * sichtbar. Klicks auf Cards/Rows deeplinken nach `/strategy`.
 */
function parseTab(raw: string | undefined): ZieleSubTab {
  return raw === "okrs" || raw === "money" ? raw : "strategie";
}

interface PageProps {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}

export default async function ZielePage({ searchParams }: PageProps) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const params = await searchParams;
  const tab = parseTab(typeof params.tab === "string" ? params.tab : undefined);
  const period = typeof params.period === "string" ? params.period : undefined;
  const layout =
    params.layout === "sankey" || params.layout === "tabelle" || params.layout === "netzplan"
      ? params.layout
      : "tree";

  // OKR-Board braucht alle Quartale gleichzeitig — Period-Filter nur auf
  // Strategie + Money. (Konzept §4.2)
  const effectivePeriod = tab === "okrs" ? undefined : period;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const baseModel = await loadZieleModel(db, principal, {
    tab,
    ...(effectivePeriod ? { period: effectivePeriod } : {}),
  });

  // Ziele = nur Wert-Anzeige: Edit-Affordances erzwungen aus.
  const model = {
    ...baseModel,
    permissions: {
      ...baseModel.permissions,
      canEditStrategy: false,
      canEditKpiValuation: false,
    },
  };

  return (
    <Suspense fallback={null}>
      <ZieleShell model={model} layout={layout} mode="ziele" />
    </Suspense>
  );
}
