import { Link } from "@/i18n/navigation";
import { buildMonthAxis, barMetrics, type DateRange } from "@/domain/roadmap";
import { CreatePiDialog } from "@/features/pi/components/create-pi-dialog";
import { CadenceField } from "./cadence-field";
import type { StructureTimeline as Timeline } from "@/server/services/structure";

interface Props {
  timeline: Timeline;
  canEditCadence: boolean;
  canCreatePi: boolean;
}

const PI_STATUS: Record<string, string> = {
  planned: "bg-blue-100 text-blue-800 border-blue-200",
  active: "bg-emerald-100 text-emerald-800 border-emerald-200",
  completed: "bg-muted text-muted-foreground border-border",
};

function ArtHeader({
  art,
  canEditCadence,
  canCreatePi,
}: {
  art: Timeline[number];
  canEditCadence: boolean;
  canCreatePi: boolean;
}) {
  return (
    <div className="w-56 shrink-0 space-y-1 border-r p-3">
      <Link href={`/art/${art.id}`} className="text-sm font-medium hover:underline">
        {art.name}
      </Link>
      <p className="text-xs text-muted-foreground">{art.valueStream.name}</p>
      <div className="flex items-center gap-1 text-xs text-muted-foreground">
        <span>Kadenz:</span>
        {canEditCadence ? (
          <CadenceField artId={art.id} value={art.piCadenceWeeks} />
        ) : (
          <span>{art.piCadenceWeeks} Wo</span>
        )}
      </div>
      {canCreatePi && <CreatePiDialog artId={art.id} />}
    </div>
  );
}

/**
 * Structure Timeline tab — a per-ART calendar of Program Increments (bars over a
 * month axis) plus inline PI-cadence editing and PI creation. Defines PI cadence
 * and dates in one place. Reuses the roadmap month-axis maths.
 */
export function StructureTimeline({ timeline, canEditCadence, canCreatePi }: Props) {
  if (timeline.length === 0) {
    return (
      <p className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
        Noch keine ARTs. Lege im Tab „ARTs" einen an, um PIs zu planen.
      </p>
    );
  }

  const ranges: DateRange[] = timeline.flatMap((a) =>
    a.pis.map((p) => ({ start: new Date(p.startDate), end: new Date(p.endDate) })),
  );
  const axis = buildMonthAxis(ranges);
  const hasPis = ranges.length > 0;

  return (
    <div className="overflow-x-auto rounded-lg border">
      <div className="min-w-[720px]">
        {/* Month axis header */}
        <div className="flex border-b bg-muted/30">
          <div className="w-56 shrink-0 border-r p-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            ART
          </div>
          <div className="flex flex-1">
            {hasPis ? (
              axis.months.map((m) => (
                <div
                  key={m.key}
                  className="flex-1 border-l px-1 py-2 text-center text-[10px] text-muted-foreground"
                >
                  {m.label}
                </div>
              ))
            ) : (
              <div className="px-2 py-2 text-[10px] text-muted-foreground">
                Noch keine PIs terminiert
              </div>
            )}
          </div>
        </div>

        {/* One row per ART */}
        {timeline.map((art) => (
          <div key={art.id} className="flex items-stretch border-b last:border-b-0">
            <ArtHeader art={art} canEditCadence={canEditCadence} canCreatePi={canCreatePi} />
            <div className="relative my-3 flex-1">
              {hasPis &&
                art.pis.map((pi) => {
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
              {art.pis.length === 0 && (
                <span className="text-xs text-muted-foreground">Keine PIs</span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
