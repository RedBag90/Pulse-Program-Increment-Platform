import { useTranslations } from "next-intl";
import { LinkDependencyDialog } from "@/modules/drumbeat/features/dependencies/components/link-dependency-dialog";
import { UnlinkDependencyButton } from "@/modules/drumbeat/features/dependencies/components/unlink-dependency-button";
import { DEPENDENCY_TYPE_KEYS } from "@/modules/drumbeat/domain/status";
import { DEPENDENCY_TYPE_CLASS } from "@/modules/drumbeat/features/lib/status-badges";
import type { DependencyEdge } from "@/modules/drumbeat/server/views/cockpit-feature-detail";

export type { DependencyEdge };

interface Props {
  featureId: string;
  artId: string | null;
  /** Kanten, in denen das Feature der `from`-Seite steht. */
  outgoing: DependencyEdge[];
  /** Kanten, in denen das Feature der `to`-Seite steht. */
  incoming: DependencyEdge[];
  /** Kandidaten fuer den Link-Dialog — Features im selben ART (ohne sich selbst). */
  candidates: { id: string; title: string }[];
  canEdit: boolean;
  /** Ein-Hop-Blocker (fuer den Fruehester-Start-Header). Optional. */
  blockerWindows?: { blockerId: string; blockerTitle: string; blockerEndDate: Date | null }[];
  /** Abgeleiteter fruehester Start. Optional — nur gerendert, wenn Blocker existieren. */
  blockerSummary?: { earliest: Date | null; unscheduledBlockers: string[] };
}

/**
 * Dependencies-Tab des Feature-Details. Zeigt ein- und ausgehende
 * Kanten in zwei Sektionen, mit Link-Dialog (gated auf
 * `dependency.link`-Capability) und Unlink-Buttons.
 */
export function FeatureDependenciesTab({
  featureId,
  artId,
  outgoing,
  incoming,
  candidates,
  canEdit,
  blockerWindows,
  blockerSummary,
}: Props) {
  const t = useTranslations();
  return (
    <div className="space-y-6">
      {blockerWindows && blockerWindows.length > 0 && blockerSummary && (
        <div className="rounded-lg border bg-muted/30 px-4 py-2 text-sm">
          <p>
            <span className="font-medium">{t("drumbeat.ui.fruehestmoeglicherStart")} </span>
            {blockerSummary.earliest
              ? blockerSummary.earliest.toISOString().slice(0, 10)
              : t("drumbeat.ui.startUnbestimmt")}
            {blockerSummary.unscheduledBlockers.length > 0 && (
              <span className="ml-2 text-xs text-muted-foreground">
                {t("drumbeat.ui.blockerNochUngeplant", {
                  count: blockerSummary.unscheduledBlockers.length,
                  names: blockerSummary.unscheduledBlockers.slice(0, 3).join(", "),
                })}
              </span>
            )}
          </p>
        </div>
      )}

      <section className="rounded-lg bg-card p-6 shadow-card">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">{t("drumbeat.ui.ausgehendeDependencies")}</h2>
            <p className="text-sm text-muted-foreground">
              {t("drumbeat.ui.wasDiesesFeatureBlockiertOderBeruehrt")}
            </p>
          </div>
          {canEdit && artId && (
            <LinkDependencyDialog fromId={featureId} artId={artId} candidates={candidates} />
          )}
        </header>
        <EdgeList
          featureId={featureId}
          artId={artId}
          edges={outgoing}
          canEdit={canEdit}
          direction="from"
          emptyHint="Keine ausgehenden Dependencies."
        />
      </section>

      <section className="rounded-lg bg-card p-6 shadow-card">
        <header className="mb-3">
          <h2 className="text-lg font-medium">{t("drumbeat.ui.eingehendeDependencies")}</h2>
          <p className="text-sm text-muted-foreground">{t("drumbeat.ui.wasAndereFeaturesAuf")}</p>
        </header>
        <EdgeList
          featureId={featureId}
          artId={artId}
          edges={incoming}
          canEdit={false}
          direction="to"
          emptyHint="Keine eingehenden Dependencies."
        />
      </section>
    </div>
  );
}

function EdgeList({
  featureId,
  artId,
  edges,
  canEdit,
  direction,
  emptyHint,
}: {
  featureId: string;
  artId: string | null;
  edges: DependencyEdge[];
  canEdit: boolean;
  direction: "from" | "to";
  emptyHint: string;
}) {
  const t = useTranslations();
  if (edges.length === 0) {
    return (
      <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
        {emptyHint}
      </p>
    );
  }
  return (
    <ul className="space-y-1.5">
      {edges.map((edge) => (
        <li
          key={edge.id}
          className="flex items-center justify-between gap-3 rounded-md border bg-muted/20 px-3 py-2"
        >
          <div className="flex flex-wrap items-center gap-2 text-sm">
            <span
              className={`rounded-full px-2 py-0.5 text-meta ${DEPENDENCY_TYPE_CLASS[edge.type]}`}
            >
              {t(DEPENDENCY_TYPE_KEYS[edge.type])}
            </span>
            <span>{edge.other.title}</span>
          </div>
          {canEdit && artId && (
            <UnlinkDependencyButton
              fromId={direction === "from" ? featureId : edge.other.id}
              toId={direction === "from" ? edge.other.id : featureId}
              type={edge.type}
              artId={artId}
            />
          )}
        </li>
      ))}
    </ul>
  );
}
