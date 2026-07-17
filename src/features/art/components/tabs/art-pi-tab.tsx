import { Link } from "@/i18n/navigation";

interface PiSummary {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
  _count: { initiatives: number };
}

interface Props {
  pis: PiSummary[];
  piCadenceWeeks: number | null;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-foreground/80",
  active: "bg-green-100 text-green-800",
  completed: "bg-blue-100 text-blue-700",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ArtPiTab({ pis, piCadenceWeeks }: Props) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-xl font-semibold">Program Increments</h2>
        {piCadenceWeeks && (
          <p className="text-sm text-muted-foreground mt-1">PI cadence: {piCadenceWeeks} weeks</p>
        )}
      </div>

      {pis.length === 0 ? (
        <div className="rounded-lg border border-dashed bg-muted/30 p-8 text-center text-sm text-muted-foreground">
          <p>Noch keine PIs.</p>
          <p className="mt-2">
            PIs entstehen aus dem Standard, der auf die Timeline dieses ARTs angewendet wird.{" "}
            <Link
              href="/structure?tab=timeline"
              className="text-primary underline hover:no-underline"
            >
              Zur Timeline-Verwaltung →
            </Link>
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {pis.map((pi) => {
            const badge = STATUS_BADGE[pi.status] ?? "bg-muted text-foreground/80";
            return (
              <Link
                key={pi.id}
                href={`/pi/${pi.id}`}
                className="block border rounded-lg p-5 hover:shadow-sm hover:border-blue-300 transition-colors"
              >
                <div className="flex items-center justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="font-semibold">{pi.name}</h3>
                    <p className="text-sm text-muted-foreground">
                      {formatDate(pi.startDate)} – {formatDate(pi.endDate)}
                    </p>
                  </div>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground shrink-0">
                    <span>
                      {pi._count.initiatives} feature{pi._count.initiatives !== 1 ? "s" : ""}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-medium ${badge}`}
                    >
                      {pi.status}
                    </span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
