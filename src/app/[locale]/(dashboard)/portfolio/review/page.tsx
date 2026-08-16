import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { loadLpmReview } from "@/modules/work/server/views/lpm-review-view";
import { LpmReviewShell } from "@/modules/work/features/portfolio/components/lpm-review/lpm-review-shell-lazy";
import { redirect } from "next/navigation";

/**
 * LPM-Portfolio-Review (SAFe) — die eine Frage: liefert das Portfolio den
 * versprochenen wirtschaftlichen Benefit, und wo muss entschieden werden?
 * Drei Abschnitte (Portfolio gesamt · Value Streams · Epics) als Top-down-
 * Drilldown. Der Stichtag/PI ist Server-Input; der Value-Stream-Filter wirkt
 * client-seitig (Drilldown). Read-only-Gremiumssicht — RLS regelt die Sichtbarkeit.
 */
interface Props {
  searchParams: Promise<{ pi?: string }>;
}

export default async function LpmReviewPage({ searchParams }: Props) {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const { pi } = await searchParams;
  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const data = await loadLpmReview(db, principal.tenantId, {
    piId: typeof pi === "string" ? pi : undefined,
  });

  return <LpmReviewShell data={data} />;
}
