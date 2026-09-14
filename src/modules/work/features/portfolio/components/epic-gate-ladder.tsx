import {
  GATE_STEPS,
  gateStepLabel,
  gateStepNumber,
  type GateStep,
} from "@/modules/work/domain/stage-gate";

/**
 * **Die Leiter als Band** — acht Tore, der erreichte Stand, sonst nichts.
 *
 * Sie ersetzt das fünfkachelige Raster des Lebenszyklus-Steppers. Das zeigte je
 * Schritt Icon, Titel und einen Erklärsatz und belegte damit über *jedem* der
 * neun Reiter drei Zeilen — obwohl die Auskunft, um die es geht, eine einzige
 * ist: wie weit ist dieses Vorhaben.
 *
 * Die Stufen kommen aus `GATE_STEPS`, die Beschriftung aus `gateStepLabel` —
 * dieselben Quellen, aus denen die Gate-Karte und der Antrag sie nehmen. Eine
 * zweite, abgeschriebene Liste gäbe es sonst schon wieder.
 */
export function EpicGateLadder({ current }: { current: GateStep }) {
  const at = GATE_STEPS.indexOf(current);

  return (
    /* Der Tour-Anker zog vom abgeloesten Stepper hierher: er meint „die Stelle,
       an der der Reifegrad steht", und das ist jetzt die Leiter. */
    <ol className="flex items-start" aria-label="Reifegrad" data-tour="epic-lifecycle-stepper">
      {GATE_STEPS.map((step, i) => {
        const done = i < at;
        const now = i === at;
        return (
          <li key={step} className="relative flex min-w-0 flex-1 flex-col items-center gap-1.5">
            {/* Der Faden zur vorigen Stufe — er läuft hinter dem Punkt durch. */}
            {i > 0 && (
              <span
                aria-hidden
                className={`absolute left-[-50%] top-[6px] h-0.5 w-full ${
                  done || now ? "bg-primary" : "bg-border"
                }`}
              />
            )}
            <span
              aria-hidden
              className={`relative z-10 size-3.5 rounded-full border-2 ${
                done
                  ? "border-primary bg-primary"
                  : now
                    ? "border-primary bg-card ring-3 ring-primary/20"
                    : "border-border bg-card"
              }`}
            />
            <span
              className={`truncate font-mono text-label tracking-tight ${
                now ? "font-semibold text-primary" : "text-muted-foreground"
              }`}
              title={gateStepLabel(step)}
            >
              {gateStepNumber(step)}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
