import {
  LADDER_STEPS,
  gateOfStep,
  gateStepLabel,
  gateStepNumber,
  type GateStep,
} from "@/modules/work/domain/stage-gate";

/**
 * **Die Leiter als Band** — die sieben Reifegrade, der erreichte Stand, sonst
 * nichts.
 *
 * Sie ersetzt das fünfkachelige Raster des Lebenszyklus-Steppers. Das zeigte je
 * Schritt Icon, Titel und einen Erklärsatz und belegte damit über *jedem* der
 * neun Reiter drei Zeilen — obwohl die Auskunft, um die es geht, eine einzige
 * ist: wie weit ist dieses Vorhaben.
 *
 * **Sieben Punkte, nicht acht.** Die Stufen kommen aus `LADDER_STEPS`, nicht
 * aus `GATE_STEPS`: „Zur Analyse ausgewählt" ist ein beantragter Schritt, aber
 * kein Reifegrad — auf einer Leiter mit der Überschrift „Reifegrad" misst er
 * nichts. Die Beschriftung kommt aus `gateStepLabel`, also aus derselben
 * Quelle, aus der die Gate-Karte und der Antrag sie nehmen; eine zweite,
 * abgeschriebene Liste gäbe es sonst schon wieder.
 */
export function EpicGateLadder({ current }: { current: GateStep }) {
  // Steht das Epic auf einem Schritt, der auf dieser Leiter nicht vorkommt,
  // zeigt sie den Reifegrad, auf dem es dadurch bleibt — ein Epic „zur Analyse
  // ausgewählt" steht auf L1. Ohne das zeigte die Leiter für genau die Epics
  // zwischen Hypothese und Business Case auf nichts.
  const at = LADDER_STEPS.indexOf(LADDER_STEPS.includes(current) ? current : gateOfStep(current));

  return (
    /* Der Tour-Anker zog vom abgeloesten Stepper hierher: er meint „die Stelle,
       an der der Reifegrad steht", und das ist jetzt die Leiter. */
    <ol className="flex items-start" aria-label="Reifegrad" data-tour="epic-lifecycle-stepper">
      {LADDER_STEPS.map((step, i) => {
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
