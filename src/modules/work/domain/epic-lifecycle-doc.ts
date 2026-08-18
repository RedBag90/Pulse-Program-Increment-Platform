import type { StageGate } from "@/modules/core/kernel/domain/types";
import { STAGE_GATES, type SubStage } from "@/modules/work/domain/stage-gate";
import {
  GATE_CRITERIA,
  nextGate,
  type CriterionLabelContext,
} from "@/modules/work/domain/gate-readiness";

/**
 * Doku des Epic-Lebenszyklus für das Help-Popover an der Reifegrad-Bar.
 *
 * Diese Datei hatte früher eine **Parallelliste** der Auto-Advance-Trigger:
 * `LIFECYCLE_TRIGGERS` beschrieb in Prosa, was `TRIGGER_RULES` in Code tat, und
 * der eigene Header warnte davor, dass beides auseinanderläuft ("drift fliegt im
 * Code-Review auf" — was voraussetzt, dass jemand hinsieht). Genau das war
 * passiert: die Labels verwiesen noch auf ein `autoAdvanceStageGate`, das es
 * längst nicht mehr gab.
 *
 * Jetzt wird die Trigger-Tabelle aus {@link GATE_CRITERIA} **abgeleitet**. Ein
 * neues Kriterium erscheint automatisch im Popover; eine Parallelliste, die
 * veralten könnte, gibt es nicht mehr. Nur die Sub-Stage-Regeln bleiben
 * handgeschriebene Daten — sie beschreiben `subStageFor`, das keine
 * gemeinsame Struktur mit den Kriterien hat.
 */

/** Was ein Reifegrad-Wechsel inhaltlich voraussetzt — abgeleitet, nicht gepflegt. */
export interface GateCriteriaDoc {
  stageFrom: StageGate;
  stageTo: StageGate;
  /** Die Kriterien in Nutzersprache, mit Kennzeichnung „blockierend". */
  criteria: { label: string; blocking: boolean }[];
}

/** Ableitungsregel fuer eine Sub-Stage. */
export interface SubStageRule {
  gate: "L2" | "L4";
  key: SubStage;
  label: string;
  /** Text-Form der Bedingung — fuer Anzeige im Popover. */
  condition: string;
}

// ---------------------------------------------------------------------------
// Daten
// ---------------------------------------------------------------------------

/**
 * Für die Doku brauchen wir die Kriterien-Labels ohne Epic-Zustand. Die
 * Label-Funktionen dürfen von den Fakten abhängen (die Hypothese heisst bei
 * eingeschalteter Mehrparteien-Freigabe „freigegeben", sonst „ausgearbeitet") —
 * das Popover zeigt die Mehrparteien-Lesart, weil das der Normalfall ist.
 */
const DOC_LABEL_CONTEXT: CriterionLabelContext = { multiPartyApproval: true };

export const GATE_CRITERIA_DOC: readonly GateCriteriaDoc[] = STAGE_GATES.flatMap((from) => {
  const to = nextGate(from);
  if (!to) return [];
  const rules = GATE_CRITERIA[to] ?? [];
  return [
    {
      stageFrom: from,
      stageTo: to,
      criteria: rules.map((r) => ({
        label: r.label(DOC_LABEL_CONTEXT),
        blocking: r.blocking,
      })),
    },
  ];
});

export const SUB_STAGE_RULES: readonly SubStageRule[] = [
  {
    gate: "L2",
    key: "L2.1",
    label: "BC in Arbeit",
    condition: "businessCase != null && businessCaseApprovedAt == null",
  },
  {
    gate: "L2",
    key: "L2.2",
    label: "BC freigegeben",
    condition: "businessCaseApprovedAt != null",
  },
  {
    gate: "L4",
    key: "L4.1",
    label: "Umsetzung laeuft",
    condition: "completed < total (oder total == 0)",
  },
  {
    gate: "L4",
    key: "L4.2",
    label: "Umsetzung fertig",
    condition: "total > 0 && completed == total",
  },
];
