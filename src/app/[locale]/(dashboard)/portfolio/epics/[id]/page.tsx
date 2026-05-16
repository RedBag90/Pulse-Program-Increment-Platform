import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { getEpic } from "@/server/services/initiative";
import { EpicEditForm } from "@/features/portfolio/components/epic-edit-form";
import { LbcEditor } from "@/features/portfolio/components/lbc-editor";
import { DeleteEpicButton } from "@/features/portfolio/components/delete-epic-button";
import { parseLeanBusinessCase } from "@/domain/lbc";
import { redirect } from "next/navigation";
import { Link } from "@/i18n/navigation";
import type { EpicId } from "@/domain/types";

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

interface Props {
  params: Promise<{ locale: string; id: string }>;
}

const STAGE_GATE_LABELS: Record<string, string> = {
  L0: "L0 Funnel",
  L1: "L1 Reviewing",
  L2: "L2 Analyzing",
  L3: "L3 Portfolio Backlog",
  L4: "L4 Implementing",
  L5: "L5 Done",
};

export default async function EpicDetailPage({ params }: Props) {
  const { id } = await params;

  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epic = await getEpic(db, principal.tenantId, id as EpicId);

  if (!epic) redirect("/portfolio/epics");

  const canEdit =
    principal.roles.includes("portfolio_editor") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  const lbc = parseLeanBusinessCase(epic.leanBusinessCase);

  return (
    <main className="p-8 max-w-4xl mx-auto space-y-8">
      <div>
        <Link href="/portfolio/epics" className="text-sm text-primary hover:underline">
          ← Back to epics
        </Link>
        <div className="flex items-center gap-3 mt-2">
          <h1 className="text-2xl font-semibold">{epic.title}</h1>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs">
            {STAGE_GATE_LABELS[epic.stageGate] ?? epic.stageGate}
          </span>
          {canEdit && (
            <div className="ml-auto">
              <DeleteEpicButton id={epic.id} title={epic.title} />
            </div>
          )}
        </div>
        <p className="text-sm text-muted-foreground mt-1">
          Value Stream: <span className="font-medium">{epic.valueStream?.name ?? "—"}</span>
        </p>
        {epic.approvedAt && (
          <p className="text-sm text-green-700 mt-1">
            Approved on {formatDate(epic.approvedAt)}
            {epic.approvalComment ? ` — “${epic.approvalComment}”` : ""}
          </p>
        )}
      </div>

      {canEdit ? (
        <EpicEditForm
          id={epic.id}
          currentTitle={epic.title}
          currentDescription={epic.description ?? ""}
        />
      ) : (
        <div className="space-y-4">
          <p className="text-foreground">{epic.description ?? "No description."}</p>
        </div>
      )}

      {canEdit && (
        <section>
          <h2 className="text-lg font-medium mb-4">Lean Business Case</h2>
          <LbcEditor epicId={epic.id} current={lbc.current} history={lbc.history} />
        </section>
      )}

      {epic.children.length > 0 && (
        <section>
          <h2 className="text-lg font-medium mb-3">Child Initiatives</h2>
          <ul className="space-y-2">
            {epic.children.map((child) => (
              <li key={child.id} className="flex items-center gap-3 text-sm border rounded p-3">
                <span className="rounded bg-muted px-2 py-0.5 text-xs">L{child.level}</span>
                <span className="font-medium">{child.title}</span>
                <span className="text-muted-foreground ml-auto">{child.status}</span>
              </li>
            ))}
          </ul>
        </section>
      )}
    </main>
  );
}
