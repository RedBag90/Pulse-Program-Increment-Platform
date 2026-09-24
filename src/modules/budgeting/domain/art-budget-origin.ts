/**
 * **Woher kommt das Geld, das in diesem Halbjahr an diesem ART landet?**
 *
 * Die Frage klingt nach einer Summe, ist aber eine Herkunftsrechnung: dieselben
 * 484.927 € bedeuten etwas anderes, je nachdem, ob sie aus einer
 * Portfolio-Entscheidung stammen, aus dem eigenen Rahmen des ARTs oder aus
 * einem groben Schlüssel über die Betriebspositionen des Wertstroms. Sechs
 * Zeilen, zwei Gruppen — und die Gruppen sind der Punkt.
 *
 * **Veränderung und Betrieb dürfen nicht in eine Summe.** Veränderungsgeld
 * finanziert Vorhaben und geht in Deckung, Lücke und €-Satz ein; Betriebsgeld
 * bezahlt nie ein Feature (Konsolidierungs-Spec §2.6, REQ-10). Eine Tabelle
 * ohne diese Trennung lädt genau zu dem Fehler ein, den beide Specs verbieten.
 *
 * **Σ gesamt heisst „was dieses ART hat", nicht „was es ausgegeben hat".** Der
 * zugesprochene, aber noch nicht vergebene Rahmen zählt mit — er gehört dem
 * ART, er hängt nur an keinem Epic. Ohne diese Zeile unterschlüge die Summe
 * genau das Geld, über das der RTE noch entscheidet.
 *
 * Rein, kein I/O.
 */

import type { RtbByPath } from "@/modules/budgeting/domain/rtb-art-resolution";

export type OriginGroup = "change" | "operating";

export type OriginKey =
  | "portfolio"
  | "frameDistributed"
  | "frameOwnWork"
  | "frameOpen"
  | "operatingDirect"
  | "operatingViaSolution"
  | "operatingKeyed";

/**
 * **Zugesprochen oder erst beantragt** (REQ-8).
 *
 * Vor dem Aufteilen gibt es keine Zusprüche an den Positionen — dann steht der
 * geplante Betrag da und heisst auch so. Die Vorbelegung der Aufteil-Fläche ist
 * bewusst **keine** dritte Lage: sie ist ein Vorschlag in einem Formular, den
 * niemand entschieden hat, und als Herkunft eines Betrags eine Behauptung.
 */
export type OriginBasis = "awarded" | "planned";

export interface OriginRow {
  key: OriginKey;
  label: string;
  group: OriginGroup;
  /** Betrag **dieses** Halbjahres. */
  amount: number;
  /**
   * Jahresbetrag — nur für Betrieb, und immer der **geplante**: ein Zuspruch
   * gilt je Halbjahr, ihn zu verdoppeln wäre eine Hochrechnung. Für
   * Veränderungsgeld gibt es gar keinen: es wird je Halbjahr entschieden.
   */
  annual: number | null;
  /** Anteil an Σ gesamt, 0…1. Ohne Σ ist er 0 statt `NaN`. */
  share: number;
  basis: OriginBasis;
  /**
   * Eine Schätzung, keine Messung — der gleichmässige Schlüssel über die
   * ARTs des Stroms. Die Fläche kennzeichnet solche Zeilen, sonst hält jemand
   * sie für zugeordnet.
   */
  estimated: boolean;
}

export interface ArtBudgetOrigin {
  cycleKey: string;
  rows: OriginRow[];
  /** Σ Veränderung — dieselbe Grösse, gegen die Deckung und €-Satz rechnen. */
  changeTotal: number;
  /** Σ Betrieb — steht daneben, nie darin. */
  operatingTotal: number;
  total: number;
  /** Keine Zeile trägt einen Betrag: der Leerfall aus REQ-12. */
  isEmpty: boolean;
  /**
   * Die Überschrift der Betragsspalte. `mixed`, wenn Portfolio-Geld (immer
   * entschieden) neben unaufgeteiltem Betrieb steht — dann behauptet ein
   * einzelnes Wort über der Spalte etwas Falsches.
   */
  basis: OriginBasis | "mixed";
}

export const ORIGIN_GROUP_KEYS: Record<OriginGroup, string> = {
  change: "budgeting.originGroup.change",
  operating: "budgeting.originGroup.operating",
};

