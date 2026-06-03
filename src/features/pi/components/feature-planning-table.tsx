import { Fragment } from "react";
import { Link } from "@/i18n/navigation";
import { FeaturePiSelect } from "@/features/art/components/feature-pi-select";
import { Lock } from "lucide-react";
import { PiCapacityHeader } from "./pi-capacity-header";
import type { PlanningFeature } from "./feature-planning-board";
import {
  groupBacklogByCycleAndEpic,
  NO_BUDGET_CYCLE,
  type PiCapacityOverlay,
  type FeatureBlockerOverlay,
} from "@/server/views/pi-planning";
import { halfYearLabel } from "@/domain/calendar";

export interface TablePi {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  sprintCount: number;
}

interface Props {
  artId: string;
  canEdit: boolean;
  features: PlanningFeature[];
  pis: TablePi[];
  capacity: Record<string, PiCapacityOverlay>;
  blockers: Record<string, FeatureBlockerOverlay>;
  /** Today's half-year key — drives the "aktueller Zyklus"-marker in the Backlog. */
  currentCycleKey: string;
}

const FEATURE_STATUS: Record<string, string> = {
  draft: "bg-muted text-foreground/80",
  in_review: "bg-yellow-100 text-yellow-800",
  approved: "bg-blue-100 text-primary/80",
  in_progress: "bg-indigo-100 text-indigo-800",
  blocked: "bg-red-100 text-red-800",
  done: "bg-green-100 text-green-800",
  completed: "bg-green-100 text-green-800",
  cancelled: "bg-muted text-muted-foreground line-through",
};

const PI_STATUS: Record<string, string> = {
  planned: "bg-muted text-foreground/80",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-700",
};

