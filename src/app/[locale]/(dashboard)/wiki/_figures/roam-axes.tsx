import { ROAM_STATUSES, ROAM_LABELS, ROAM_DOT } from "@/modules/core/kernel/domain/roam";

const MEANING: Record<string, string> = {
  open: "identifiziert, aber noch nicht eingeordnet — genau dieser Zustand kommt am PI-Abschluss zurück.",
  resolved: "erledigt, die Ursache ist weg.",
  owned: "jemand kümmert sich, mit Namen.",
  accepted: "wir leben damit, bewusst.",
  mitigated: "abgefedert; dazu gehören die Maßnahmen, die am Eintrag hängen.",
};

/**
 * **ROAM** — vier Einordnungen und der Zustand davor.
 *
 * Die Farben kommen aus `ROAM_DOT`, derselben Palette, die Matrix-Punkte,
 * Listen-Chips und das ROAM-Board benutzen. Sie ist bewusst kuehl gehalten und
 * damit disjunkt von der warmen Exposure-Skala: eine Farbe steht eindeutig fuer
 * die **Einordnung**, die andere fuer die **Kritikalitaet**.
 */
export function RoamAxes() {
  return (
    <div className="divide-y overflow-hidden rounded-lg bg-card shadow-card">
      {ROAM_STATUSES.map((s) => (
        <div key={s} className="flex gap-3 p-4">
          <span aria-hidden className={`mt-[7px] size-2.5 shrink-0 rounded-full ${ROAM_DOT[s]}`} />
          <div className="space-y-0.5">
            <p className="text-sm font-medium text-foreground">
              {ROAM_LABELS[s]}{" "}
              <code className="font-mono text-meta font-normal text-muted-foreground">{s}</code>
            </p>
            <p className="max-w-[var(--reading-max-w)] text-sm leading-relaxed text-muted-foreground">
              {MEANING[s]}
            </p>
          </div>
        </div>
      ))}
    </div>
  );
}
