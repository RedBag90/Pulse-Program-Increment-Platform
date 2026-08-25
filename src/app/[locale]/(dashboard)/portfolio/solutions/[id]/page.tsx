import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { hasCapability } from "@/server/auth/authorize";
import { loadSolutionDetail } from "@/modules/work/server/views/solution-detail";
import { SolutionDetailView } from "@/modules/work/features/portfolio/components/solutions/solution-detail-view";
import { Page } from "@/components/layout";

export default async function SolutionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const model = await loadSolutionDetail(db, principal.tenantId, id);
  if (!model) notFound();

  const canManage = hasCapability(principal, "solution.manage", { tenantId: principal.tenantId });

  return (
    <Page>
      <Link
        href="/portfolio/solutions"
        className="mb-4 inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
      >
        <ArrowLeft className="size-4" />
        Solutions
      </Link>
      <SolutionDetailView model={model} canManage={canManage} />
    </Page>
  );
}
