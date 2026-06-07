import { LinkDependencyDialog } from "@/features/dependencies/components/link-dependency-dialog";
import { UnlinkDependencyButton } from "@/features/dependencies/components/unlink-dependency-button";

export interface DependencyEdge {
  id: string;
  type: "blocks" | "depends_on" | "relates_to";
  /** Das andere Ende der Kante (nicht das aktuelle Feature). */
  other: { id: string; title: string };
}

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
}

const TYPE_LABEL: Record<DependencyEdge["type"], string> = {
  blocks: "blockiert",
  depends_on: "haengt ab von",
  relates_to: "bezieht sich auf",
};
const TYPE_CLASS: Record<DependencyEdge["type"], string> = {
  blocks: "bg-red-100 text-red-700",
  depends_on: "bg-amber-100 text-amber-700",
  relates_to: "bg-muted text-muted-foreground",
};

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
}: Props) {
  return (
    <div className="space-y-6">
      <section className="rounded-lg border bg-card p-6">
        <header className="mb-3 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-medium">Ausgehende Dependencies</h2>
            <p className="text-sm text-muted-foreground">
              Was dieses Feature blockiert oder wovon es abhaengt.
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

      <section className="rounded-lg border bg-card p-6">
        <header className="mb-3">
          <h2 className="text-lg font-medium">Eingehende Dependencies</h2>
          <p className="text-sm text-muted-foreground">
            Was andere Features auf dieses richten — read-only auf dieser Seite.
          </p>
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
            <span className={`rounded-full px-2 py-0.5 text-[11px] ${TYPE_CLASS[edge.type]}`}>
              {TYPE_LABEL[edge.type]}
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
