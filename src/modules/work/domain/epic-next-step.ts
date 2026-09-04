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
  | { kind: "link"; label: string; href: string }
  /**
   * Der Reifegrad-Wechsel wird beantragt, nicht direkt vollzogen — die Seite
   * rendert dafür die Gate-Karte. Früher stand hier `impact-confirm` für einen
   * eigenen L4→L5-Dialog; dieser Sonderweg ist im Antragsmodell aufgegangen.
   */
  | { kind: "gate-request"; to: GateStep };

export interface EpicNextStep {
  title: string;
  hint: string;
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
      title: `Auf die Abnahme von ${openGateRequestTo} warten`,
      hint: "Der Reifegrad-Wechsel ist beantragt. Die benannten Personen entscheiden als Nächstes; bis dahin sind die zugehörigen Inhalte gesperrt.",
      cta: { kind: "link", label: "Zu meinen Freigaben", href: "/my-approvals" },
    };
  }

  if (stageGate === "L0") {
    if (!hasHypothesis) {
      return {
        title: "Benefit Hypothese ausarbeiten",
        hint: "Beschreibe im Hypothese-Tab Problem, Zielgruppe, erwarteten Nutzen und Leading Indicators — damit die Abnehmer eine Entscheidungsgrundlage haben.",
        cta: { kind: "link", label: "Zur Hypothese", href: tab("benefit-hypothesis") },
      };
    }
    return {
      title: "Wechsel auf L1 beantragen",
      hint: "Inhalte sind da. Beantrage den Reifegrad-Wechsel auf L1 — seine Abnahme ist zugleich die Freigabe der Benefit-Hypothese.",
      cta: { kind: "gate-request", to: "L1" },
    };
  }

  if (stageGate === "L1") {
    // L1 ist die Vorstufe der Analyse: der Eintritt in L2 ist ein eigener
    // Antrag, der Business Case wird dort ausgearbeitet.
    return {
      title: "Wechsel auf L2 beantragen",
      hint: hasBusinessCase
        ? "Die Hypothese ist freigegeben und der Business Case ist begonnen. Beantrage den Wechsel auf L2, um in die Analyse einzutreten."
        : "Die Hypothese ist freigegeben. Beantrage den Wechsel auf L2 — dort wird der Business Case ausgearbeitet.",
      cta: { kind: "gate-request", to: "L2" },
    };
  }

  if (stageGate === "L2") {
    // Auf L2 zu stehen *ist* „Business Case in Arbeit" — kein Sub-Stage-Split mehr.
    if (hasBusinessCase) {
      return {
        title: "Wechsel auf L3.1 beantragen",
        hint: "Inhalte sind da. Beantrage den Wechsel auf L3.1 — die Abnahme durch die fünf Parteien ist die Freigabe des Business Case.",
        cta: { kind: "gate-request", to: "L3.1" },
      };
    }
    return {
      title: "Business Case ausarbeiten",
      hint: "Detailliere den Business Case (Kosten, Nutzen, Annahmen, Risiken), bevor du ihn zur Freigabe einreichst.",
      cta: { kind: "link", label: "Zum Business Case", href: tab("business-case") },
    };
  }

  if (stageGate === "L3") {
    // Zwei Stationen: erst Budget holen und die Investition abnehmen lassen
    // (L3.2), dann die Umsetzung starten.
    if (subStage === "L3.1") {
      return budgetAllocated
        ? {
            title: "Investition abnehmen lassen",
            hint: "Budget ist alloziert. Beantrage den Schritt auf L3.2 — damit ist die Investitionsentscheidung namentlich abgenommen.",
            cta: { kind: "gate-request", to: "L3.2" },
          }
        : {
            title: "Budget allozieren",
            hint: "Business Case ist freigegeben. Plane jetzt im Controlling Budget für dieses Epic ein, damit die Investition abgenommen werden kann.",
            cta: { kind: "link", label: "Zum Controlling", href: "/budgeting/periods" },
          };
    }
    return {
      title: "Erstes Feature starten",
      hint: "Die Investition ist abgenommen. Lege in den Deliverables Features an und starte das erste in einem PI — das Epic rückt damit auf L4.",
      cta: { kind: "link", label: "Zu den Deliverables", href: tab("breakdown") },
    };
  }

  if (stageGate === "L4") {
    const { total, completed } = childFeatureStats;
    // Drei Stationen innerhalb von L4: Features abschließen → Umsetzung
    // bestätigen lassen (L4.2) → Impact bestätigen lassen (L5). Die mittlere
    // ist ein eigener Antrag: „fertig gebaut" ist nicht „Nutzen nachgewiesen".
    if (subStage === "L4.2") {
      return {
        title: "Impact bestätigen lassen",
        hint: "Die Umsetzung ist als abgeschlossen bestätigt. Beantrage den Wechsel auf L5 — das Controlling nimmt ab, dass der prognostizierte Nutzen auf der Balance-Sheet bzw. an den KPIs angekommen ist.",
        cta: { kind: "gate-request", to: "L5" },
      };
    }
    if (total > 0 && completed === total) {
      return {
        title: "Umsetzung bestätigen lassen",
        hint: "Alle Features sind abgeschlossen. Beantrage den Schritt auf L4.2 — damit wird die fertige Umsetzung abgenommen und das Ist-Datum gesetzt.",
        cta: { kind: "gate-request", to: "L4.2" },
      };
    }
    return {
      title:
        total > 0 ? `Features abschließen (${completed}/${total})` : "Features anlegen und starten",
      hint:
        total > 0
          ? "Die Implementierung läuft. Schließe die restlichen Features ab — danach lässt sich die fertige Umsetzung (L4.2) bestätigen."
          : "Es sind noch keine Child-Features am Epic. Lege in den Deliverables welche an und starte sie.",
      cta: { kind: "link", label: "Zu den Deliverables", href: tab("breakdown") },
    };
  }

  // Defensive fallback (sollte für L0..L5 nicht erreicht werden).
  return null;
}
