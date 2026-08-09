import { Link } from "@/i18n/navigation";
import { ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { SectionLabel } from "@/components/ui/section-label";
import type { PortfolioOverview } from "@/modules/work/server/views/portfolio-overview";

/**
 * Renders the coaching layer from `deriveNextSteps` (structural shortfalls and
 * low-adoption practices). Surfaces actionable navigation rather than data —
 * "where would you click next?".
 */
export function NextStepsBlock({ data }: { data: PortfolioOverview }) {
  return (
    <Card className="space-y-3 p-4">
      <SectionLabel>Nächste Schritte</SectionLabel>
      {data.nextSteps.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Aktuell keine konkreten Hinweise — Struktur und Praxis sind im Ziel.
        </p>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {data.nextSteps.map((s) => (
            <li key={s.key}>
              <Link
                href={s.href}
                className="group inline-flex items-center gap-1.5 hover:text-primary"
              >
                <ChevronRight className="size-4 text-muted-foreground transition-colors group-hover:text-primary" />
                <span>{s.title}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
