/**
 * **Vorlagen für Betriebspositionen** — was ein Wertstrom üblicherweise
 * aufschreibt, wenn er seinen Bedarf für ein Halbjahr vorbereitet.
 *
 * Eine Vorlage ist ein **Vorschlag, kein Stammdatum**: deshalb eine benannte
 * Liste im Code und keine Tabelle. Niemand pflegt sie, niemand löscht sie
 * versehentlich, und sie lässt sich mit den Flächen zusammen ändern.
 *
 * **Gegliedert wie die Fläche** (`rtbAssignmentGroup`): die Vorlage sagt damit
 * zugleich, in welcher Gruppe die Position landen wird — und welche Zurechnung
 * das Formular verlangt.
 *
 * Der Name bleibt der **Rumpf** („Team-Kapazität"), ohne ⟨ART⟩ im Text: wem die
 * Position gehört, sagt die Gruppe und die Zurechnungsspalte. Ein Name, der die
 * Zuordnung noch einmal mitschleppt, läuft ihr auseinander, sobald jemand sie
 * ändert.
 *
 * Rein, kein I/O.
 */

import type { RtbAssignmentGroup } from "@/modules/budgeting/domain/rtb-art-resolution";
import type { RtbInterval } from "@/modules/budgeting/domain/rtb-interval";
import type { RtbKind } from "@/modules/budgeting/domain/rtb-kind";

export interface RtbTemplate {
  id: string;
  /** Der Positionsname, den die Vorlage vorschlägt. */
  label: string;
  group: RtbAssignmentGroup;
  kind: RtbKind;
  /** Die Periode folgt der **Entscheidungsfrequenz**, nicht der Zahlungsweise. */
  interval: RtbInterval;
  /**
   * Ein Vorbehalt, den die Fläche zeigen muss. Heute nur für die
   * Kapazitäts-Vorlagen — siehe unten.
   */
  caveat?: string;
}

/**
 * **Der Vorbehalt der Kapazität.**
 *
 * Team-Kapazität ist der größte Posten eines Wertstroms und finanziert genau
 * die Arbeit, die die Features hervorbringt. Als `run` geführt fällt sie nach
 * §2.6 der Konsolidierungs-Spec aber aus Deckung, Lücke und €-Satz — die Ampel
 * meldet dann „überbucht", während die Teams bezahlt sind.
 *
 * Eine dritte Art neben `run` und `art_change` wäre die saubere Antwort; sie
 * steht als offene Frage in `art-budget-process-layout.md` §9. Bis dahin sagt
 * die Vorlage, was sie tut — schweigend in diese Falle zu führen wäre
 * schlechter als gar keine Vorlage.
 */
const KAPAZITAET =
  "Zählt als Betrieb und damit nicht in Deckung, Lücke und €-Satz — obwohl dieses Geld die Teams bezahlt, die die Features bauen.";

/** Was das Formular an Zurechnung verlangt, damit die Position richtig landet. */
export const RTB_TEMPLATE_GROUP_HINTS: Record<RtbAssignmentGroup, string> = {
  stream: "Ohne ART und ohne Solution — wird gleichmässig auf die ARTs geschlüsselt.",
  art: "Braucht einen ART.",
  solution: "Braucht eine Solution; ihr ART entscheidet, wo das Geld landet.",
};

export const RTB_TEMPLATES: readonly RtbTemplate[] = [
  // — Wertstrom-übergreifend ————————————————————————————————————————————
  {
    id: "programm-office",
    label: "Programm-Office & Controlling",
    group: "stream",
    kind: "run",
    interval: "half_yearly",
  },
  {
    id: "werkzeuge",
    label: "Werkzeuge & Plattform",
    group: "stream",
    kind: "run",
    interval: "yearly",
  },
  {
    id: "enablement",
    label: "Enablement & Schulung",
    group: "stream",
    kind: "run",
    interval: "yearly",
  },
  {
    id: "beratung",
    label: "Externe Beratung",
    group: "stream",
    kind: "run",
    interval: "yearly",
  },

  // — ART-übergreifend ——————————————————————————————————————————————————
  {
    id: "team-kapazitaet",
    label: "Team-Kapazität",
    group: "art",
    kind: "run",
    interval: "yearly",
    caveat: KAPAZITAET,
  },
  {
    id: "art-rollen",
    label: "ART-Rollen (RTE, Product Management, Architekt)",
    group: "art",
    kind: "run",
    interval: "yearly",
    caveat: KAPAZITAET,
  },
  {
    id: "system-team",
    label: "System Team",
    group: "art",
    kind: "run",
    interval: "yearly",
    caveat: KAPAZITAET,
  },
  {
    id: "art-rahmen",
    label: "ART-Rahmen",
    group: "art",
    kind: "art_change",
    // Je Halbjahr, weil genau so oft darüber entschieden wird — in der Kachel.
    interval: "half_yearly",
  },

  // — Solution-individuell ——————————————————————————————————————————————
  {
    id: "betrieb-support",
    label: "Betrieb & Support",
    group: "solution",
    kind: "run",
    interval: "yearly",
  },
  {
    id: "infrastruktur",
    label: "Infrastruktur & Hosting",
    group: "solution",
    kind: "run",
    interval: "yearly",
  },
  {
    id: "lizenzen",
    label: "Lizenzen & Wartung",
    group: "solution",
    kind: "run",
    interval: "yearly",
  },
  {
    id: "compliance",
    label: "Compliance & Sicherheit",
    group: "solution",
    kind: "run",
    interval: "yearly",
  },
];

/** Die Vorlagen einer Gruppe, in der Reihenfolge der Liste. */
export function templatesOfGroup(group: RtbAssignmentGroup): RtbTemplate[] {
  return RTB_TEMPLATES.filter((t) => t.group === group);
}

export function templateById(id: string): RtbTemplate | null {
  return RTB_TEMPLATES.find((t) => t.id === id) ?? null;
}
