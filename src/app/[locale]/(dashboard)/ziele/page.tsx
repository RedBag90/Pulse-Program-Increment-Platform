import { Suspense } from "react";
import { redirect } from "next/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadZieleModel, type ZieleSubTab } from "@/server/views/ziele-view";
import { ZieleShell } from "@/features/ziele/components/ziele-shell";

/**
 * Ziele-Modul V2 (Konzept-Implementation Phase 1 — UI-Skelett).
 *
 * Vier Sub-Tabs (Strategie / OKRs / Money / Pflege); Default Strategie
 * mit hierarchischer Tree-Sicht. Edit-Affordances kommen mit Folge-
 * Phasen.
 *
 * Legacy-Route `/transformation/ziele` bleibt vorerst stehen; mit P7
 * wird sie auf `/ziele` redirected.
 */
function parseTab(raw: string | undefined): ZieleSubTab {
  return raw === "okrs" || raw === "money" || raw === "pflege" ? raw : "strategie";
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
  const layout = params.layout === "sankey" ? "sankey" : "tree";

  // OKR-Board braucht alle Quartale gleichzeitig — Period-Filter nur auf
  // Strategie + Money. (Konzept §4.2)
  const effectivePeriod = tab === "okrs" ? undefined : period;

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadZieleModel(db, principal, {
    tab,
    ...(effectivePeriod ? { period: effectivePeriod } : {}),
  });

  return (
    <Suspense fallback={null}>
      <ZieleShell model={model} layout={layout} />
    </Suspense>
  );
}
