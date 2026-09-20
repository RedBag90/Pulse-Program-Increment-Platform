import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";
import { HORIZON_BADGE_CLASS } from "@/modules/core/org/features/solution/components/horizon-tokens";
import { nodeHref } from "@/modules/core/org/features/structure/components/structure-routes";
import {
  EpicsCell,
  GapBadge,
  GrowCell,
  RunCell,
} from "@/modules/core/org/features/structure/components/structure-figures";
import {
  flattenSolutions,
  groupByStatus,
  type OverviewSolution,
  type StructureOverview,
} from "@/modules/core/org/server/views/structure-overview";

/**
 * **Dieselben Daten zum Rechnen.**
 *
 * Die Karte zeigt, wie die Organisation *aussieht*; diese Tabelle, was sie
 * *kostet*. Zwei Gruppierungen, beide über dasselbe Modell:
 *
 * - **nach Struktur** — Wertstrom → ART → Solution, mit **Summen je Ebene**.
 *   Das konnte weder der frühere Baum (er kann nicht rechnen) noch die frühere
 *   flache Liste (sie kennt keine Zugehörigkeit).
 * - **nach Horizont** — flach über alle Wertströme, gruppiert nach dem Stand.
 *   Das ist inhaltlich die Seite `/structure/solutions`, die es bis September
 *   2026 **zusätzlich** gab: dieselben Solutions, ohne die Struktur daneben.
 *   Sie ist keine eigene Seite mehr, sondern eine Gruppierung.
 */
export type TableGrouping = "struktur" | "horizont";

export function StructureTable({
  overview,
  grouping,
  showEpics,
  showInvest,
  showRun,
}: {
  overview: StructureOverview;
  grouping: TableGrouping;
  showEpics: boolean;
  showInvest: boolean;
  showRun: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-lg bg-card shadow-card">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-xs">
          <thead className="bg-surface-frame text-label uppercase tracking-[0.1em] text-muted-foreground">
            <tr className="border-b">
              <th className="px-3 py-2 text-left font-semibold">
                {grouping === "struktur" ? "Name" : "Solution"}
              </th>
              <th className="px-3 py-2 text-left font-semibold">
                {grouping === "struktur" ? "Stand" : "Wertstrom · ART"}
              </th>
              {showEpics && <th className="px-3 py-2 text-right font-semibold">Epics</th>}
              {showInvest && <th className="px-3 py-2 text-right font-semibold">Grow</th>}
              {showRun && <th className="px-3 py-2 text-right font-semibold">Run · Halbjahr</th>}
            </tr>
          </thead>
          <tbody>
            {grouping === "struktur" ? (
              <StructureRows
                overview={overview}
                showEpics={showEpics}
                showInvest={showInvest}
                showRun={showRun}
              />
            ) : (
              <HorizonRows
                overview={overview}
                showEpics={showEpics}
                showInvest={showInvest}
                showRun={showRun}
              />
            )}
          </tbody>
        </table>
      </div>
      {showRun && (
        <p className="border-t px-3 py-2 text-meta leading-relaxed text-muted-foreground">
          Beide Beträge stehen auf <strong>demselben Halbjahr</strong> — Grow ist das in diesem
          Zyklus zugeteilte Geld, Run der Betriebsanteil eines Halbjahres. „Run" enthält dabei nur
          Positionen, die <strong>einer Solution</strong> zugerechnet sind; wertstrom- und
          ART-übergreifender Betrieb zählt in keine Zeile und steht vollständig im
          Budgeting-Bereich.
        </p>
      )}
    </div>
  );
}

function StructureRows({
  overview,
  showEpics,
  showInvest,
  showRun,
}: {
  overview: StructureOverview;
  showEpics: boolean;
  showInvest: boolean;
  showRun: boolean;
}) {
  const span = 1 + (showEpics ? 1 : 0) + (showInvest ? 1 : 0) + (showRun ? 1 : 0);
  return (
    <>
      {overview.valueStreams.map((vs) => (
        <Fragmentish key={vs.id}>
          <tr className="border-b bg-surface-frame/60 font-semibold">
            <td className="px-3 py-1.5">
              <NodeLink href={nodeHref("vs", vs.id)} dot="bg-primary" name={vs.name} />
              <GapBadge gaps={vs.gaps} />
            </td>
            <td className="px-3 py-1.5 text-meta font-normal text-muted-foreground">
              Wertstrom · {vs.arts.length} ART{vs.arts.length === 1 ? "" : "s"}
            </td>
            {showEpics && <EpicsCell money={vs.money} />}
            {showInvest && <GrowCell money={vs.money} />}
            {showRun && <RunCell money={vs.money} />}
          </tr>

          {vs.arts.map((art) => (
            <Fragmentish key={art.id}>
              <tr className="border-b">
                <td className="px-3 py-1.5 pl-7 font-medium">
                  <NodeLink href={nodeHref("art", art.id)} dot="bg-emerald-600" name={art.name} />
                  <GapBadge gaps={art.gaps} />
                </td>
                <td className="px-3 py-1.5 text-meta text-muted-foreground">
                  ART · {art.cadenceLabel}
                </td>
                {art.solutions.length === 0 ? (
                  <td colSpan={span} className="px-3 py-1.5 text-meta text-warning">
                    keine Solution
                  </td>
                ) : (
                  <>
                    {showEpics && <EpicsCell money={art.money} />}
                    {showInvest && <GrowCell money={art.money} />}
                    {showRun && <RunCell money={art.money} />}
                  </>
                )}
              </tr>
              {art.solutions.map((s) => (
                <SolutionRow
                  key={s.id}
                  solution={s}
                  indent="pl-14"
                  showEpics={showEpics}
                  showInvest={showInvest}
                  showRun={showRun}
                />
              ))}
            </Fragmentish>
          ))}

          {vs.looseSolutions.map((s) => (
            <SolutionRow
              key={s.id}
              solution={s}
              indent="pl-7"
              showEpics={showEpics}
              showInvest={showInvest}
              showRun={showRun}
              note="ohne ART"
            />
          ))}
        </Fragmentish>
      ))}
    </>
  );
}

