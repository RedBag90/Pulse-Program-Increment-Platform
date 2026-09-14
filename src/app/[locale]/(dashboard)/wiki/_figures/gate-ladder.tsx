import { GATE_STEPS, GATE_STEP_LABELS, gateStepNumber } from "@/modules/work/domain/stage-gate";

/**
 * **Die Leiter.** Acht Schritte, und jeder einzelne bewegt sich nur dadurch,
 * dass jemand ihn beantragt und benannte Personen ihn abnehmen.
 *
 * Die Beschriftungen kommen aus `GATE_STEP_LABELS` — dieselben, die auf der
 * Gate-Karte stehen. Insbesondere `L4.1 Umsetzung laeuft`: gespeichert wird der
 * Schritt als `L4`, angezeigt heisst er ueberall L4.1, und ein abgeschriebener
 * Text haette sich hier mit Sicherheit fuer die falsche Variante entschieden.
 */
export function GateLadder() {
  return (
    <div className="overflow-x-auto rounded-lg bg-card shadow-card">
      <ol className="flex min-w-[640px] divide-x">
        {GATE_STEPS.map((g) => (
          <li key={g} className="flex-1 px-2.5 py-3 text-center">
            <p className="font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground">
              {gateStepNumber(g)}
            </p>
            <p className="mt-1 text-xs leading-snug text-foreground">
              {GATE_STEP_LABELS[g].replace(/^L[0-9.]+\s/, "")}
            </p>
          </li>
        ))}
      </ol>
    </div>
  );
}