function formatDate(d: Date): string {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/**
 * Tabular PI-Planning view — merges the `/pi` and `/feature` information: rows
 * are grouped under Backlog and each PI, with a per-group header carrying the
 * PI's dates, status and counts. Each Feature row keeps an inline PI picker so
 * the table stays a planning surface.
 */
export function FeaturePlanningTable({
  artId,
  canEdit,
  features,
  pis,
  capacity,
  blockers,
  currentCycleKey,
}: Props) {
  const assignablePis = pis
    .filter((p) => p.status !== "completed")
    .map((p) => ({ id: p.id, name: p.name }));

  const groups: { piId: string | null; pi: TablePi | null }[] = [
    { piId: null, pi: null },
    ...pis.map((pi) => ({ piId: pi.id as string | null, pi })),
  ];

  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="border-b bg-muted/50">
          <tr>
            <th className="px-4 py-3 text-left font-medium text-muted-foreground">Feature</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground">Status</th>
            <th className="w-20 px-3 py-3 text-center font-medium text-muted-foreground">WSJF</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground">Epic</th>
            <th className="px-3 py-3 text-left font-medium text-muted-foreground">PI</th>
          </tr>
        </thead>
        <tbody>
          {groups.map((group) => {
            const groupFeatures = features.filter((f) => f.piId === group.piId);
            const wsjfSum = round1(groupFeatures.reduce((s, f) => s + f.wsjf, 0));
            return (
              <Fragment key={group.piId ?? "__backlog__"}>
                <tr className="border-y bg-muted/40">
                  <td colSpan={5} className="px-4 py-2">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                      <span className="font-semibold">{group.pi ? group.pi.name : "Backlog"}</span>
                      {group.pi && (
                        <>
                          <span
                            className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                              PI_STATUS[group.pi.status] ?? "bg-muted text-foreground/80"
                            }`}
                          >
                            {group.pi.status}
                          </span>
                          <span className="text-xs text-muted-foreground">
                            {formatDate(group.pi.startDate)} – {formatDate(group.pi.endDate)}
                          </span>
                        </>
                      )}
                      <span className="text-xs text-muted-foreground">
                        {group.pi ? `${group.pi.sprintCount} Sprints · ` : ""}
                        {groupFeatures.length} Feature{groupFeatures.length !== 1 ? "s" : ""} · Σ
                        WSJF {wsjfSum}
                      </span>
                      {group.pi && (
                        <div className="ml-auto w-72 max-w-full">
                          <PiCapacityHeader
                            piId={group.pi.id}
                            artId={artId}
                            overlay={capacity[group.pi.id] ?? null}
                            canEdit={canEdit}
                          />
                        </div>
                      )}
                    </div>
                  </td>
                </tr>

                {groupFeatures.length === 0 ? (
                  <tr className="border-b">
                    <td colSpan={5} className="px-4 py-3 text-xs text-muted-foreground/60">
                      Keine Features
                    </td>
                  </tr>
                ) : group.piId === null ? (
                  // Backlog row: stack features under (Cycle → Epic) sub-headers.
                  groupBacklogByCycleAndEpic(groupFeatures, currentCycleKey).flatMap((cg) => {
                    const cycleLabel =
                      cg.cycleKey === NO_BUDGET_CYCLE ? "Ohne Budget" : halfYearLabel(cg.cycleKey);
                    return [
                      <tr key={`cycle-${String(cg.cycleKey)}`} className="bg-muted/25">
                        <td
                          colSpan={5}
                          className="px-4 py-1.5 text-[11px] font-semibold uppercase tracking-wider"
                        >
                          {cycleLabel}
                          {cg.isCurrent && (
                            <span className="ml-1.5 rounded-full bg-primary/10 px-1.5 py-0.5 text-[9px] font-medium text-primary">
                              aktueller Zyklus
                            </span>
                          )}
                          <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                            {cg.count} · Σ WSJF {round1(cg.wsjfSum)}
                          </span>
                        </td>
                      </tr>,
                      ...cg.epics.flatMap((eg) => [
                        <tr
                          key={`epic-${String(cg.cycleKey)}-${String(eg.epicId)}`}
                          className="bg-muted/10"
                        >
                          <td colSpan={5} className="px-6 py-1 text-[11px] font-medium">
                            {eg.epicTitle ?? "Kein Epic"}
                            <span className="ml-2 text-[10px] font-normal text-muted-foreground">
                              {eg.features.length} · Σ WSJF {round1(eg.wsjfSum)}
                            </span>
                          </td>
                        </tr>,
                        ...eg.features.map((f) =>
                          renderFeatureRow(f, blockers[f.id], canEdit, artId, assignablePis, pis),
                        ),
                      ]),
                    ];
                  })
                ) : (
                  groupFeatures.map((f) =>
                    renderFeatureRow(f, blockers[f.id], canEdit, artId, assignablePis, pis),
                  )
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/**
 * One Feature row — extracted so the Backlog can render it indented under
 * Cycle/Epic sub-headers without duplicating the cell markup, while PI rows
 * keep emitting it flat.
 */
function renderFeatureRow(
  f: PlanningFeature,
  blocker: FeatureBlockerOverlay | undefined,
  canEdit: boolean,
  artId: string,
  assignablePis: { id: string; name: string }[],
  pis: TablePi[],
) {
  const titles = [
    ...(blocker?.scheduledBlockerTitles.map((t) => `wegen ${t}`) ?? []),
    ...(blocker?.unscheduledBlockerTitles.map((t) => `${t} (ungeplant)`) ?? []),
  ].join(" · ");
  return (
    <tr key={f.id} className="border-b hover:bg-muted/30">
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          {blocker?.violates && (
            <Lock
              className="h-3 w-3 shrink-0 text-amber-700"
              aria-label="Vor frühestmöglichem PI"
            />
          )}
          <Link href={`/feature/${f.id}`} className="font-medium text-primary hover:underline">
            {f.title}
          </Link>
        </div>
        {blocker?.violates && (
          <p className="mt-0.5 text-[10px] text-amber-700" title={titles}>
            Frühestens{" "}
            {blocker.earliestPiName ??
              (blocker.earliestStart
                ? blocker.earliestStart.toISOString().slice(0, 10)
                : "unbestimmt")}
          </p>
        )}
      </td>
      <td className="px-3 py-3">
        <span
          className={`inline-block rounded-full px-2 py-0.5 text-xs ${
            FEATURE_STATUS[f.status] ?? "bg-muted text-foreground/80"
          }`}
        >
          {f.status}
        </span>
      </td>
      <td className="px-3 py-3 text-center font-semibold text-primary/80">{round1(f.wsjf)}</td>
      <td className="px-3 py-3 text-xs text-muted-foreground">{f.epicTitle ?? "—"}</td>
      <td className="px-3 py-3">
        {canEdit ? (
          <FeaturePiSelect
            featureId={f.id}
            artId={artId}
            currentPiId={f.piId}
            pis={assignablePis}
          />
        ) : (
          <span className="text-xs text-muted-foreground">
            {pis.find((p) => p.id === f.piId)?.name ?? "Backlog"}
          </span>
        )}
      </td>
    </tr>
  );
}
