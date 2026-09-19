/**
 * Wer darf was mit einem Budget — **als reine Regeln**.
 *
 * Das Modul hatte drei eigene Autorisierungsfunktionen in drei Bauarten: eine
 * rein mit Fakten, eine `async` mit `tx` und `Result`, eine `async` mit `db` und
 * `boolean`. **Nur die reine hatte Tests** — die anderen beiden waren an Prisma
 * und den Principal gebunden und nur mit einem Fake erreichbar. Dabei
 * autorisierte die eine vier Mutationen und die andere zwei Seitenzugänge.
 *
 * Hier stehen alle drei Entscheidungen in **einer** Form: Fakten hinein, Grund
 * heraus (`null` = erlaubt). Das Sammeln der Fakten — eine Zeile aus der
 * Datenbank, ein Capability-Aufruf — bleibt beim Aufrufer und ist der einzige
 * Teil, der sich je Ressource unterscheidet.
 *
 * Die Fakten sind je Entscheidung eigene, schmale Typen. Ein gemeinsamer
 * Fakten-Sack hätte jeden Aufrufer gezwungen, Dinge zu beschaffen, die seine
 * Frage nicht braucht.
 *
 * Rein, kein I/O.
 */

// ---------------------------------------------------------------------------
// Positionen pflegen und den Zuspruch aufteilen
// ---------------------------------------------------------------------------

/** Wovon der Aufrufer spricht — trägt nur die Fehlermeldung. */
export type RtbManagePurpose = "items" | "awards";

export interface RtbManageFacts {
  /** Der Aufrufer ist die Finance-Partei des Wertstroms. */
  isValueStreamFinance: boolean;
  /** Der Aufrufer trägt `rtb_item.manage` auf diesem Wertstrom. */
  hasRtbCapability: boolean;
}

const RTB_REASON: Record<RtbManagePurpose, string> = {
  items:
    "Nur der Wertstrom-Owner/Finance-Partei (oder Portfolio-Manager/Admin) darf Run-the-Business-Positionen pflegen.",
  awards:
    "Nur der Wertstrom-Owner, die Finance-Partei oder das Portfolio-Management dürfen den Zuspruch aufteilen.",
};

/**
 * Die **Finance-Partei** steht vor der Capability, weil sie zeilenabhängig ist
 * (`ValueStream.financeApproverId`) und sich nicht als Rolle ausdrücken lässt.
 *
 * `null` = erlaubt.
 */
export function rtbManageDeniedReason(
  facts: RtbManageFacts,
  purpose: RtbManagePurpose,
): string | null {
  if (facts.isValueStreamFinance || facts.hasRtbCapability) return null;
  return RTB_REASON[purpose];
}

// ---------------------------------------------------------------------------
// Das ART-Epic-Budget verteilen
// ---------------------------------------------------------------------------

/**
 * Vier Wege führen zum Verteilen, und sie sind bewusst verschieden breit:
 *
 *  - **Der ART selbst** über `art_budget.distribute`, `art`-scoped: der RTE
 *    verteilt das Budget seines eigenen ARTs. Er **setzt** es nicht — wie groß
 *    es ist, entscheidet der Wertstrom beim Aufteilen des Zuspruchs.
 *  - **Die Capability** `rtb_item.manage` gilt für den ganzen Wertstrom.
 *  - **Die Finance-Partei** des Wertstroms ebenso, ohne dafür eine Rolle zu
 *    brauchen.
 *  - **Der Produkt-Manager** einer Solution nur für die Epics **seines**
 *    Produkts. Das Budget gehört dem ART, die Verantwortung für das Vorhaben
 *    aber ihm — deshalb hängt sein Recht am Epic, nicht am Budget. Sonst dürfte
 *    er über fremde Vorhaben desselben ARTs mitentscheiden, nur weil sie
 *    zufällig danebenliegen.
 */
export interface ArtPotAccessFacts {
  isValueStreamFinance: boolean;
  hasRtbCapability: boolean;
  hasArtDistributeCapability: boolean;
  isEpicSolutionProductManager: boolean;
}

