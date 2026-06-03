import { Link } from "@/i18n/navigation";
import { buildMonthAxis, barMetrics, type DateRange } from "@/domain/roadmap";
import {
  PiStandardsManager,
  type PiStandard,
} from "@/features/structure/components/pi-standards-manager";
import { CreateTimelineButton } from "@/features/structure/components/create-timeline-button";
import { CreateTimelineFromStandard } from "@/features/structure/components/create-timeline-from-standard";
import { DeleteTimelineButton } from "@/features/structure/components/delete-timeline-button";
import {
  JoinArtToTimelineControl,
  AssignTimelineDropdown,
} from "@/features/structure/components/join-art-control";
import { LeaveTimelineButton } from "@/features/structure/components/leave-timeline-button";
import { AddStandardPisControl } from "@/features/structure/components/add-standard-pis-control";
import type { StructureTimeline as StructureTimelineData } from "@/server/services/structure";

interface Props {
  timeline: StructureTimelineData;
  canEditCadence: boolean;
  canCreatePi: boolean;
  canManageStandards: boolean;
  standards: PiStandard[];
}

const PI_STATUS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800 border-blue-200",
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  completed: "bg-muted text-muted-foreground border-border",
};

/**
 * Structure Timeline tab — Timelines are the primary rows (one shared PI
 * calendar per Timeline) with their subscribed ARTs nested underneath. ARTs
 * without a Timeline get a callout so the operator can attach them.
 *
 * Toolbar: spawn a Timeline manually or from an existing PI-Standard. The
 * latter is the fastest bootstrap when a standard already encodes the desired
 * cadence and PI series.
 */
export function StructureTimeline({ timeline, canCreatePi, canManageStandards, standards }: Props) {
  const { timelines, unassignedArts } = timeline;
  const standardOptions = standards.map((s) => ({ id: s.id, name: s.name }));
  const timelineOptions = timelines.map((t) => ({ id: t.id, name: t.name }));

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap items-center gap-2">
          {canCreatePi && <CreateTimelineButton />}
          {canCreatePi && standards.length > 0 && (
            <CreateTimelineFromStandard standards={standards} />
          )}
        </div>
        {canManageStandards && <PiStandardsManager standards={standards} />}
      </div>

      {timelines.length === 0 && unassignedArts.length === 0 && (
        <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
          Noch keine Timelines. Lege deine erste Timeline an — am schnellsten aus einem PI-Standard.
        </p>
      )}

      {timelines.map((t) => {
        const ranges: DateRange[] = t.programIncrements.map((p) => ({
          start: new Date(p.startDate),
          end: new Date(p.endDate),
        }));
        const axis = buildMonthAxis(ranges);
        const hasPis = ranges.length > 0;

        return (
          <div key={t.id} className="overflow-hidden rounded-lg border">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b bg-muted/30 px-4 py-2">
              <div className="flex items-baseline gap-3">
                <span className="text-sm font-semibold">{t.name}</span>
                <span className="text-xs text-muted-foreground">
                  Kadenz: {t.cadenceWeeks} Wo · {t.arts.length} ART
                  {t.arts.length === 1 ? "" : "s"} · {t.programIncrements.length} PI
                  {t.programIncrements.length === 1 ? "" : "s"}
                </span>
              </div>
              <div className="flex items-center gap-2">
                {canCreatePi && standardOptions.length > 0 && (
                  <AddStandardPisControl timelineId={t.id} standards={standardOptions} />
                )}
                {canCreatePi && <DeleteTimelineButton timelineId={t.id} timelineName={t.name} />}
              </div>
            </div>

            {/* PI calendar */}
            <div className="overflow-x-auto">
              <div className="min-w-[640px]">
                <div className="flex border-b bg-muted/10">
                  {hasPis ? (
                    axis.months.map((m) => (
                      <div
                        key={m.key}
                        className="flex-1 border-l px-1 py-2 text-center text-[10px] text-muted-foreground first:border-l-0"
                      >
                        {m.label}
                      </div>
                    ))
                  ) : (
                    <div className="px-3 py-2 text-[10px] text-muted-foreground">
                      Noch keine PIs terminiert
                    </div>
                  )}
                </div>
                <div className="relative my-3 h-6 flex-1">
                  {hasPis &&
                    t.programIncrements.map((pi) => {
                      const { leftPct, widthPct } = barMetrics(
                        { start: new Date(pi.startDate), end: new Date(pi.endDate) },
                        axis,
                      );
                      return (
                        <Link
                          key={pi.id}
                          href={`/pi/${pi.id}`}
                          style={{ left: `${leftPct}%`, width: `${Math.max(widthPct, 3)}%` }}
                          className={`absolute top-0 truncate rounded border px-1.5 py-0.5 text-[10px] font-medium hover:opacity-90 ${
                            PI_STATUS[pi.status] ?? PI_STATUS.planned
                          }`}
                          title={pi.name}
                        >
                          {pi.name}
                        </Link>
                      );
                    })}
                </div>
              </div>
            </div>

            {/* ART list */}
            <div className="space-y-2 border-t bg-muted/5 px-4 py-2 text-xs">
              {t.arts.length === 0 ? (
                <span className="text-muted-foreground">Keine ARTs in dieser Timeline.</span>
              ) : (
                <ul className="space-y-1">
                  {t.arts.map((a) => (
                    <li key={a.id} className="flex items-center justify-between gap-2">
                      <span>
                        <Link href={`/art/${a.id}`} className="font-medium hover:underline">
                          {a.name}
                        </Link>
                        <span className="text-muted-foreground"> · {a.valueStream.name}</span>
                      </span>
                      {canCreatePi && <LeaveTimelineButton artId={a.id} artName={a.name} />}
                    </li>
                  ))}
                </ul>
              )}
              {canCreatePi && unassignedArts.length > 0 && (
                <div className="pt-1">
                  <JoinArtToTimelineControl
                    timelineId={t.id}
                    candidates={unassignedArts.map((a) => ({ id: a.id, name: a.name }))}
                  />
                </div>
              )}
            </div>
          </div>
        );
      })}

      {unassignedArts.length > 0 && (
        <div className="rounded-lg border border-dashed p-4">
          <h3 className="text-sm font-semibold">Ohne Timeline</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Diese ARTs haben noch keine Timeline. Sie sehen erst PIs, sobald sie einer Timeline
            beitreten.
          </p>
          <ul className="mt-2 space-y-1 text-xs">
            {unassignedArts.map((a) => (
              <li key={a.id} className="flex items-center justify-between gap-2">
                <span>
                  <Link href={`/art/${a.id}`} className="font-medium hover:underline">
                    {a.name}
                  </Link>
                  <span className="text-muted-foreground"> · {a.valueStream.name}</span>
                </span>
                {canCreatePi && timelineOptions.length > 0 && (
                  <AssignTimelineDropdown artId={a.id} timelines={timelineOptions} />
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