function HorizonRows({
  overview,
  showEpics,
  showInvest,
  showRun,
}: {
  overview: StructureOverview;
  showEpics: boolean;
  showInvest: boolean;
  showRun: boolean;
}) {
  const span = 2 + (showEpics ? 1 : 0) + (showInvest ? 1 : 0) + (showRun ? 1 : 0);
  return (
    <>
      {groupByStatus(flattenSolutions(overview)).map((group) => (
        <Fragmentish key={group.status ?? "ohne"}>
          <tr className="border-b bg-muted/40">
            <td
              colSpan={span}
              className="px-3 py-1.5 text-label font-semibold uppercase tracking-[0.1em] text-muted-foreground"
            >
              {group.label} — {group.rows.length}
            </td>
          </tr>
          {group.rows.map(({ solution, valueStreamName, artName }) => (
            <tr key={solution.id} className="border-b last:border-0 hover:bg-muted/20">
              <td className="px-3 py-1.5">
                <NodeLink
                  href={nodeHref("solution", solution.id)}
                  dot={dotOf(solution)}
                  round
                  name={solution.name}
                />
              </td>
              <td className="px-3 py-1.5 text-meta text-muted-foreground">
                {[valueStreamName, artName ?? "ohne ART"].join(" · ")}
              </td>
              {showEpics && <EpicsCell money={solution.money} />}
              {showInvest && <GrowCell money={solution.money} />}
              {showRun && <RunCell money={solution.money} />}
            </tr>
          ))}
        </Fragmentish>
      ))}
    </>
  );
}

function SolutionRow({
  solution,
  indent,
  showEpics,
  showInvest,
  showRun,
  note,
}: {
  solution: OverviewSolution;
  indent: string;
  showEpics: boolean;
  showInvest: boolean;
  showRun: boolean;
  note?: string;
}) {
  const tone = solution.horizon ? HORIZON_BADGE_CLASS[solution.horizon] : null;
  return (
    <tr className="border-b hover:bg-muted/20">
      <td className={cn("px-3 py-1.5", indent)}>
        <NodeLink
          href={nodeHref("solution", solution.id)}
          dot={dotOf(solution)}
          round
          name={solution.name}
        />
        {note && <span className="ml-2 text-meta text-muted-foreground">({note})</span>}
      </td>
      <td className="px-3 py-1.5">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-meta font-medium",
            tone ? tone.pill : "bg-muted text-muted-foreground",
          )}
        >
          <span
            className={cn("size-1.5 rounded-full", tone ? tone.dot : "bg-muted-foreground/50")}
          />
          {solution.statusLabel}
        </span>
      </td>
      {showEpics && <EpicsCell money={solution.money} />}
      {showInvest && <GrowCell money={solution.money} />}
      {showRun && <RunCell money={solution.money} />}
    </tr>
  );
}

function dotOf(solution: OverviewSolution): string {
  return solution.horizon ? HORIZON_BADGE_CLASS[solution.horizon].dot : "bg-muted-foreground/50";
}

function NodeLink({
  href,
  dot,
  name,
  round,
}: {
  href: string;
  dot: string;
  name: string;
  round?: boolean;
}) {
  return (
    <Link
      href={href}
      className="inline-flex items-baseline gap-2 hover:text-primary hover:underline"
    >
      <span
        className={cn(
          "size-1.5 shrink-0 translate-y-[-1px]",
          round ? "rounded-full" : "rounded-[2px]",
          dot,
        )}
        aria-hidden
      />
      {name}
    </Link>
  );
}

/**
 * Ein `<tbody>` darf keine `<div>` enthalten, und `<>` braucht einen `key`.
 * `Fragment` mit `key` ist genau das — als benannter Helfer, damit die
 * Zeilen-Bäume oben lesbar bleiben.
 */
function Fragmentish({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}
