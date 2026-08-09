import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { PiTransitionButton } from "@/modules/drumbeat/features/pi/components/pi-transition-button";
import { DeletePiButton } from "@/modules/drumbeat/features/pi/components/delete-pi-button";
import { PiOverviewSummary } from "@/modules/drumbeat/features/pi/components/pi-overview-summary";
import { PiFeaturesByArt } from "@/modules/drumbeat/features/pi/components/pi-features-by-art";
import { PiArtChips } from "@/modules/drumbeat/features/pi/components/pi-art-chips";

interface ArtSummary {
  id: string;
  name: string;
}

interface PiSummary {
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
}

interface Props {
  piId: string;
  pi: PiSummary;
  timelineName: string;
  arts: ArtSummary[];
  primaryArt: ArtSummary;
  summary: Parameters<typeof PiOverviewSummary>[0]["summary"];
  // Features by ART — passing through as `arts.map(...)` rendering
  featuresByArt: Map<string, Parameters<typeof PiFeaturesByArt>[0]["features"]>;
  candidatesByArt: Map<string, Parameters<typeof PiFeaturesByArt>[0]["candidates"]>;
  featuresTotalCount: number;
  canEdit: boolean;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/**
 * Overview-Tab — identischer Inhalt wie die alte `/pi/[piId]/page.tsx` Body,
 * ohne den SubNav + Breadcrumb (die uebernimmt der Shell).
 */
export function PiOverviewTab({
  piId,
  pi,
  timelineName,
  arts,
  primaryArt,
  summary,
  featuresByArt,
  candidatesByArt,
  featuresTotalCount,
  canEdit,
}: Props) {
  const badgeClass = STATUS_BADGE[pi.status] ?? "bg-muted text-muted-foreground";
  const totalDays = Math.round(
    (pi.endDate.getTime() - pi.startDate.getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div className="space-y-6">
      <Card className="p-5">
        <div className="flex items-start gap-3">
          <div className="flex-1 space-y-2">
            <p className="text-sm text-muted-foreground">
              {formatDate(pi.startDate)} – {formatDate(pi.endDate)} ({totalDays} days)
            </p>
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <span>
                Timeline:{" "}
                <Link href={`/structure?tab=timeline`} className="font-medium hover:underline">
                  {timelineName}
                </Link>
                {" · "}
                {arts.length} ART{arts.length === 1 ? "" : "s"}:
              </span>
              <PiArtChips arts={arts} />
            </div>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span
              className={`inline-block rounded-full px-3 py-1 text-xs font-medium ${badgeClass}`}
            >
              {pi.status}
            </span>
            <PiTransitionButton piId={piId} currentStatus={pi.status} />
            {canEdit && pi.status === "planned" && (
              <DeletePiButton piId={piId} artId={primaryArt.id} name={pi.name} />
            )}
          </div>
        </div>
      </Card>

      <PiOverviewSummary summary={summary} piId={piId} artId={primaryArt.id} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Features ({featuresTotalCount})
        </h2>
        <div className="space-y-4">
          {arts.map((a) => (
            <PiFeaturesByArt
              key={a.id}
              art={a}
              features={featuresByArt.get(a.id) ?? []}
              candidates={candidatesByArt.get(a.id) ?? []}
              canEdit={canEdit && pi.status !== "completed"}
              piId={piId}
            />
          ))}
        </div>
      </section>
    </div>
  );
}
