import { Link } from "@/i18n/navigation";
import { Stat, StatStrip } from "@/components/ui/stat";
import { SectionLabel } from "@/components/ui/section-label";
import { fmtEur } from "@/components/format/eur";
import { userLabel } from "@/components/detail/initiative-labels";
import { cn } from "@/lib/utils";
import {
  computeDisplayPeriods,
  summarizeSnapshot,
  type SnapshotDisplayPeriod,
  type BudgetPlanSnapshot,
  type BudgetPlanSnapshotArt,
  type BudgetPlanSnapshotValueStream,
} from "@/modules/budgeting/domain/budget-plan-snapshot";

/** A column the view renders — current cycle is flagged for tint. Re-uses the
 *  domain's `SnapshotDisplayPeriod` so the view and `computeDisplayPeriods`
 *  share one shape. */
type DisplayPeriod = SnapshotDisplayPeriod;

interface Props {
  snapshot: BudgetPlanSnapshot;
  capturedBy: string;
  userLabels: Record<string, string>;
}

function fmtDateTime(iso: string): string {
  return new Date(iso).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/**
 * The read-only revision detail — header, headline stats, and four sections
 * (Epic ranking, Wertstrom roll-up, ART roll-up, Features im Zyklus). Server
 * component: the snapshot is fully frozen and nothing here needs `useState`.
 */
export function BudgetPlanRevisionView({ snapshot, capturedBy, userLabels }: Props) {
  // Cycle-/Folgebudget kommen aus der EINEN Quelle (`summarizeSnapshot`), damit
  // die Übersichts-Card und diese Detail-Sicht identische Zahlen zeigen — nicht
  // mehr lokal aus `snapshot.epics` nachgerechnet.
  const { cycleBudgetSum, followBudgetSum } = summarizeSnapshot(snapshot);
  const poolSum = Object.values(snapshot.budgetPoolByPeriod).reduce((s, v) => s + v, 0);
  const cycleFeatureCount = snapshot.epics.reduce((s, e) => s + e.cycleFeatures.length, 0);
  const displayPeriods = computeDisplayPeriods(snapshot);

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-semibold">Budget-Plan-Revision · {snapshot.cycleLabel}</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Erfasst am {fmtDateTime(snapshot.capturedAt)} von {userLabel(capturedBy, userLabels)}.
          Eingefrorene Sicht — Änderungen auf der Live-Board-Seite haben keinen Einfluss auf diese
          Revision.
        </p>
      </div>

      {/* Headline stats */}
      <StatStrip>
        <Stat
          label={`Zyklus-Budget · ${snapshot.cycleLabel}`}
          value={<span className="text-xl">{fmtEur(cycleBudgetSum)}</span>}
          delta={{ tone: "flat", text: `${snapshot.epics.length} Epics priorisiert` }}
        />
        <Stat
          label="Σ Folgebudgets"
          value={<span className="text-xl">{fmtEur(followBudgetSum)}</span>}
          delta={{
            tone: "flat",
            text: `${Math.max(snapshot.periods.length - 1, 0)} weitere Halbjahre belegt`,
          }}
        />
        <Stat
          label="Pool gesamt"
          value={<span className="text-xl">{fmtEur(poolSum)}</span>}
          delta={{ tone: "flat", text: `${snapshot.periods.length} Halbjahre` }}
        />
        <Stat
          label="Features im Zyklus"
          value={<span className="text-xl">{cycleFeatureCount}</span>}
          delta={{ tone: "flat", text: `${snapshot.arts.length} ARTs` }}
        />
      </StatStrip>

      {/* Epic ranking */}
      <EpicSection snapshot={snapshot} displayPeriods={displayPeriods} />

      {/* Value stream roll-up */}
      <ValueStreamSection snapshot={snapshot} displayPeriods={displayPeriods} />

      {/* ART roll-up */}
      <ArtSection snapshot={snapshot} displayPeriods={displayPeriods} />

      {/* Features im Zyklus */}
      <FeaturesSection snapshot={snapshot} />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

/** Header cells for the visible half-year columns + a trailing Σ-header. */
function PeriodHeaderCells({ periods }: { periods: DisplayPeriod[] }) {
  return (
    <>
      {periods.map((p) => (
        <th
          key={p.key}
          className={cn("px-3 py-2 text-right", p.isCurrent && "bg-primary/5 text-foreground")}
        >
          {p.label}
        </th>
      ))}
      <th className="px-3 py-2 text-right">Σ</th>
    </>
  );
}

/** Data cells for the visible half-year columns + a trailing Σ. */
function PeriodGrid({
  periods,
  byPeriod,
  total,
}: {
  periods: DisplayPeriod[];
  byPeriod: Record<string, number>;
  total: number;
}) {
  return (
    <>
      {periods.map((p) => (
        <td
          key={p.key}
          className={cn("px-3 py-2 text-right tabular-nums", p.isCurrent && "bg-primary/5")}
        >
          {fmtEur(byPeriod[p.key] ?? 0)}
        </td>
      ))}
      <td className="px-3 py-2 text-right font-medium tabular-nums">{fmtEur(total)}</td>
    </>
  );
}

/**
 * `<colgroup>` for the three revision tables. Leading columns absorb a fixed
 * 38 % of the width (split by `leadingWeights`); the remaining 62 % is shared
 * equally among N period columns and one Σ. Used so the period grids of the
 * Epic / Wertstrom / ART tables line up vertically — the cycle-highlight
 * stripe becomes a continuous line across all three.
 */
function TableColGroup({
  leadingWeights,
  periodCount,
}: {
  leadingWeights: number[];
  periodCount: number;
}) {
  const LEADING_PCT = 38;
  const totalWeight = leadingWeights.reduce((s, w) => s + w, 0);
  const tailColPct = (100 - LEADING_PCT) / (periodCount + 1);
  return (
    <colgroup>
      {leadingWeights.map((w, i) => (
        <col key={`l${i}`} style={{ width: `${(w / totalWeight) * LEADING_PCT}%` }} />
      ))}
      {Array.from({ length: periodCount }).map((_, i) => (
        <col key={`p${i}`} style={{ width: `${tailColPct}%` }} />
      ))}
      <col style={{ width: `${tailColPct}%` }} />
    </colgroup>
  );
}

function EpicSection({
  snapshot,
  displayPeriods,
}: {
  snapshot: BudgetPlanSnapshot;
  displayPeriods: DisplayPeriod[];
}) {
  // 3 fixed cols (Rang · Epic · Wertstrom) + N period cols + 1 Σ col.
  const colSpan = 3 + displayPeriods.length + 1;
  return (
    <section className="space-y-3">
      <SectionLabel>Epics in Snapshot-Reihenfolge</SectionLabel>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[960px] table-fixed text-sm">
          <TableColGroup leadingWeights={[1, 5, 3]} periodCount={displayPeriods.length} />
          <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Rang</th>
              <th className="px-3 py-2">Epic</th>
              <th className="px-3 py-2">Wertstrom</th>
              <PeriodHeaderCells periods={displayPeriods} />
            </tr>
          </thead>
          <tbody>
            {snapshot.epics.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-3 py-4 text-center text-xs text-muted-foreground"
                >
                  Keine Epics im Snapshot.
                </td>
              </tr>
            ) : (
              snapshot.epics.map((e, idx) => (
                <tr key={e.epicId} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-3 py-2 text-muted-foreground">{idx + 1}</td>
                  <td className="px-3 py-2 break-words">
                    <Link
                      href={`/portfolio/epics/${e.epicId}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {e.title}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-xs text-muted-foreground break-words">
                    {e.valueStreamName ?? "Ohne Wertstrom"}
                  </td>
                  <PeriodGrid periods={displayPeriods} byPeriod={e.allocations} total={e.total} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ValueStreamSection({
  snapshot,
  displayPeriods,
}: {
  snapshot: BudgetPlanSnapshot;
  displayPeriods: DisplayPeriod[];
}) {
  const ordered: BudgetPlanSnapshotValueStream[] = snapshot.valueStreams;
  const colSpan = 1 + displayPeriods.length + 1;
  return (
    <section className="space-y-3">
      <SectionLabel>Wertströme — Allokation je Halbjahr</SectionLabel>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[960px] table-fixed text-sm">
          <TableColGroup leadingWeights={[1]} periodCount={displayPeriods.length} />
          <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">Wertstrom</th>
              <PeriodHeaderCells periods={displayPeriods} />
            </tr>
          </thead>
          <tbody>
            {ordered.length === 0 ? (
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-3 py-4 text-center text-xs text-muted-foreground"
                >
                  Keine Wertstrom-Allokationen.
                </td>
              </tr>
            ) : (
              ordered.map((vs) => (
                <tr key={vs.valueStreamId} className="border-b last:border-b-0 hover:bg-muted/30">
                  <td className="px-3 py-2 font-medium break-words">{vs.name}</td>
                  <PeriodGrid periods={displayPeriods} byPeriod={vs.byPeriod} total={vs.total} />
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function ArtSection({
  snapshot,
  displayPeriods,
}: {
  snapshot: BudgetPlanSnapshot;
  displayPeriods: DisplayPeriod[];
}) {
  const arts: BudgetPlanSnapshotArt[] = snapshot.arts;
  // 2 fixed cols (ART · Achse) + N period cols + 1 Σ col.
  const colSpan = 2 + displayPeriods.length + 1;
  return (
    <section className="space-y-3">
      <SectionLabel>ARTs — Budget vs. Demand je Halbjahr</SectionLabel>
      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full min-w-[960px] table-fixed text-sm">
          <TableColGroup leadingWeights={[5, 3]} periodCount={displayPeriods.length} />
          <thead className="border-b bg-muted/40 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <tr>
              <th className="px-3 py-2">ART</th>
              <th className="px-3 py-2">Achse</th>
              <PeriodHeaderCells periods={displayPeriods} />
            </tr>
          </thead>
          {arts.length === 0 ? (
            <tbody>
              <tr>
                <td
                  colSpan={colSpan}
                  className="px-3 py-4 text-center text-xs text-muted-foreground"
                >
                  Keine ARTs erfasst.
                </td>
              </tr>
            </tbody>
          ) : (
            arts.map((a) => {
              const budgetTotal = Object.values(a.budgetByPeriod).reduce((s, v) => s + v, 0);
              const loadJobSizeTotal = Object.values(a.loadByPeriod).reduce(
                (s, v) => s + v.jobSizeSum,
                0,
              );
              const loadFeatureCount = Object.values(a.loadByPeriod).reduce(
                (s, v) => s + v.featureCount,
                0,
              );
              return (
                <tbody key={a.artId} className="border-b last:border-b-0">
                  <tr className="bg-muted/20">
                    <td rowSpan={2} className="px-3 py-2 align-top font-medium break-words">
                      {a.name}
                    </td>
                    <td className="px-3 py-2 text-xs text-muted-foreground">Budget €</td>
                    <PeriodGrid
                      periods={displayPeriods}
                      byPeriod={a.budgetByPeriod}
                      total={budgetTotal}
                    />
                  </tr>
                  <tr>
                    <td className="px-3 py-2 text-xs text-muted-foreground">
                      Demand (Σ Job Size · # Feat.)
                    </td>
                    {displayPeriods.map((p) => {
                      const cell = a.loadByPeriod[p.key];
                      return (
                        <td
                          key={p.key}
                          className={cn(
                            "px-3 py-2 text-right tabular-nums text-muted-foreground",
                            p.isCurrent && "bg-primary/5",
                          )}
                        >
                          {cell ? `${cell.jobSizeSum} · ${cell.featureCount}` : "—"}
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-medium tabular-nums text-muted-foreground">
                      {`${loadJobSizeTotal} · ${loadFeatureCount}`}
                    </td>
                  </tr>
                </tbody>
              );
            })
          )}
        </table>
      </div>
    </section>
  );
}

function FeaturesSection({ snapshot }: { snapshot: BudgetPlanSnapshot }) {
  const epicsWithFeatures = snapshot.epics.filter((e) => e.cycleFeatures.length > 0);
  return (
    <section className="space-y-3">
      <SectionLabel>Features im Zyklus · {snapshot.cycleLabel}</SectionLabel>
      <p className="text-xs text-muted-foreground">
        Features, die zum Snapshot-Zeitpunkt einem PI im Zyklus zugewiesen waren — gruppiert nach
        Epic in der Snapshot-Reihenfolge.
      </p>
      {epicsWithFeatures.length === 0 ? (
        <p className="rounded-lg border bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">
          Keine Features in {snapshot.cycleLabel}.
        </p>
      ) : (
        <div className="space-y-3">
          {epicsWithFeatures.map((e) => (
            <div key={e.epicId} className="rounded-lg border">
              <div className="flex items-baseline justify-between border-b bg-muted/30 px-4 py-2">
                <p className="text-sm font-medium">{e.title}</p>
                <span className="text-xs text-muted-foreground">
                  {e.cycleFeatures.length} Feature
                  {e.cycleFeatures.length !== 1 ? "s" : ""}
                </span>
              </div>
              <ul className="divide-y">
                {e.cycleFeatures.map((f) => (
                  <li key={f.featureId} className="grid grid-cols-[1fr_auto] gap-3 px-4 py-2">
                    <div className="min-w-0">
                      <Link
                        href={`/feature/${f.featureId}`}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        {f.title}
                      </Link>
                      <p className="text-xs text-muted-foreground">
                        {f.artName} · {f.piName} · {f.status}
                      </p>
                    </div>
                    <span className="shrink-0 self-center text-xs text-muted-foreground tabular-nums">
                      {f.wsjfJobSize != null ? `JS ${f.wsjfJobSize}` : "—"}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
