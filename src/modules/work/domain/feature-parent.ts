/**
 * **Ein Feature einem Epic zuordnen — oder daraus lösen.**
 *
 * Bis hierhin gab es für Features überhaupt keinen Umhäng-Pfad: `parentId`
 * wurde beim Anlegen geschrieben und nie wieder. Sobald ein Feature
 * eigenständig bestehen darf, wäre die Wahl beim Anlegen sonst unumkehrbar —
 * ein Fehlgriff liesse sich nur durch Löschen und Neuanlegen korrigieren, und
 * dabei gingen Abhängigkeiten, PI, WSJF und der Verlauf verloren.
 *
 * **Nicht** nach `goal-reparent.ts` modelliert. Das plant Teilbaum-Arithmetik
 * für einen beliebig tiefen Baum — Pfad-Präfixe umschreiben, Ebenen
 * verschieben, Themen erben. Ein Feature ist ein **Blatt in fester Tiefe**:
 * `PARENT_LEVEL` kennt nur `EPIC → null` und `FEATURE → EPIC`. Der ganze Plan
 * sind zwei Skalare, und eine Zyklusprüfung braucht es nicht — ein Feature hat
 * keine Nachkommen.
 *
 * Rein, kein I/O.
 */

import { ok, err, type Result } from "@/modules/core/kernel/domain/errors";
import { derivedInitiativePath } from "@/modules/core/kernel/domain/initiative-path";

export interface FeatureReparentInput {
  /** Das Feature selbst — seine Id ist zugleich sein Pfadsegment. */
  featureId: string;
  /**
   * Wertstrom des besitzenden ARTs. **Nicht nullable**: `Art.valueStreamId` ist
   * NOT NULL, ein Feature hat immer ein ART, und ohne diesen Wert liesse sich
   * die Zugehörigkeit nicht prüfen.
   */
  artValueStreamId: string;
  /**
   * Das neue Eltern-Epic — `null` bedeutet **lösen**, das Feature wird
   * eigenständig.
   */
  newParent: { id: string; path: string; valueStreamId: string | null } | null;
}

export interface FeatureReparentPlan {
  parentId: string | null;
  path: string;
}

/**
 * **Lösen ist immer erlaubt.** Ein Feature aus seinem Epic zu nehmen nimmt
 * niemandem etwas weg — es senkt allenfalls die Tor-Reife jenes Epics, und das
 * ist richtig so: die Zählung folgt der Wirklichkeit, und die Tor-Abnahme ist
 * ohnehin namentlich (ADR-0018).
 *
 * **Zuordnen verlangt denselben Wertstrom.** Ein Feature gehört zu genau einem
 * ART, ein ART zu genau einem Wertstrom, ein Epic ebenso — ein Epic aus einem
 * fremden Wertstrom darf es deshalb nicht aufnehmen. Dieselbe Regel, die beim
 * Anlegen gilt.
 *
 * Ein Epic **ohne** Wertstrom (Altbestand) wird durchgelassen; das tut die
 * Anlege-Prüfung im Feature-Service seit jeher ebenso.
 */
export function planFeatureReparent(input: FeatureReparentInput): Result<FeatureReparentPlan> {
  const { featureId, artValueStreamId, newParent } = input;

  if (newParent === null) {
    return ok({ parentId: null, path: derivedInitiativePath(null, featureId) });
  }

  if (newParent.valueStreamId !== null && newParent.valueStreamId !== artValueStreamId) {
    return err({
      kind: "conflict" as const,
      reason: "work.errors.epicOtherValueStream",
    });
  }

  return ok({
    parentId: newParent.id,
    path: derivedInitiativePath(newParent.path, featureId),
  });
}
