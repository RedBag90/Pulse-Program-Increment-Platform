/**
 * Nächster-Schritt-Helfer für die Epic-Detail-Seite. Reine Funktion: kombiniert
 * den Reifegrad-Zustand (Stage Gate + Sub-Step + Approval-Phase) mit
 * Inhalts-Prädikaten und Child-Feature-Status zu einer Empfehlung, was als
 * Nächstes zu tun ist, damit das Epic das nächste Stage Gate erreicht.
 *
 * Quelle der Logik: Stage-Gate-Modell v2 (siehe Plan-Datei). Render-Schicht
 * liegt im `EpicReifegradActivityBar`.
 */

import type { StageGate } from "@/modules/core/kernel/domain/types";
import type { GateStep } from "@/modules/work/domain/stage-gate";
import type { SubStage } from "@/modules/work/domain/stage-gate";

export type EpicNextStepCta =
  | { kind: "link"; labelKey: string; href: string }
  /**
   * Der Reifegrad-Wechsel wird beantragt, nicht direkt vollzogen — die Seite
   * rendert dafür die Gate-Karte. Früher stand hier `impact-confirm` für einen
   * eigenen L4→L5-Dialog; dieser Sonderweg ist im Antragsmodell aufgegangen.
   */
  | { kind: "gate-request"; to: GateStep };

export interface EpicNextStep {
  titleKey: string;
  /** Platzhalter des Titels, wo er welche hat (nur „Features abschliessen"). */
  titleValues?: Record<string, string | number>;
  hintKey: string;
  cta?: EpicNextStepCta;
}

export interface EpicNextStepInput {
  epicId: string;
  stageGate: StageGate;
  subStage: SubStage | null;
  /**
   * Ziel des offenen Reifegrad-Antrags, oder null. Steht einer offen, ist der
   * nächste Schritt immer „warten" — die inhaltlichen Freigaben sind in die
   * Reifegrad-Abnahmen aufgegangen, es gibt keinen zweiten Vorgang daneben.
   */
  openGateRequestTo: GateStep | null;
  /** Sind Inhalte in der Benefit-Hypothese vorhanden? */
  hasHypothesis: boolean;
  /** Sind Inhalte im Business Case vorhanden? */
  hasBusinessCase: boolean;
  /** Wurde Budget alloziert (Σ Allokationen > 0)? */
  budgetAllocated: boolean;
  /**
   * Ist das Budget-Modul freigeschaltet? Aus ⇒ es gibt nichts zu allozieren,
   * und der Rat „Budget allozieren" verwiese auf eine gesperrte Fläche. Der
   * Schritt L3 ruht dann allein auf der Abnahme.
   */
  budgetingEnabled: boolean;
  /**
   * Stempel der abgenommenen Analyse-Entscheidung. Auf L1 trennt er die beiden
   * Stationen: davor ist der naechste Schritt „zur Analyse auswaehlen lassen",
   * danach „Business Case ausarbeiten".
   */
  selectedForAnalyzingAt: Date | null;
  /** Wurde Impact bestätigt? Falls ja: L5-Endstand. */
  impactRecognizedAt: Date | null;
  childFeatureStats: { total: number; completed: number };
}

/**
 * Liefert den Helfer-Text oder `null`, wenn das Epic bereits L5 erreicht hat
 * (Endstand, kein Nächster-Schritt mehr).
 */