const LABELS: Record<OriginKey, string> = {
  portfolio: "Portfolio-Epics aus der Kachel",
  // **„ART-Rahmen", nicht „ART-Epic-Rahmen"** (§2.5 der Konsolidierungs-Spec,
  // und `RTB_KIND_KEYS.art_change`). Hier stand einmal das „Epic" mit drin —
  // und wurde spätestens neben der Zeile darunter zum Widerspruch: ein
  // ART-Epic-Rahmen, aus dem Arbeit **ohne** Epic bezahlt wird.
  frameDistributed: "ART-Rahmen · an ART-Epics",
  frameOwnWork: "ART-Rahmen · für ART-eigene Arbeit",
  frameOpen: "ART-Rahmen · noch nicht vergeben",
  operatingDirect: "Direkt an diesem ART",
  operatingViaSolution: "Über Solutions dieses ARTs",
  operatingKeyed: "Wertstrom-übergreifend, geschlüsselt",
};

export interface ArtBudgetOriginInput {
  cycleKey: string;
  /** Σ `finalAmount` der Portfolio-Kandidaten dieses ARTs in diesem Halbjahr. */
  portfolio: number;
  /**
   * Der ART-Epic-Rahmen dieses Halbjahres: zugesprochen und davon vergeben —
   * getrennt nach **an Epics** und **für ART-eigene Arbeit ohne Epic**. Beides
   * ist Veränderungsgeld und finanziert Vorhaben; getrennt steht es, weil das
   * eine an einem benannten Epic hängt und das andere an keinem.
   *
   * `total − toEpics − toOwnWork` ist die offene Zeile — **ungekappt**. Ein
   * negativer Rest entsteht, wenn ein Rahmen nach dem Vergeben gekürzt wurde;
   * ihn auf 0 zu klemmen versteckte den Widerspruch, statt ihn zu zeigen.
   */
  frame: { total: number; toEpics: number; toOwnWork: number };
  /** Betriebsgeld dieses ARTs im Halbjahr, je Weg. */
  operating: RtbByPath;
  /** Dieselben Wege als **geplanter** Jahresbetrag. */
  operatingAnnual: RtbByPath;
  /** Liegt für dieses Halbjahr eine Aufteilung vor? */
  operatingBasis: OriginBasis;
}

export function buildArtBudgetOrigin(input: ArtBudgetOriginInput): ArtBudgetOrigin {
  const roh: Array<Omit<OriginRow, "share">> = [
    {
      key: "portfolio",
      label: LABELS.portfolio,
      group: "change",
      amount: input.portfolio,
      annual: null,
      // Die Kachel hat entschieden — ein Portfolio-Betrag ist nie „beantragt".
      basis: "awarded",
      estimated: false,
    },
    {
      key: "frameDistributed",
      label: LABELS.frameDistributed,
      group: "change",
      amount: input.frame.toEpics,
      annual: null,
      basis: "awarded",
      estimated: false,
    },
    {
      key: "frameOwnWork",
      label: LABELS.frameOwnWork,
      group: "change",
      amount: input.frame.toOwnWork,
      annual: null,
      basis: "awarded",
      estimated: false,
    },
    {
      key: "frameOpen",
      label: LABELS.frameOpen,
      group: "change",
      amount: input.frame.total - input.frame.toEpics - input.frame.toOwnWork,
      annual: null,
      basis: "awarded",
      estimated: false,
    },
    {
      key: "operatingDirect",
      label: LABELS.operatingDirect,
      group: "operating",
      amount: input.operating.direct,
      annual: input.operatingAnnual.direct,
      basis: input.operatingBasis,
      estimated: false,
    },
    {
      key: "operatingViaSolution",
      label: LABELS.operatingViaSolution,
      group: "operating",
      amount: input.operating.viaSolution,
      annual: input.operatingAnnual.viaSolution,
      basis: input.operatingBasis,
      estimated: false,
    },
    {
      key: "operatingKeyed",
      label: LABELS.operatingKeyed,
      group: "operating",
      amount: input.operating.keyed,
      annual: input.operatingAnnual.keyed,
      basis: input.operatingBasis,
      estimated: true,
    },
  ];

  const sum = (g: OriginGroup) =>
    roh.filter((r) => r.group === g).reduce((s, r) => s + r.amount, 0);
  const changeTotal = sum("change");
  const operatingTotal = sum("operating");
  const total = changeTotal + operatingTotal;

  return {
    cycleKey: input.cycleKey,
    rows: roh.map((r) => ({ ...r, share: total === 0 ? 0 : r.amount / total })),
    changeTotal,
    operatingTotal,
    total,
    isEmpty: roh.every((r) => r.amount === 0),
    // Nur Zeilen mit Betrag zählen: eine leere Betriebsgruppe macht die
    // Überschrift nicht „gemischt".
    basis: mischung(roh.filter((r) => r.amount !== 0).map((r) => r.basis)),
  };
}

function mischung(basen: readonly OriginBasis[]): OriginBasis | "mixed" {
  if (basen.length === 0) return "awarded";
  const erste = basen[0]!;
  return basen.every((b) => b === erste) ? erste : "mixed";
}
