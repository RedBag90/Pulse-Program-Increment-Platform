import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listEpicsInReview } from "@/server/services/initiative-review";
import { ReviewDecisionButtons } from "@/features/quality/components/review-decision-buttons";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

/**
 * VMO dashboard — Epics submitted for quality review. The VMO role approves
 * (`in_review → approved`) or sends them back (`→ draft`).
 */
export default async function EpicQualityPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const epics = await listEpicsInReview(db, principal.tenantId);

  const canDecide =
    principal.roles.includes("vmo") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">VMO — Epic-Qualitätssicherung</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Epics, die zur Qualitätssicherung eingereicht wurden.
        </p>
      </div>

      {epics.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aktuell keine Epics zur Prüfung.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {epics.map((epic) => (
            <div key={epic.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={epic.href} className="font-medium text-primary hover:underline">
                  {epic.title}
                </Link>
                {epic.valueStream && (
                  <p className="text-xs text-muted-foreground">{epic.valueStream.name}</p>
                )}
              </div>
              {canDecide ? (
                <ReviewDecisionButtons id={epic.id} kind="epic" />
              ) : (
                <span className="shrink-0 text-xs text-muted-foreground">in Prüfung</span>
              )}
            </div>
          ))}
        </div>
      )}
    </main>
  );
}
