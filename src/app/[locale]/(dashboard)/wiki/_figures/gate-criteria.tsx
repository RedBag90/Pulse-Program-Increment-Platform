import { GATE_CRITERIA_DOC } from "@/modules/work/domain/epic-lifecycle-doc";
import { gateStepNumber } from "@/modules/work/domain/stage-gate";

/**
 * **Was Pulse vor jedem Antrag prueft** — blockierend oder beratend, samt dem
 * Hilfetext, der an jedem Kriterium haengt.
 *
 * Dieser Hilfetext ist der Grund, warum die Figur mehr kann als die Tabelle im
 * Ausgangsdokument: er ist kontextfrei in Nutzersprache geschrieben, stand
 * schon immer an jeder Regel und war bis September 2026 an genau einer Flaeche
 * sichtbar. Hier kostet er nichts und macht aus einer Aufzaehlung eine
 * Erklaerung — **ohne ein einziges dupliziertes Wort**.
 */
export function GateCriteria() {
  return (
    <div className="divide-y overflow-hidden rounded-lg border bg-card">
      {GATE_CRITERIA_DOC.map((doc) => (
        <div key={doc.stageTo} className="space-y-2.5 p-4">
          <p className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
            {gateStepNumber(doc.stageFrom)} <span aria-hidden>→</span>{" "}
            <span className="text-foreground">{gateStepNumber(doc.stageTo)}</span>
          </p>
          {doc.criteria.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">Kein eigenes Kriterium.</p>
          ) : (
            <ul className="space-y-2.5">
              {doc.criteria.map((c) => (
                <li key={c.label} className="space-y-0.5">
                  <p className="text-[14px] leading-snug text-foreground">
                    {c.label}{" "}
                    <span
                      className={
                        c.blocking
                          ? "ml-1 rounded border border-amber-500/50 bg-amber-500/10 px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-amber-900 dark:text-amber-200"
                          : "ml-1 rounded border bg-muted px-1.5 py-0.5 font-mono text-[9.5px] uppercase tracking-wider text-muted-foreground"
                      }
                    >
                      {c.blocking ? "blockierend" : "beratend"}
                    </span>
                  </p>
                  <p className="max-w-[var(--reading-max-w)] text-[13px] leading-relaxed text-muted-foreground">
                    {c.help}
                  </p>
                </li>
              ))}
            </ul>
          )}
        </div>
      ))}
    </div>
  );
}
