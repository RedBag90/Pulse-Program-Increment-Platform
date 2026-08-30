import { Card } from "@/components/ui/card";
import { Link } from "@/i18n/navigation";
import { ArrowRight } from "lucide-react";
import { HORIZON_LABEL, type GuardrailTargets } from "@/modules/work/domain/portfolio-guardrails";

interface Props {
  targets: GuardrailTargets;
}

/**
 * Read-only Sicht der Targets fuer User ohne `target.manage`. Gehoert zu Work
 * (wie `GuardrailTargetsForm`), gerendert auf der Controlling-Uebersicht. Zeigt die
 * aktuell wirksamen Anteile + Deep-Link aufs Dashboard, wo der Ist-vs-Soll
 * Mix gerendert wird.
 */
export function GuardrailTargetsReadOnly({ targets }: Props) {
  return (
    <Card className="space-y-3 p-4">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h3 className="font-heading text-base font-medium">Portfolio-Guardrail-Targets</h3>
          <p className="text-xs text-muted-foreground">
            Aktuell wirksame Soll-Mix-Anteile. Pflege liegt beim LPM.
          </p>
        </div>
        <Link
          href="/portfolio/guardrails"
          className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
        >
          Ist-vs-Soll öffnen
          <ArrowRight className="size-3.5" />
        </Link>
      </header>
      <div className="grid gap-3 md:grid-cols-3">
        <div className="rounded-md border p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Horizon
          </p>
          <ul className="space-y-1 text-sm">
            <Row label={HORIZON_LABEL.h3} value={targets.horizon.h3} />
            <Row label={HORIZON_LABEL.h2} value={targets.horizon.h2} />
            <Row label={HORIZON_LABEL.h1} value={targets.horizon.h1} />
            <Row label={HORIZON_LABEL.h0} value={targets.horizon.h0} />
          </ul>
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Capacity
          </p>
          <ul className="space-y-1 text-sm">
            <Row label="Business" value={targets.capacity.business} />
            <Row label="Enabler" value={targets.capacity.enabler} />
          </ul>
        </div>
        <div className="rounded-md border p-3">
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">
            Engagement
          </p>
          <ul className="space-y-1 text-sm">
            <Row label="Abdeckung" value={targets.engagement.coverage} />
            <Row label="Reaktionszeit" value={targets.engagement.responseDays} unit="Tage" />
          </ul>
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, unit = "%" }: { label: string; value: number; unit?: string }) {
  return (
    <li className="flex items-center justify-between gap-2">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">
        {value} {unit}
      </span>
    </li>
  );
}
