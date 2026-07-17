import { Link } from "@/i18n/navigation";
import { Card } from "@/components/ui/card";
import { Target, Users, Zap } from "lucide-react";

interface PiSummary {
  id: string;
  name: string;
  status: string;
  startDate: Date;
  endDate: Date;
}

interface Props {
  artId: string;
  pis: PiSummary[];
  teamCount: number;
  featureCount: number;
}

const STATUS_BADGE: Record<string, string> = {
  planned: "bg-muted text-muted-foreground",
  active: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300",
  completed: "bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-300",
};

function formatDate(d: Date) {
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

export function ArtOverviewTab({ artId, pis, teamCount, featureCount }: Props) {
  const stats = [
    {
      label: "Program Increments",
      value: pis.length,
      href: `/art/${artId}/v2?tab=pi` as const,
      icon: Target,
      color: "text-violet-600 dark:text-violet-400",
      bg: "bg-violet-50 dark:bg-violet-950",
    },
    {
      label: "Teams",
      value: teamCount,
      href: `/art/${artId}/v2?tab=teams` as const,
      icon: Users,
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-50 dark:bg-blue-950",
    },
    {
      label: "Features",
      value: featureCount,
      href: `/umsetzung?art=${artId}&view=table` as const,
      icon: Zap,
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-50 dark:bg-emerald-950",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-3">
        {stats.map((s) => (
          <Link key={s.label} href={s.href}>
            <Card className="p-5 hover:border-primary/40 hover:shadow-sm transition-all cursor-pointer">
              <div className="flex items-center gap-3">
                <div className={`p-2 rounded-lg ${s.bg} shrink-0`}>
                  <s.icon className={`size-4 ${s.color}`} />
                </div>
                <div>
                  <p className="text-2xl font-bold tabular-nums">{s.value}</p>
                  <p className="text-xs text-muted-foreground">{s.label}</p>
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
          Program Increments
        </h2>
        {pis.length === 0 ? (
          <p className="text-sm text-muted-foreground">No PIs yet.</p>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border">
              {pis.map((pi) => (
                <Link
                  key={pi.id}
                  href={`/pi/${pi.id}`}
                  className="px-4 py-3 flex items-center justify-between text-sm hover:bg-muted/30 transition-colors"
                >
                  <span className="font-medium hover:text-primary transition-colors">
                    {pi.name}
                  </span>
                  <div className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span>
                      {formatDate(pi.startDate)} – {formatDate(pi.endDate)}
                    </span>
                    <span
                      className={`inline-block rounded-full px-2.5 py-0.5 font-medium ${
                        STATUS_BADGE[pi.status] ?? "bg-muted text-muted-foreground"
                      }`}
                    >
                      {pi.status}
                    </span>
                  </div>
                </Link>
              ))}
            </div>
          </Card>
        )}
      </section>
    </div>
  );
}
