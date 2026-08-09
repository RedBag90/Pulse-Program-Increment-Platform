import { Link } from "@/i18n/navigation";
import { Check } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import { STAGE_GATE_LABEL, type PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";

/**
 * Top 3 "wins" for the executive briefing — most recent epic transitions out
 * of Funnel, the highest-scoring goal, and a hint that a PI is live. Designed
 * to read like a weekly status report.
 */
export function TopWinsBlock({ data }: { data: PortfolioOverview }) {
  const wins: { key: string; label: string; href?: string }[] = [];

  // Epic momentum — most recent epic not in Funnel or Done.
  const moving = [...data.epics]
    .filter((e) => e.stageGate !== "L0" && e.stageGate !== "L5" && e.status !== "blocked")
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime())[0];
  if (moving) {
    const gate =
      STAGE_GATE_LABEL[moving.stageGate as keyof typeof STAGE_GATE_LABEL] ?? moving.stageGate;
    wins.push({
      key: `epic-${moving.id}`,
      label: `„${moving.title}" → ${gate}`,
      href: `/portfolio/epics/${moving.id}`,
    });
  }

  if (data.topGoal && data.topGoal.progress >= 0.5) {
    wins.push({
      key: `goal-${data.topGoal.id}`,
      label: `„${data.topGoal.title}"-Ziel: ${Math.round(data.topGoal.progress * 100)}%`,
      href: `/transformation`,
    });
  }

  if (data.activePis.length > 0 && data.nearestPiEnd) {
    wins.push({
      key: "pi-active",
      label: `${data.activePis.length} PI${data.activePis.length === 1 ? "" : "s"} aktiv (nächstes Ende: ${data.nearestPiEnd.name})`,
    });
  }

  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Top-Erfolge</SectionLabel>
      {wins.length === 0 ? (
        <p className="text-sm text-muted-foreground">Noch keine Erfolge zu vermelden.</p>
      ) : (
        <ul className="space-y-2 text-sm">
          {wins.slice(0, 3).map((w) => (
            <li key={w.key} className="flex items-start gap-2">
              <Check className="mt-0.5 size-4 shrink-0 text-emerald-500" />
              {w.href ? (
                <Link href={w.href} className="hover:text-primary hover:underline">
                  {w.label}
                </Link>
              ) : (
                <span>{w.label}</span>
              )}
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
