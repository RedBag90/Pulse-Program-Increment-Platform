/**
 * Die **Art** einer Run-the-Business-Position.
 *
 * `run` ist der laufende Betrieb — das heutige Verhalten und der Default.
 * `art_change` ist der **ART-Epic-Budget** eines ARTs: der Topf, aus dem er
 * seine ART-Epics finanziert.
 *
 * Beide gehen denselben Weg über die PB-Liste und werden dort mitverteilt: der
 * Wertstrom entscheidet in der Kachel, **wie groß** der Rahmen ist, der ART
 * danach, **wofür**. Getrennt gehalten werden sie, weil sonst Veränderungsarbeit
 * aus dem Betriebstopf bezahlt würde — und vier bestehende Flächen unwahr
 * wären: die Grow-/Run-Kacheln der Solution, der Run-Anteil am Wertstrom, die
 * PB-Listen-Gliederung und Guardrail 2.
 *
 * Rein, kein I/O.
 */

import { rtbAnnualAmount } from "@/modules/budgeting/domain/rtb-interval";

export const RTB_KINDS = ["run", "art_change"] as const;
export type RtbKind = (typeof RTB_KINDS)[number];

export const RTB_KIND_LABELS: Record<RtbKind, string> = {
  run: "Betrieb",
  art_change: "ART-Epic-Budget",
};

/** Unbekanntes oder fehlendes Kind → Betrieb; das ist der Bestand. */
export function rtbKindOrDefault(raw: string | null | undefined): RtbKind {
  return raw != null && (RTB_KINDS as readonly string[]).includes(raw) ? (raw as RtbKind) : "run";
}

/** Zählt diese Art als Grow (Veränderung) statt als Run (Betrieb)? */
export function isChangeKind(raw: string | null | undefined): boolean {
  return rtbKindOrDefault(raw) === "art_change";
}

/** Eine Position, so weit die Gruppierung sie kennen muss. */
export interface RtbGroupable {
  kind?: string | null | undefined;
  plannedAmount: number;
  interval: string | null;
  active: boolean;
}

export interface RtbGroup<T> {
  items: T[];
  /** Σ Jahres-Äquivalent der **aktiven** Positionen dieser Gruppe. */
  annual: number;
  /** Σ Kachel-Ask der aktiven Positionen — die Hälfte des Jahresbetrags. */
  cycle: number;
}

/**
 * Trennt die Positionen eines Wertstroms in **Run** und **Grow**.
 *
 * Der Unterschied ist fachlich, nicht dekorativ: `Betrieb` hält den Laden am
 * Laufen, ein `ART-Epic-Budget` finanziert Veränderung. Die ART-Fläche stellt
 * beide längst getrennt dar; die Wertstrom-Fläche summierte sie zusammen und
 * beschriftete das Ergebnis als „Betriebskosten (Keep the lights on)" — bei den
 * Testdaten waren darin **69 % Grow**.
 *
 * Deshalb liegt die Trennung hier und nicht in der Komponente: eine falsche
 * Summe ist ein fachlicher Fehler und gehört prüfbar, ohne eine Fläche zu
 * rendern.
 *
 * Rein, kein I/O.
 */
export function splitRunAndChange<T extends RtbGroupable>(
  items: readonly T[],
): { run: RtbGroup<T>; change: RtbGroup<T> } {
  const group = (of: T[]): RtbGroup<T> => {
    const annual = of.reduce(
      (s, i) => (i.active ? s + rtbAnnualAmount(i.plannedAmount, i.interval) : s),
      0,
    );
    return { items: of, annual, cycle: annual / 2 };
  };
  return {
    run: group(items.filter((i) => !isChangeKind(i.kind))),
    change: group(items.filter((i) => isChangeKind(i.kind))),
  };
}
