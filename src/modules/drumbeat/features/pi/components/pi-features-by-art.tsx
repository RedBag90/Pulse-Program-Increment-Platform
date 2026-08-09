import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  AssignFeaturesDialog,
  RemoveFromPiButton,
} from "@/modules/drumbeat/features/pi/components/assign-features-dialog";

interface Feature {
  id: string;
  title: string;
  status: string;
  wsjfComputed: number | null;
}

interface Candidate {
  id: string;
  title: string;
  wsjfComputed: number | null;
  currentPiName: string | null;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

/**
 * One Features sub-card per subscribed ART on the PI detail page. The PI
 * lives on a Timeline and may serve several ARTs; rendering features grouped
 * by ART keeps responsibility visible — each row is a Feature owned by that
 * ART, and the +/- controls dispatch with the right `artId` for authorisation.
 */
export function PiFeaturesByArt({
  art,
  features,
  candidates,
  canEdit,
  piId,
}: {
  art: { id: string; name: string };
  features: Feature[];
  candidates: Candidate[];
  canEdit: boolean;
  piId: string;
}) {
  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between border-b px-4 py-2.5">
        <div className="flex items-center gap-2">
          <Link href={`/art/${art.id}`} className="text-sm font-semibold hover:underline">
            {art.name}
          </Link>
          <span className="text-xs text-muted-foreground">
            {features.length} Feature{features.length === 1 ? "" : "s"}
          </span>
        </div>
        {canEdit && <AssignFeaturesDialog piId={piId} artId={art.id} candidates={candidates} />}
      </div>

      {features.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          Noch keine Features dieser ART im PI.
        </p>
      ) : (
        <div className="divide-y divide-border">
          {features.map((feature) => (
            <div key={feature.id} className="flex items-center justify-between px-4 py-3 text-sm">
              <Link
                href={`/feature/${feature.id}`}
                className="font-medium transition-colors hover:text-primary"
              >
                {feature.title}
              </Link>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                {feature.wsjfComputed !== null && (
                  <Badge className="border-primary/20 bg-primary/10 font-medium text-primary">
                    WSJF {Number(feature.wsjfComputed).toFixed(2)}
                  </Badge>
                )}
                <span
                  className={`inline-block rounded-full px-2 py-0.5 ${
                    STATUS_BADGE[feature.status] ?? "bg-muted text-muted-foreground"
                  }`}
                >
                  {feature.status}
                </span>
                {canEdit && <RemoveFromPiButton featureId={feature.id} artId={art.id} />}
              </div>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
