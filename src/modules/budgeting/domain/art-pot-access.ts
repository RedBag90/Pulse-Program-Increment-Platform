/**
 * Wer darf aus dem ART-Epic-Budget eines ARTs auf ein ART-Epic zuteilen?
 *
 * Vier Wege führen hin, und sie sind bewusst verschieden breit:
 *
 *  - **Der ART selbst** über `art_budget.distribute`, `art`-scoped: der RTE
 *    verteilt das Budget seines eigenen ARTs. Er **setzt** es nicht — wie groß
 *    es ist, entscheidet der Wertstrom beim Aufteilen des Zuspruchs. Ohne
 *    diesen Weg wäre die ART-Budgetfläche für den ART eine reine Lesefläche.
 *  - **Die Capability** `rtb_item.manage` (Wertstrom-Owner, Portfolio-Management,
 *    Tenant-Admin) gilt für den ganzen Wertstrom — wer sie trägt, verteilt jeden
 *    Rahmen darin.
 *  - **Die Finance-Partei** des Wertstroms (`ValueStream.financeApproverId`)
 *    ebenso, ohne dafür eine Rolle zu brauchen.
 *  - **Der Produkt-Manager** einer Solution (`Solution.productManagerId`) nur für
 *    die Epics **seines Produkts**. Der Rahmen gehört dem ART, die
 *    Verantwortung für das Vorhaben aber ihm — deshalb hängt sein Recht am
 *    Epic, nicht am Topf. Sonst dürfte er über fremde Vorhaben desselben ARTs
 *    mitentscheiden, nur weil sie zufällig danebenliegen.
 *
 * Rein, kein I/O — der Service reicht die drei Fakten herein.
 */

export interface ArtPotAccessFacts {
  /** Der Aufrufer trägt `art_budget.distribute` auf **diesem** ART. */
  hasArtDistributeCapability: boolean;
  /** Der Aufrufer ist die Finance-Partei des Wertstroms, zu dem der ART gehört. */
  isValueStreamFinance: boolean;
  /** Der Aufrufer ist Produkt-Manager der **Primär-Solution dieses Epics**. */
  isEpicSolutionProductManager: boolean;
  /** Der Aufrufer trägt `rtb_item.manage` auf dem Wertstrom des ARTs. */
  hasRtbCapability: boolean;
}

/** `null` = erlaubt. Sonst der Grund, warum nicht — wie `potWindowClosedReason`. */
export function artPotAccessDeniedReason(facts: ArtPotAccessFacts): string | null {
  if (facts.isValueStreamFinance || facts.hasRtbCapability) return null;
  if (facts.hasArtDistributeCapability) return null;
  if (facts.isEpicSolutionProductManager) return null;
  return (
    "Nur der RTE dieses ARTs, Wertstrom-Owner, Finance-Partei, Portfolio-Management " +
    "oder der Produkt-Manager der Solution dieses Epics dürfen das ART-Epic-Budget verteilen."
  );
}

/**
 * Darf der Aufrufer **diese eine Zeile** der Verteilliste bedienen?
 *
 * Die Fläche zeigt alle ART-Epics des ARTs; bedienbar sind für einen
 * Produkt-Manager aber nur seine eigenen. Ein Feld, das aussieht wie ein Feld
 * und beim Speichern ablehnt, wäre die schlechtere Auskunft.
 */
export function mayDistributeToEpic(facts: ArtPotAccessFacts): boolean {
  return artPotAccessDeniedReason(facts) == null;
}
