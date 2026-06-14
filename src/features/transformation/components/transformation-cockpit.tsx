import { Target, ArrowRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { CockpitHero } from "@/features/transformation/components/cockpit-hero";
import { ActionDrawer } from "@/features/transformation/components/action-drawer";
import { StructureChipRow } from "@/features/transformation/components/structure-chip-row";
import { PracticesChipRow } from "@/features/transformation/components/practices-chip-row";
import type { CockpitModel } from "@/server/views/transformation-cockpit";

interface Props {
  model: CockpitModel;
  canManage: boolean;
}

/**
 * Transformation cockpit — Maturity status board.
 *
 * Top-left: hero with the single "Soll-Reife" number + long-window delta +
 * snapshot button. Below: a Deep-Link Card auf das Ziele-Modul (strategische
 * Ziele leben dort). Darunter: Struktur + Praktiken chip rows. Rechte Spalte
 * (≥ lg): persistenter Action-Drawer mit „Naechste Schritte" + „Seit letztem
 * Snapshot".
 *
 * Empty-State greift nur, wenn weder Snapshot, Struktur noch Praktiken
 * vorhanden sind — typisch fuer ein frisches Tenant ohne aktives Modell.
 */
export function TransformationCockpit({ model: cockpit, canManage }: Props) {
  const { hero, model, structure, practices, trend, recentChanges, nextSteps } = cockpit;

  const empty = !hero.hasSnapshot && structure.length === 0 && practices.length === 0;

  if (empty) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <Target className="mx-auto h-6 w-6 text-muted-foreground" />
        <p className="mt-2 text-sm text-muted-foreground">
          Noch kein Zielzustand definiert. Sobald die Organisation Fortschritt erfasst, misst Pulse
          ihn hier.
        </p>
      </div>
    );
  }

  return (
    <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
      {/* Left column — status */}
      <div className="space-y-6">
        <CockpitHero hero={hero} model={model} trend={trend} canManage={canManage} />

        <ZielePromoCard />

        {(structure.length > 0 || practices.length > 0) && (
          <div className="grid gap-6 md:grid-cols-2">
            <StructureChipRow structure={structure} />
            <PracticesChipRow practices={practices} />
          </div>
        )}
      </div>

      {/* Right column — action drawer (sticky on lg+) */}
      <ActionDrawer
        nextSteps={nextSteps}
        recentChanges={recentChanges}
        hasSnapshot={hero.hasSnapshot}
      />
    </div>
  );
}

/**
 * Deep-Link Card auf das Ziele-Modul. Ersetzt die alte „Strategische
 * Ziele"-Sektion + „Outcomes (frei)"-Liste — beide leben jetzt
 * vollstaendig unter `/ziele` (Vision → Theme → OKR → KR mit
 * €-Rollup).
 */
function ZielePromoCard() {
  return (
    <Link
      href="/ziele"
      className="group flex items-center justify-between gap-4 rounded-lg border bg-gradient-to-r from-primary/5 to-card p-4 transition-shadow hover:shadow-md"
    >
      <div>
        <p className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
          Strategische Ziele
        </p>
        <p className="mt-0.5 text-sm font-medium">
          Themes, Objectives &amp; Key Results mit €-Rollup
        </p>
        <p className="text-xs text-muted-foreground">
          Hier siehst du das Reifegrad-Ist; die Strategie pflegst du im Ziele-Modul.
        </p>
      </div>
      <ArrowRight className="h-5 w-5 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5" />
    </Link>
  );
}
