import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import {
  HORIZON_BADGE_CLASS,
  HORIZON_HEX,
} from "@/modules/core/org/features/solution/components/horizon-tokens";
import { nodeHref } from "@/modules/core/org/features/structure/components/structure-routes";
import {
  Lane,
  LaneGroup,
  type LaneColumn,
} from "@/modules/core/org/features/structure/components/structure-lanes";
import {
  GapBadge,
  StructureFigures,
} from "@/modules/core/org/features/structure/components/structure-figures";
import type {
  OverviewArt,
  OverviewSolution,
  OverviewValueStream,
  StructureOverview,
} from "@/modules/core/org/server/views/structure-overview";

/**
 * **Die Struktur als Bild.**
 *
 * Je Wertstrom eine Bahn, darin die ARTs als Spalten, darin die Solutions als
 * Kacheln. Fünfzehn Knoten passen damit auf einen Bildschirm — der frühere
 * 288 px breite Baum brauchte für dieselbe Auskunft eine eigene Spalte, in die
 * sechs von sieben Zeilenarten nicht hineinpassten („Verwaltung & Overhead
 * Betrieb · H1 · Extracting" misst 367 px bei 272 px Platz).
 *
 * **Die Farbe trägt den Horizont.** Die Akzentschiene links an der Kachel nimmt
 * `HORIZON_HEX` — dieselben Töne wie das Horizont-Abzeichen, nach Nähe zur
 * Wertschöpfung geordnet. So muss der Name nicht mehr um Platz gegen eine
 * Textangabe kämpfen.
 *
 * **Ein ART ohne Solution bekommt einen Platz.** Im Baum sah so ein Knoten
 * genauso aus wie ein eingeklappter; hier steht ein gestrichelter Kasten. Im
 * Bestand betrifft das zwei von sechs ARTs.
 *
 * Die Karte **ist** die Navigation: Bahnenkopf → Wertstrom, Spaltenkopf → ART,
 * Kachel → Solution.
 */
export function StructureMap({
  overview,
  showGrow,
  showRun,
}: {
  overview: StructureOverview;
  showGrow: boolean;
  showRun: boolean;
}) {
  return (
    <LaneGroup>
      {overview.valueStreams.map((vs) => (
        <StreamLane key={vs.id} vs={vs} showGrow={showGrow} showRun={showRun} />
      ))}
    </LaneGroup>
  );
}

function StreamLane({
  vs,
  showGrow,
  showRun,
}: {
  vs: OverviewValueStream;
  showGrow: boolean;
  showRun: boolean;
}) {
  const artCount = vs.arts.length;
  const columns: LaneColumn[] = vs.arts.map((art) => ({
    key: art.id,
    children: <ArtColumn art={art} showGrow={showGrow} showRun={showRun} />,
  }));
  if (vs.looseSolutions.length > 0) {
    columns.push({
      key: "ohne-art",
      children: <LooseColumn solutions={vs.looseSolutions} showGrow={showGrow} showRun={showRun} />,
    });
  }

  return (
    <Lane
      head={
        <>
          <Link
            href={nodeHref("vs", vs.id)}
            className="text-sm font-semibold tracking-tight hover:text-primary hover:underline"
          >
            {vs.name}
          </Link>
          <span className="text-label uppercase tracking-[0.1em] text-muted-foreground">
            Wertstrom · {artCount} ART{artCount === 1 ? "" : "s"}
          </span>
          <GapBadge gaps={vs.gaps} />
          <StructureFigures
            money={vs.money}
            showGrow={showGrow}
            showRun={showRun}
            className="ml-auto flex flex-wrap items-baseline gap-x-4 gap-y-0.5 text-xs tabular-nums text-muted-foreground"
          />
        </>
      }
      columns={columns}
      empty={
        <p className="p-4 text-xs text-muted-foreground">Noch kein ART in diesem Wertstrom.</p>
      }
    />
  );
}

function ArtColumn({
  art,
  showGrow,
  showRun,
}: {
  art: OverviewArt;
  showGrow: boolean;
  showRun: boolean;
}) {
  return (
    <>
      <div className="flex items-baseline gap-2">
        <span
          className="size-1.5 shrink-0 translate-y-[-1px] rounded-[2px] bg-emerald-600"
          aria-hidden
        />
        <Link
          href={nodeHref("art", art.id)}
          className="min-w-0 text-xs font-semibold [overflow-wrap:anywhere] hover:text-primary hover:underline"
        >
          {art.name}
          <span className="sr-only"> — ART</span>
        </Link>
        <GapBadge gaps={art.gaps} />
        <span className="ml-auto shrink-0 text-meta tabular-nums text-muted-foreground">
          {art.cadenceLabel}
        </span>
      </div>

      {art.solutions.length === 0 ? (
        <p className="rounded-md border border-dashed bg-warning-surface/40 px-2 py-3.5 text-center text-meta text-warning">
          keine Solution
        </p>
      ) : (
        art.solutions.map((s) => (
          <SolutionTile key={s.id} solution={s} showGrow={showGrow} showRun={showRun} />
        ))
      )}
    </>
  );
}

/**
 * Solutions, deren ART hier nicht zu sehen ist (weich gelöscht) — sie hängen
 * direkt am Wertstrom. Ohne diese Spalte wären sie über die Fläche nicht mehr
 * erreichbar.
 */
function LooseColumn({
  solutions,
  showGrow,
  showRun,
}: {
  solutions: readonly OverviewSolution[];
  showGrow: boolean;
  showRun: boolean;
}) {
  return (
    <>
      <p className="text-xs font-semibold text-muted-foreground">Ohne ART</p>
      {solutions.map((s) => (
        <SolutionTile key={s.id} solution={s} showGrow={showGrow} showRun={showRun} />
      ))}
    </>
  );
}

function SolutionTile({
  solution,
  showGrow,
  showRun,
}: {
  solution: OverviewSolution;
  showGrow: boolean;
  showRun: boolean;
}) {
  const tone = solution.horizon ? HORIZON_BADGE_CLASS[solution.horizon] : null;
  return (
    <Link
      href={nodeHref("solution", solution.id)}
      // Die Schiene ist ein Akzent, kein Umriss (ADR-0021). Ihre Farbe kommt als
      // Wert, nicht als Klassenkette — eine Kachel kann keine Tailwind-Klasse je
      // Horizont tragen, ohne dass vier Varianten im Quelltext stehen.
      style={solution.horizon ? { borderLeftColor: HORIZON_HEX[solution.horizon] } : undefined}
      className={cn(
        "flex flex-col gap-1.5 rounded-md border-l-[3px] bg-muted/40 p-2.5 transition-colors",
        "hover:bg-muted focus-visible:outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50",
        !solution.horizon && "border-l-muted-foreground/40",
      )}
    >
      <span className="text-xs font-medium leading-snug">{solution.name}</span>
      <span
        className={cn(
          "inline-flex w-fit items-center gap-1.5 rounded-full px-2 py-0.5 text-meta font-medium",
          tone ? tone.pill : "bg-muted text-muted-foreground",
        )}
      >
        <span className={cn("size-1.5 rounded-full", tone ? tone.dot : "bg-muted-foreground/50")} />
        {solution.statusLabel}
      </span>
      <StructureFigures money={solution.money} showGrow={showGrow} showRun={showRun} />
    </Link>
  );
}
