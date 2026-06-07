import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";

export interface PiDependencyEdge {
  id: string;
  type: "blocks" | "depends_on" | "relates_to";
  /** Feature, das im aktuellen PI sitzt — die „Heim"-Seite der Kante. */
  here: { id: string; title: string };
  /** Anderes Feature der Kante. */
  other: { id: string; title: string; piName: string | null; piId: string | null };
  /** Richtung: out = unser PI-Feature blockiert/haengt ab vom anderen,
   *  in = das andere richtet sich auf unser PI-Feature. */
  direction: "out" | "in";
}

interface Props {
  edges: PiDependencyEdge[];
}

const TYPE_LABEL: Record<PiDependencyEdge["type"], string> = {
  blocks: "blockiert",
  depends_on: "haengt ab von",
  relates_to: "bezieht sich auf",
};
const TYPE_CLASS: Record<PiDependencyEdge["type"], string> = {
  blocks: "bg-red-100 text-red-700",
  depends_on: "bg-amber-100 text-amber-700",
  relates_to: "bg-muted text-muted-foreground",
};

/**
 * Dependencies-Tab im PI-Workspace. Listet alle Dependency-Kanten,
 * an denen ein Feature dieses PIs beteiligt ist (ein- + ausgehend).
 * Beide Seiten der Kante sind verlinkt; Edit/Add laeuft pro Feature
 * auf der Feature-Detail-Seite, hier ist die Surface read-only fokussiert.
 */
export function PiDependenciesTab({ edges }: Props) {
  if (edges.length === 0) {
    return (
      <section className="rounded-lg border bg-card p-6">
        <p className="text-sm text-muted-foreground">
          Keine Dependencies, die ein Feature dieses PIs beruehren. Verlinken passiert auf der
          jeweiligen Feature-Detail-Seite (Tab Dependencies).
        </p>
      </section>
    );
  }
  const out = edges.filter((e) => e.direction === "out");
  const incoming = edges.filter((e) => e.direction === "in");
  return (
    <div className="space-y-6">
      <Section
        title="Ausgehend von Features dieses PIs"
        hint="Was unsere Features blockieren oder wovon sie abhaengen."
        edges={out}
      />
      <Section
        title="Eingehend auf Features dieses PIs"
        hint="Was andere PIs / ARTs auf unsere Features richten."
        edges={incoming}
      />
    </div>
  );
}

function Section({
  title,
  hint,
  edges,
}: {
  title: string;
  hint: string;
  edges: PiDependencyEdge[];
}) {
  return (
    <section className="rounded-lg border bg-card p-4">
      <header className="mb-3">
        <h2 className="text-base font-medium">{title}</h2>
        <p className="text-xs text-muted-foreground">{hint}</p>
      </header>
      {edges.length === 0 ? (
        <p className="rounded-md border border-dashed px-4 py-3 text-sm text-muted-foreground">
          Keine.
        </p>
      ) : (
        <ul className="divide-y">
          {edges.map((e) => (
            <li key={e.id} className="flex flex-wrap items-center gap-2 py-2 text-sm">
              <Link
                href={`/umsetzung/feature/${e.here.id}` as never}
                className="font-medium text-primary hover:underline"
              >
                {e.here.title}
              </Link>
              <span className={`rounded-full px-2 py-0.5 text-[11px] ${TYPE_CLASS[e.type]}`}>
                {TYPE_LABEL[e.type]}
              </span>
              <Link
                href={`/umsetzung/feature/${e.other.id}` as never}
                className="text-primary hover:underline"
              >
                {e.other.title}
              </Link>
              {e.other.piName && (
                <span className="text-xs text-muted-foreground">in {e.other.piName}</span>
              )}
              <Link
                href={`/umsetzung/feature/${e.here.id}?tab=dependencies` as never}
                className="ml-auto inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
              >
                Bearbeiten <ArrowRight className="size-3" />
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
