/**
 * Die Optionen der **erwarteten Einordnung** — mit dem Limit, das sie trennt.
 *
 * Wer beim Anlegen wählt, womit er rechnet, hat die einzige Zahl nicht zur
 * Hand, die den Unterschied ausmacht. Sie steht deshalb im Label.
 *
 * **Zur Wortwahl:** `classifyEpic` vergleicht `Kosten > Limit`
 * (`work/domain/pb-submission.ts`) — genau auf dem Limit ist es noch ein
 * ART-Epic. „über" und „bis" treffen das; „ab" bzw. „unter" wären am Randfall
 * falsch.
 *
 * Liegt hier und nicht in der Domäne, weil `formatEUR` aus `@/lib` kommt und
 * kein Domain-Modul die Formatierung importiert — das soll so bleiben.
 *
 * Rein, kein I/O.
 */

import { formatEUR } from "@/lib/formatting";
import { EPIC_CLASS_LABELS, type EpicClass } from "@/modules/work/domain/pb-submission";

export interface IntendedClassOption {
  value: EpicClass;
  label: string;
}

/**
 * `threshold === null` ⇒ die schlichten Namen. Das ist der Zustand, solange die
 * Schwellen nicht geladen sind: lieber keine Zahl als eine falsche.
 */
export function intendedClassOptions(threshold: number | null): IntendedClassOption[] {
  if (threshold == null) {
    return [
      { value: "portfolio", label: EPIC_CLASS_LABELS.portfolio },
      { value: "art", label: EPIC_CLASS_LABELS.art },
    ];
  }
  const limit = formatEUR(threshold);
  return [
    { value: "portfolio", label: `${EPIC_CLASS_LABELS.portfolio} — über ${limit}` },
    { value: "art", label: `${EPIC_CLASS_LABELS.art} — bis ${limit}` },
  ];
}
