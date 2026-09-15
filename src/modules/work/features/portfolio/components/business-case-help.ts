import type { BusinessCaseFields } from "@/modules/work/domain/business-case";

/**
 * **Wonach der Lean Business Case eigentlich fragt.**
 *
 * Die Felder tragen SAFe-Vokabular als Beschriftung — „What you need to
 * believe in" sagt einem Erstautor nichts. Die Benefit-Hypothese nebenan
 * erklärt ihre Felder seit jeher im Platzhalter; hier stand bis dahin nichts.
 *
 * Zwei Texte je Feld, weil sie Verschiedenes leisten:
 *
 * - `question` — die Frage, die das Feld beantwortet. Sie steht im ⓘ neben der
 *   Beschriftung und bleibt abrufbar, **auch wenn das Feld schon gefüllt ist**
 *   und auch für den Abnehmer in der Nur-Lese-Ansicht.
 * - `placeholder` — eine Beispielformulierung im leeren Feld. Sie zeigt die
 *   erwartete *Form*, nicht den Inhalt, und verschwindet beim ersten Zeichen.
 *
 * Beides steht hier zusammen und nicht verstreut im JSX: so lässt es sich am
 * Stück lesen, fachlich prüfen und später übersetzen.
 */
export interface FieldHelp {
  /** Die Frage hinter dem ⓘ. */
  question: string;
  /** Die Beispielformulierung im leeren Feld. */
  placeholder: string;
}

/**
 * Alle Freitextfelder des Business Case — **aus der Domäne abgeleitet**, nicht
 * von Hand aufgezählt. Wer dort ein Textfeld ergänzt, bekommt hier einen
 * Compiler-Fehler, bis jemand gesagt hat, wonach es fragt.
 */
type TextField = {
  [K in keyof BusinessCaseFields]-?: NonNullable<BusinessCaseFields[K]> extends string ? K : never;
}[keyof BusinessCaseFields];

/**
 * `leadingIndicators` ist ausgenommen: das Feld wird nicht mehr getippt. Es
 * zeigt die Namen der erfassten KPIs und verweist zum Pflegen in den Reiter
 * „KPI & Nutzen" — eine Ausfüllhilfe hätte dort keinen Adressaten.
 */
export type HelpedBusinessCaseField = Exclude<TextField, "leadingIndicators">;

export const BUSINESS_CASE_FIELD_HELP: Record<HelpedBusinessCaseField, FieldHelp> = {
  keyStakeholders: {
    question:
      "Wer muss dieses Vorhaben mittragen — und wer ist davon betroffen, ohne es zu beauftragen?",
    placeholder: "Rollen und Namen, z. B. Leitung Logistik (Auftraggeber), IT-Security (Freigabe)",
  },
  initiativeDescription: {
    question: "Was wird gebaut oder verändert? In wenigen Sätzen, ohne Lösungstechnik.",
    placeholder: "Worum es geht — so knapp, dass es jemand ohne Vorwissen versteht",
  },
  businessOutcomeHypothesis: {
    question:
      "Welches geschäftliche Ergebnis erwarten wir, und woran erkennen wir, dass es eingetreten ist?",
    placeholder: "Wenn wir X tun, erwarten wir Y — messbar an Z",
  },
  inScope: {
    question: "Was gehört ausdrücklich zu diesem Epic?",
    placeholder: "Was dieses Epic liefert — eine Zeile je Punkt",
  },
  outOfScope: {
    question: "Was bleibt bewusst draußen? Diese Liste erspart den Streit im vierten Monat.",
    placeholder: "Was nicht dazugehört — und wohin es stattdessen gehört",
  },
  whatYouNeedToBelieve: {
    question: "Welche Annahmen müssen zutreffen, damit die Rechnung aufgeht?",
    placeholder: "Annahmen, die den Business Case tragen, z. B. „Die Mengen bleiben stabil“",
  },
  customersAffected: {
    question: "Welche internen oder externen Kunden merken etwas — und was genau merken sie?",
    placeholder: "Wer die Veränderung merkt, und woran",
  },
  impactOnSolutions: {
    question: "Was verändert sich an bestehenden Solutions, Programmen und Services?",
    placeholder: "Betroffene Systeme und Schnittstellen — und die Art der Auswirkung",
  },
  analysisSummary: {
    question: "Was ist die Empfehlung an die Abnehmer, und worauf stützt sie sich?",
    placeholder: "Die Empfehlung in wenigen Sätzen: Was sollen die Abnehmer entscheiden, und warum",
  },
};