/** `null` = erlaubt. Sonst der Grund, warum nicht. */
export function artPotAccessDeniedReason(facts: ArtPotAccessFacts): string | null {
  if (facts.isValueStreamFinance || facts.hasRtbCapability) return null;
  if (facts.hasArtDistributeCapability) return null;
  if (facts.isEpicSolutionProductManager) return null;
  return (
    "Nur der RTE dieses ARTs, Wertstrom-Owner, Finance-Partei, Portfolio-Management " +
    "oder der Produkt-Manager der Solution dieses Epics dürfen den ART-Rahmen verteilen."
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

/**
 * Darf der Aufrufer die Zeile **ART-eigene Arbeit** bedienen?
 *
 * Dieselbe Regel, **ohne** den Weg des Produkt-Managers: er verantwortet eine
 * Solution, und die eigenständige Arbeit eines ARTs ist keine. Genau diese
 * Einengung nimmt auch `saveArtEpicAllocations` vor — sie steht deshalb hier
 * und nicht zweimal nachgebaut.
 */
export function mayDistributeToOwnWork(
  facts: Omit<ArtPotAccessFacts, "isEpicSolutionProductManager">,
): boolean {
  return mayDistributeToEpic({ ...facts, isEpicSolutionProductManager: false });
}

// ---------------------------------------------------------------------------
// Das Budget eines ARTs sehen
// ---------------------------------------------------------------------------

export interface ArtBudgetReadFacts {
  /** Das Budgeting-Modul ist für diesen Mandanten lizenziert. */
  budgetingEnabled: boolean;
  isValueStreamFinance: boolean;
  /** `budget.read` auf dem ART **oder** seinem Wertstrom. */
  hasBudgetRead: boolean;
  hasArtDistributeCapability: boolean;
  /**
   * Der Aufrufer verantwortet die Primär-Solution mindestens eines
   * **vorgemerkten, BC-freigegebenen** Epics dieses ARTs.
   *
   * Der teuerste Fakt — er kostet eine Abfrage. Deshalb sammelt der Aufrufer
   * ihn erst, wenn keiner der billigen Wege greift.
   */
  isEpicSolutionProductManager: boolean;
}

/**
 * Wer das Budget eines ARTs verteilen darf, darf es auch sehen — sonst ließe
 * sich nicht verteilen. Deshalb ist diese Menge eine Obermenge der Verteiler.
 *
 * `null` = erlaubt.
 */
export function artBudgetReadDeniedReason(facts: ArtBudgetReadFacts): string | null {
  if (!facts.budgetingEnabled) return "Das Budgeting-Modul ist für diesen Mandanten nicht aktiv.";
  if (
    facts.isValueStreamFinance ||
    facts.hasBudgetRead ||
    facts.hasArtDistributeCapability ||
    facts.isEpicSolutionProductManager
  ) {
    return null;
  }
  return "Das Budget dieses ARTs ist Ihnen nicht zugänglich.";
}

/** Greift einer der **billigen** Wege? Dann muss der teure Fakt nicht beschafft werden. */
export function readAllowedWithoutProductManagerCheck(
  facts: Omit<ArtBudgetReadFacts, "isEpicSolutionProductManager">,
): boolean {
  return artBudgetReadDeniedReason({ ...facts, isEpicSolutionProductManager: false }) == null;
}

// ---------------------------------------------------------------------------
// Das Budget eines Wertstroms sehen
// ---------------------------------------------------------------------------

export interface ValueStreamBudgetReadFacts {
  /** Das Budgeting-Modul ist für diesen Mandanten lizenziert. */
  budgetingEnabled: boolean;
  /** Der Aufrufer ist die Finance-Partei dieses Wertstroms. */
  isValueStreamFinance: boolean;
  /** `budget.read` auf diesem Wertstrom. */
  hasValueStreamBudgetRead: boolean;
  /** `rtb_item.manage` auf diesem Wertstrom — wer pflegen darf, darf lesen. */
  hasRtbCapability: boolean;
  /** Zahl der ARTs dieses Stroms, deren Budget der Aufrufer sehen darf. */
  visibleArtCount: number;
}

/**
 * Trägt der Aufrufer das Recht am **Wertstrom selbst**?
 *
 * Das ist die Frage nach den **Summenzeilen** — Budgetplan, Verlauf,
 * Auslastung. Sie fassen alle ARTs zusammen; wer nur eines davon verantwortet,
 * läse darin die Zahlen der anderen mit.
 */
export function maySeeValueStreamTotals(facts: ValueStreamBudgetReadFacts): boolean {
  return (
    facts.budgetingEnabled &&
    (facts.isValueStreamFinance || facts.hasValueStreamBudgetRead || facts.hasRtbCapability)
  );
}

/**
 * Darf der Aufrufer die Budgetfläche dieses Wertstroms **öffnen**?
 *
 * Zwei Wege hinein, und der zweite ist der Grund, warum diese Regel überhaupt
 * nötig ist: **wer ein ART dieses Stroms sehen darf, darf die Fläche öffnen** —
 * seit die ART-Budgets darin aufklappen, ist sie sein Weg zu seinem eigenen
 * Geld. Er sieht dann eine **kürzere** Seite: seine ART-Zeile mit Zahlen, die
 * übrigen nur als Name, und keine Summenzeilen
 * (`maySeeValueStreamTotals`).
 *
 * Bis hierhin prüfte die Fläche **gar nichts** — kein Modul, keine Capability,
 * keinen Scope. Das war tragbar, solange sie nur Wertstrom-Summen zeigte; mit
 * den ART-Inhalten darin stünde geschütztes Geld hinter einer offenen Tür.
 *
 * `null` = erlaubt.
 */
export function valueStreamBudgetReadDeniedReason(
  facts: ValueStreamBudgetReadFacts,
): string | null {
  if (!facts.budgetingEnabled) return "Das Budgeting-Modul ist für diesen Mandanten nicht aktiv.";
  if (maySeeValueStreamTotals(facts)) return null;
  if (facts.visibleArtCount > 0) return null;
  return "Das Budget dieses Wertstroms ist Ihnen nicht zugänglich.";
}