export function epicNextStep(input: EpicNextStepInput): EpicNextStep | null {
  const {
    epicId,
    stageGate,
    subStage,
    openGateRequestTo,
    hasHypothesis,
    hasBusinessCase,
    budgetAllocated,
    budgetingEnabled,
    selectedForAnalyzingAt,
    impactRecognizedAt,
    childFeatureStats,
  } = input;

  const tab = (key: string) => `/portfolio/epics/${epicId}?tab=${key}`;

  if (impactRecognizedAt != null || stageGate === "L5") {
    return null;
  }

  // Ein offener Antrag schlägt jeden inhaltlichen Rat: es liegt bei den
  // Abnehmern, nicht mehr beim Epic.
  if (openGateRequestTo != null) {
    return {
      titleKey: "work.nextStep.waitingTitle",
      titleValues: { gate: openGateRequestTo },
      hintKey: "work.nextStep.waitingHint",
      cta: { kind: "link", labelKey: "work.nextStep.toMyApprovals", href: "/my-approvals" },
    };
  }

  if (stageGate === "L0") {
    if (!hasHypothesis) {
      return {
        titleKey: "work.nextStep.hypothesisTitle",
        hintKey: "work.nextStep.hypothesisHint",
        cta: {
          kind: "link",
          labelKey: "work.nextStep.toHypothesis",
          href: tab("benefit-hypothesis"),
        },
      };
    }
    return {
      titleKey: "work.nextStep.requestL1Title",
      hintKey: "work.nextStep.requestL1Hint",
      cta: { kind: "gate-request", to: "L1" },
    };
  }

  if (stageGate === "L1") {
    // **Zwei Stationen auf einem Reifegrad.** „Zur Analyse ausgewählt" bewegt
    // ihn nicht — davor wird die Entscheidung beantragt, danach der Business
    // Case ausgearbeitet und freigegeben.
    if (selectedForAnalyzingAt == null) {
      return {
        titleKey: "work.nextStep.analysisTitle",
        hintKey: "work.nextStep.analysisHint",
        cta: { kind: "gate-request", to: "analysis" },
      };
    }
    if (hasBusinessCase) {
      return {
        titleKey: "work.nextStep.requestL2Title",
        hintKey: "work.nextStep.requestL2Hint",
        cta: { kind: "gate-request", to: "L2" },
      };
    }
    return {
      titleKey: "work.nextStep.businessCaseTitle",
      hintKey: "work.nextStep.businessCaseHint",
      cta: { kind: "link", labelKey: "work.nextStep.toBusinessCase", href: tab("business-case") },
    };
  }

  if (stageGate === "L2") {
    // Ohne Budget-Modul gibt es keine Vorbedingung mehr: der Schritt hängt
    // allein an der Unterschrift von VMO und Finance.
    return budgetAllocated || !budgetingEnabled
      ? {
          titleKey: "work.nextStep.investmentTitle",
          hintKey: budgetingEnabled
            ? "work.nextStep.investmentHintBudgeting"
            : "work.nextStep.investmentHintPlain",
          cta: { kind: "gate-request", to: "L3" },
        }
      : {
          titleKey: "work.nextStep.allocateTitle",
          hintKey: "work.nextStep.allocateHint",
          cta: {
            kind: "link",
            labelKey: "work.nextStep.toControlling",
            href: "/budgeting/periods",
          },
        };
  }

  if (stageGate === "L3") {
    return {
      titleKey: "work.nextStep.firstFeatureTitle",
      hintKey: "work.nextStep.firstFeatureHint",
      cta: { kind: "link", labelKey: "work.nextStep.toDeliverables", href: tab("breakdown") },
    };
  }

  if (stageGate === "L4") {
    const { total, completed } = childFeatureStats;
    // Drei Stationen innerhalb von L4: Features abschließen → Umsetzung
    // bestätigen lassen (L4.2) → Impact bestätigen lassen (L5). Die mittlere
    // ist ein eigener Antrag: „fertig gebaut" ist nicht „Nutzen nachgewiesen".
    if (subStage === "L4.2") {
      return {
        titleKey: "work.nextStep.impactTitle",
        hintKey: "work.nextStep.impactHint",
        cta: { kind: "gate-request", to: "L5" },
      };
    }
    if (total > 0 && completed === total) {
      return {
        titleKey: "work.nextStep.confirmTitle",
        hintKey: "work.nextStep.confirmHint",
        cta: { kind: "gate-request", to: "L4.2" },
      };
    }
    return {
      titleKey:
        total > 0 ? "work.nextStep.finishFeaturesTitle" : "work.nextStep.createFeaturesTitle",
      ...(total > 0 ? { titleValues: { completed, total } } : {}),
      hintKey: total > 0 ? "work.nextStep.finishFeaturesHint" : "work.nextStep.createFeaturesHint",
      cta: { kind: "link", labelKey: "work.nextStep.toDeliverables", href: tab("breakdown") },
    };
  }

  // Defensive fallback (sollte für L0..L5 nicht erreicht werden).
  return null;
}
