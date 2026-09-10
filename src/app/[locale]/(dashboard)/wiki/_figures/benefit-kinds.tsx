import {
  BENEFIT_KINDS,
  BENEFIT_KIND_LABELS,
  benefitKindOrDefault,
} from "@/modules/core/kpi/domain/kpi-benefit-kind";

const EFFECT: Record<(typeof BENEFIT_KINDS)[number], string> = {
  one_time: "realisiert seinen Wert einmalig — zum Go-live.",
  recurring: "läuft ab Go-live weiter, als jährliche Run-Rate.",
};

/**
 * Die **Nutzenart** einer KPI, und die stille Vorgabe dahinter.
 *
 * Der interessante Teil ist nicht die Liste, sondern welcher Wert gilt, wenn
 * nichts gespeichert ist — und den beantwortet die Figur nicht aus dem
 * Gedaechtnis, sondern indem sie `benefitKindOrDefault(null)` **fragt**. Steht
 * die Vorgabe eines Tages anders im Code, steht sie hier am naechsten Tag
 * anders auf der Seite.
 */
export function BenefitKinds() {
  const fallback = benefitKindOrDefault(null);
  return (
    <div className="divide-y overflow-hidden rounded-lg border bg-card">
      {BENEFIT_KINDS.map((k) => (
        <div key={k} className="space-y-1 p-4">
          <p className="text-[14px] font-medium text-foreground">
            {BENEFIT_KIND_LABELS[k]}{" "}
            <code className="font-mono text-[11px] font-normal text-muted-foreground">{k}</code>
            {k === fallback && (
              <span className="ml-2 rounded border bg-muted px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground">
                Vorgabe
              </span>
            )}
          </p>
          <p className="max-w-[var(--reading-max-w)] text-[13.5px] leading-relaxed text-muted-foreground">
            {EFFECT[k]}
          </p>
        </div>
      ))}
    </div>
  );
}
