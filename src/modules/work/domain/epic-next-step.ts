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
import type { SubStage } from "@/modules/work/domain/stage-gate";

export type EpicNextStepCta =
  | { kind: "link"; label: string; href: string }
  /**
   * Der Reifegrad-Wechsel wird beantragt, nicht direkt vollzogen — die Seite
   * rendert dafür die Gate-Karte. Früher stand hier `impact-confirm` für einen
   * eigenen L4→L5-Dialog; dieser Sonderweg ist im Antragsmodell aufgegangen.
   */
  | { kind: "gate-request"; to: StageGate };

export interface EpicNextStep {
  title: string;
  hint: string;
  cta?: EpicNextStepCta;
}

export interface EpicNextStepInput {
  epicId: string;
  stageGate: StageGate;
  subStage: SubStage | null;
  /** Approval-Phase, falls Multi-Party-Approval aktiv ist; sonst null. */
  approvalPhase: string | null;
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
    approvalPhase,
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

  if (stageGate === "L0") {
    if (approvalPhase === "hypothesis_review") {
      return {
        title: "Auf Portfolio-Manager-Entscheidung warten",
        hint: "Der Portfolio Manager entscheidet als Nächstes über die Benefit-Hypothese. Solange das nicht passiert ist, bleibt das Epic auf L0.",
        cta: { kind: "link", label: "Zu meinen Freigaben", href: "/my-approvals" },
      };
    }
    if (!hasHypothesis) {
      return {
        title: "Benefit Hypothese ausarbeiten",
        hint: "Beschreibe im Hypothese-Tab Problem, Zielgruppe, erwarteten Nutzen und Leading Indicators — damit der Portfolio Manager eine Entscheidungsgrundlage hat.",
        cta: { kind: "link", label: "Zur Hypothese", href: tab("benefit-hypothesis") },
      };
    }
    return {
      title: "Hypothese zur Entscheidung einreichen",
      hint: "Inhalte sind da. Reiche die Hypothese im Hypothese-Tab zur Portfolio-Manager-Entscheidung ein.",
      cta: { kind: "link", label: "Zur Hypothese", href: tab("benefit-hypothesis") },
    };
  }

  if (stageGate === "L1") {
    // Defensive: Bestands-Epics, bei denen L1 -> L2 nicht ausgeloest wurde
    // (Trigger erst seit dem Fix in saveBusinessCase/submitBusinessCase),
    // koennen approvalPhase business_case/stakeholder_review/approved
    // haben — also faktisch im L2.x-Workflow stehen. Wir spiegeln das in
    // der Empfehlung, damit der Helfer korrekt fuehrt.
    if (approvalPhase === "stakeholder_review") {
      return {
        title: "Auf Stakeholder-Freigabe warten",
        hint: "Der Business Case ist eingereicht. Die zugewiesenen Approver entscheiden als Naechstes.",
        cta: { kind: "link", label: "Zu den Freigaben", href: tab("timeline") },
      };
    }
    if (approvalPhase === "approved") {
      return {
        title: "Budget allozieren",
        hint: "Business Case ist freigegeben. Plane jetzt im Controlling Budget fuer dieses Epic ein, damit es auf L3 weiterzieht.",
        cta: { kind: "link", label: "Zum Controlling", href: "/budgeting" },
      };
    }
    if (hasBusinessCase) {
      return {
        title: "Business Case einreichen",
        hint: "Inhalte sind da. Reiche den Business Case im BC-Tab zur Stakeholder-Freigabe ein.",
        cta: { kind: "link", label: "Zum Business Case", href: tab("business-case") },
      };
    }
    return {
      title: "Business Case ausarbeiten",
      hint: "Die Hypothese ist angenommen. Detailliere jetzt den Business Case (Kosten, Nutzen, Annahmen, Risiken).",
      cta: { kind: "link", label: "Zum Business Case", href: tab("business-case") },
    };
  }

  if (stageGate === "L2") {
    // L2.2 = BC freigegeben (siehe subStageFor): Budget fehlt noch
    if (subStage === "L2.2") {
      return {
        title: "Budget allozieren",
        hint: "Business Case ist freigegeben. Plane jetzt im Controlling Budget für dieses Epic ein, damit es auf L3 weiterzieht.",
        cta: { kind: "link", label: "Zum Controlling", href: "/budgeting" },
      };
    }
    // L2.1 = BC in Arbeit
    if (approvalPhase === "stakeholder_review") {
      return {
        title: "Auf Stakeholder-Freigabe warten",
        hint: "Die zugewiesenen Approver entscheiden als Nächstes über den Business Case.",
        cta: { kind: "link", label: "Zu den Freigaben", href: tab("timeline") },
      };
    }
    if (hasBusinessCase) {
      return {
        title: "Business Case einreichen",
        hint: "Inhalte sind da. Reiche den Business Case im BC-Tab zur Stakeholder-Freigabe ein.",
        cta: { kind: "link", label: "Zum Business Case", href: tab("business-case") },
      };
    }
    return {
      title: "Business Case ausarbeiten",
      hint: "Detailliere den Business Case (Kosten, Nutzen, Annahmen, Risiken), bevor du ihn zur Freigabe einreichst.",
      cta: { kind: "link", label: "Zum Business Case", href: tab("business-case") },
    };
  }

  if (stageGate === "L3") {
    return {
      title: "Erstes Feature starten",
      hint: budgetAllocated
        ? "Budget ist alloziert. Lege in den Deliverables Features an und starte das erste in einem PI — das Epic rückt damit auf L4."
        : "Lege in den Deliverables Features an und starte das erste in einem PI — das Epic rückt damit auf L4.",
      cta: { kind: "link", label: "Zu den Deliverables", href: tab("breakdown") },
    };
  }

  if (stageGate === "L4") {
    const { total, completed } = childFeatureStats;
    if (subStage === "L4.2" || (total > 0 && completed === total)) {
      return {
        title: "Impact bestätigen lassen",
        hint: "Alle Features sind abgeschlossen. Beantrage den Wechsel auf L5 — das Controlling nimmt ab, dass der prognostizierte Nutzen auf der Balance-Sheet bzw. an den KPIs angekommen ist.",
        cta: { kind: "gate-request", to: "L5" },
      };
    }
    return {
      title:
        total > 0 ? `Features abschließen (${completed}/${total})` : "Features anlegen und starten",
      hint:
        total > 0
          ? "Die Implementierung läuft. Schließe die restlichen Features ab — sobald alle abgeschlossen sind, kann das Controlling den Impact bestätigen."
          : "Es sind noch keine Child-Features am Epic. Lege in den Deliverables welche an und starte sie.",
      cta: { kind: "link", label: "Zu den Deliverables", href: tab("breakdown") },
    };
  }

  // Defensive fallback (sollte für L0..L5 nicht erreicht werden).
  return null;
}
