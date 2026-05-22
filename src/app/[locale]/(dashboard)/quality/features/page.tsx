import { requirePrincipal } from "@/server/auth/principal";
import { createPrismaClient } from "@/server/db/prisma";
import { listFeaturesInReview } from "@/server/services/initiative-review";
import { ReviewDecisionButtons } from "@/features/quality/components/review-decision-buttons";
import { Link } from "@/i18n/navigation";
import { redirect } from "next/navigation";

/**
 * Feature-QS dashboard — Features submitted for quality review, scoped to the
 * RTE's ART(s). The RTE approves or sends them back.
 */
export default async function FeatureQualityPage() {
  const principal = await requirePrincipal().catch(() => null);
  if (!principal) redirect("/sign-in");

  const db = createPrismaClient({ userId: principal.id, tenantId: principal.tenantId });
  const scopedArtIds = principal.scopes.artIds;
  const features = await listFeaturesInReview(
    db,
    principal.tenantId,
    scopedArtIds.length > 0 ? scopedArtIds : undefined,
  );

  const canDecide =
    principal.roles.includes("rte") ||
    principal.roles.includes("tenant_admin") ||
    principal.roles.includes("platform_admin");

  return (
    <main className="mx-auto max-w-4xl space-y-6 p-8">
      <div>
        <h1 className="text-2xl font-semibold">Feature-Qualitätssicherung</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Features, die zur Qualitätssicherung eingereicht wurden.
        </p>
      </div>

      {features.length === 0 ? (
        <p className="text-sm text-muted-foreground">Aktuell keine Features zur Prüfung.</p>
      ) : (
        <div className="divide-y rounded-lg border">
          {features.map((feature) => (
            <div key={feature.id} className="flex items-center gap-4 px-4 py-3">
              <div className="min-w-0 flex-1">
                <Link href={feature.href} className="font-medium text-primary hover:underline">
                  {feature.title}
                </Link>
                <p className="text-xs text-muted-foreground">
                  {feature.parentTitle ?? "—"}
                  {feature.art ? ` · ${feature.art.name}` : ""}
                </p>
              </div>
              {canDecide ? (
                <ReviewDecisionButtons id={feature.id} kind="feature" />
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
