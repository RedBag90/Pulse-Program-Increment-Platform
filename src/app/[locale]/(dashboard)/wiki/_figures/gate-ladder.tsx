import { useTranslations } from "next-intl";
import {
  GATE_STEPS,
  GATE_STEP_KEYS,
  gateStepNumberKey,
  type GateStep,
} from "@/modules/work/domain/stage-gate";

/**
 * Das Etikett ohne die Marke, die in der Zeile darueber schon steht.
 *
 * Vorher schnitt hier `replace(/^L[0-9.]+\s/, "")` — eine Regex, die stillschweigend
 * nichts tat, sobald ein Schritt keine Nummer trug. Jetzt haengt der Schnitt an
 * genau dem Text, der tatsaechlich darueber steht, und kann nicht mehr daneben
 * greifen.
 */
function detail(step: GateStep): string {
  const t = useTranslations();
  const label = t(GATE_STEP_KEYS[step] ?? step);
  const mark = t(gateStepNumberKey(step));
  return label.startsWith(`${mark} `) ? label.slice(mark.length + 1) : label;
}

/**
 * **Die Leiter.** Acht Schritte, und jeder einzelne bewegt sich nur dadurch,
 * dass jemand ihn beantragt und benannte Personen ihn abnehmen.
 *
 * **Acht hier, sieben auf der Epic-Seite** — und das ist kein Widerspruch,
 * sondern der Unterschied zwischen zwei Fragen. Diese Figur erklaert den
 * *Antrags*-Weg, und „zur Analyse ausgewaehlt" wird beantragt und abgenommen
 * wie jeder andere Schritt. `EpicGateLadder` zeigt den *Reifegrad*, und den
 * bewegt dieser Schritt nicht; dort steht er darum nicht. Wer beide Listen
 * gleichsetzt, schreibt an einer der zwei Stellen etwas Falsches.
 *
 * Die Beschriftungen kommen aus `GATE_STEP_KEYS` — dieselben, die auf der
 * Gate-Karte stehen. Insbesondere `L4.1 Umsetzung laeuft`: gespeichert wird der
 * Schritt als `L4`, angezeigt heisst er ueberall L4.1, und ein abgeschriebener
 * Text haette sich hier mit Sicherheit fuer die falsche Variante entschieden.
 */
export function GateLadder() {
  const t = useTranslations();
  return (
    <div className="overflow-x-auto rounded-lg bg-card shadow-card">
      <ol className="flex min-w-[640px] divide-x">
        {GATE_STEPS.map((g) => (
          <li key={g} className="flex-1 px-2.5 py-3 text-center">
            <p className="font-mono text-meta uppercase tracking-[0.1em] text-muted-foreground">
              {t(gateStepNumberKey(g))}
            </p>
            <p className="mt-1 text-xs leading-snug text-foreground">{detail(g)}</p>
          </li>
        ))}
      </ol>
    </div>
  );
}
