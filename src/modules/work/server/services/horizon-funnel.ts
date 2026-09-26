import type { PrismaClient } from "@/generated/prisma";
import { InitiativeLevel, type TenantId, type StageGate } from "@/modules/core/kernel/domain/types";
import { carriesDeliveryLoad, currentGateStep } from "@/modules/work/domain/stage-gate";
import { isHorizon, type Horizon } from "@/modules/work/domain/portfolio-guardrails";
import { isInvestmentMode } from "@/modules/core/org/domain/solution";
import { resolveEpicHorizon } from "@/modules/work/domain/epic-horizon";
import type { FunnelItem } from "@/modules/work/features/portfolio/lib/horizon-funnel";
import { chooseAllocation } from "@/modules/work/domain/epic-allocation-choice";

/**
 * Die Beschickung des Horizont-Trichters: **wo steckt das Geld im laufenden
 * Budget-Zyklus?**
 *
 * Zwei Sorten Symbol, ein Maßstab:
 *
 *  - **Produkte** (Solutions) mit ihrem gebundenen Geld — Investition aus den
 *    Epic-Allokationen, Betrieb aus den Run-the-Business-Positionen.
 *  - **Epics ohne Primär-Solution**, sobald ihnen Budget zugeteilt ist. Sie
 *    binden Mittel, tauchten in der Produktstruktur aber nirgends auf.
 *
 * **Beide Zahlen stehen auf derselben Periode: dem laufenden Zyklus.** Der
 * Invest kommt als `cycleAllocations` herein — dieselbe Karte, die die
 * Fördertopf-Kacheln daneben zeigen, aufgelöst über die *laufende Budget-Runde*
 * (`activeCycleFromRounds`), nicht über den Kalender. Der Betrieb kommt als Ask
 * **einer** Halbjahres-Kachel. Damit ist „Invest + Betrieb" eine Rechnung und
 * keine Vereinbarung; vorher summierte diese Datei die Allokationen über *alle*
 * Halbjahre und addierte eine Jahresrate dazu.
 *
 * **Beides kommt als Port herein**, weil es im Budgeting-Modul lebt und Work
 * dorthin nicht importieren darf (ADR-0013) — dasselbe Muster wie
 * `BudgetingDataPort` für die Kacheln.
 */

/**
 * Ein kurzer, im Symbol lesbarer Code: die Initialen des Wertstroms plus der
 * Teil des Namens, der ihn vom Wertstrom unterscheidet.
 *
 * „Customer Experience Core" im Wertstrom „Customer Experience" wird zu
 * `CE · Core`. **Gekürzt wird hier nicht** — das entscheidet die Geometrie, weil
 * erst dort feststeht, wie viel Platz da ist (`clipCode`). Früher schnitt diese
 * Funktion nach zwei Wörtern ab; daraus wurden Codes wie
 * `P · Ausschuss-/Scrap-Reduktion —`, und ein Epic-Titel machte die Zeichnung
 * so breit, dass gar nichts mehr platziert werden konnte.
 *
 * Rein, kein I/O.
 */
export function funnelCode(name: string, valueStreamName: string | null): string {
  const initials = (valueStreamName ?? "")
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w[0]!.toUpperCase())
    .join("")
    .slice(0, 3);
  // Den Wertstrom-Namen vorne abschneiden — er steht schon als Initialen da.
  const rest = valueStreamName
    ? name.replace(
        new RegExp(`^${valueStreamName.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*`, "i"),
        "",
      )
    : name;
  const tail = rest.trim() || name;
  return initials ? `${initials} · ${tail}` : tail;
}

/**
 * Die Epic-Fakten, die das Zählen braucht — rein, damit die Regel prüfbar ist
 * und nicht in einer Datenbankabfrage verschwindet.
 */
export interface CountableEpic {
  primarySolutionId: string | null;
  stageGate: string;
  selectedForAnalyzingAt: Date | null;
  implementationCompletedAt: Date | null;
}

/**
 * **Wie viele Epics tragen dieses Produkt gerade?**
 *
 * Gezählt wird das Lieferfenster L3–L4.2 (`carriesDeliveryLoad`): vom
 * Budget-Beschluss bis zur abgenommenen Umsetzung. Alles davor ist noch nicht
 * beschlossen, alles danach (L5) liefert nichts mehr — ein Produkt soll
 * zeigen, woran gearbeitet wird, nicht was es je geliefert hat.
 */
export function countDeliveryLoad(epics: readonly CountableEpic[]): Map<string, number> {
  const out = new Map<string, number>();
  for (const e of epics) {
    if (e.primarySolutionId == null) continue;
    if (!inDeliveryWindow(e)) continue;
    out.set(e.primarySolutionId, (out.get(e.primarySolutionId) ?? 0) + 1);
  }
  return out;
}

/**
 * **Erscheint dieses Epic im Trichter?** Das Lieferfenster L3–L4.2 — dieselbe
 * Grenze für die Größe eines Produkts und für die Punkte der Epics ohne
 * Produkt. Davor ist nichts beschlossen, danach (L5) wird nichts mehr geliefert.
 */
export function inDeliveryWindow(
  e: Pick<CountableEpic, "stageGate" | "selectedForAnalyzingAt" | "implementationCompletedAt">,
): boolean {
  return carriesDeliveryLoad(stepOf(e));
}

/** Der Schritt eines Epics — `stage_gate` allein kennt keine Unterstufen. */
function stepOf(
  e: Pick<CountableEpic, "stageGate" | "selectedForAnalyzingAt" | "implementationCompletedAt">,
) {
  return currentGateStep({
    stageGate: e.stageGate as StageGate,
    selectedForAnalyzingAt: e.selectedForAnalyzingAt,
    implementationCompletedAt: e.implementationCompletedAt,
  });
}

export interface HorizonFunnelPorts {
  /** Betrieb je Solution-Id, Ask einer Halbjahres-Kachel. */
  runBySolution: Record<string, number>;
  /** Betrieb ohne Solution-Zuordnung, je Wertstrom. */
  unassignedRun: { valueStreamId: string; valueStreamName: string | null; amount: number }[];
  /** Invest je Epic-Id im angewandten Zyklus, aus dem **Portfolio**-Topf. */
  cycleAllocations: Record<string, number>;
  /** Invest je Epic-Id im angewandten Zyklus, aus dem **ART**-Topf. */
  artAllocations: Record<string, number>;
  /** Die Einordnung je Epic — sie wählt den Topf (`chooseAllocation`). */
  epicClasses: Map<string, { epicClass: "portfolio" | "art" | null }>;
}

export async function loadHorizonFunnelItems(
  db: PrismaClient,
  tenantId: TenantId,
  ports: HorizonFunnelPorts,
): Promise<FunnelItem[]> {
  const { runBySolution, unassignedRun, cycleAllocations, artAllocations, epicClasses } = ports;

  /** Ein Euro, ein Topf — die Klasse wählt, ein leerer Topf tritt zurück. */
  const investOf = (epicId: string): number =>
    chooseAllocation({
      portfolio: cycleAllocations[epicId] ?? 0,
      art: artAllocations[epicId] ?? 0,
      epicClass: epicClasses.get(epicId)?.epicClass ?? null,
    });

  const [solutions, epics] = await Promise.all([
    db.solution.findMany({
      where: { tenantId, deletedAt: null },
      select: {
        id: true,
        name: true,
        horizon: true,
        investmentMode: true,
        valueStream: { select: { name: true } },
      },
      orderBy: { name: "asc" },
    }),
    // Alle Epics: die mit Solution speisen deren Invest, die ohne werden —
    // sofern das Geld schon zugeteilt ist — eigene Punkte.
    db.initiative.findMany({
      where: { tenantId, level: InitiativeLevel.EPIC, deletedAt: null },
      select: {
        id: true,
        title: true,
        investmentHorizon: true,
        primarySolutionId: true,
        primarySolution: { select: { horizon: true } },
        valueStream: { select: { name: true } },
        // Der Schritt: `stage_gate` allein trennt weder den Analyse-Schritt
        // noch L4.1/L4.2 — beide haengen an einem Stempel.
        stageGate: true,
        selectedForAnalyzingAt: true,
        implementationCompletedAt: true,
      },
    }),
  ]);

  const investBySolution = new Map<string, number>();
  for (const e of epics) {
    if (e.primarySolutionId == null) continue;
    const amount = investOf(e.id);
    if (amount === 0) continue;
    investBySolution.set(
      e.primarySolutionId,
      (investBySolution.get(e.primarySolutionId) ?? 0) + amount,
    );
  }

  const loadBySolution = countDeliveryLoad(epics);

  const items: FunnelItem[] = solutions.map((s) => ({
    id: s.id,
    kind: "solution" as const,
    code: funnelCode(s.name, s.valueStream?.name ?? null),
    name: s.name,
    horizon: isHorizon(s.horizon) ? s.horizon : null,
    mode: isInvestmentMode(s.investmentMode) ? s.investmentMode : null,
    invest: investBySolution.get(s.id) ?? 0,
    run: runBySolution[s.id] ?? 0,
    count: loadBySolution.get(s.id) ?? 0,
  }));

  for (const e of epics) {
    if (e.primarySolutionId != null) continue;
    // **Eine Regel für Größe und Punkte: das Lieferfenster L3–L4.2.**
    // Bis September 2026 entschied hier mit Budget-Modul die Zuteilung — ein
    // Epic ohne Produkt erschien damit schon ab L2 und blieb auf L5 stehen,
    // solange Geld darauf lag, während die Produktgröße daneben nur L3–L4.2
    // zählte. Dieselbe Zeichnung, zwei Regeln. Jetzt gilt für beide dieselbe;
    // das Geld bestimmt nur noch den Invest des Punkts, nicht ob er erscheint.
    if (!inDeliveryWindow(e)) continue;
    const invest = investOf(e.id);
    items.push({
      id: e.id,
      kind: "epic",
      code: funnelCode(e.title, e.valueStream?.name ?? null),
      name: e.title,
      // Ohne Produkt bleibt nur der Horizont am Epic selbst (Vorhaben A).
      horizon: resolveEpicHorizon({
        investmentHorizon: e.investmentHorizon,
        solutionHorizon: e.primarySolution?.horizon ?? null,
        businessCaseApprovedAt: null,
      }) as Horizon | null,
      mode: null,
      invest,
      run: 0,
      // Ein Epic ist genau ein Epic — es wiegt eins für die Bandöffnung,
      // gezeichnet wird es als Punkt fester Größe.
      count: 1,
    });
  }

  // Betrieb ohne Solution-Zuordnung: er fällt im Zyklus an, gehört aber keinem
  // Produkt. Ihn einem Band zuzuschlagen erfände eine Zurechnung, die es in den
  // Daten nicht gibt — er landet im Streifen unter dem Trichter.
  for (const vs of unassignedRun) {
    items.push({
      id: `run:${vs.valueStreamId}`,
      kind: "run",
      code: funnelCode("Betrieb", vs.valueStreamName),
      name: `Wertstromübergreifender Betrieb — ${vs.valueStreamName ?? "ohne Wertstrom"}`,
      // Betrieb ist kein Vorhaben — im Zählmodus wiegt und misst er nichts.
      count: 0,
      horizon: null,
      mode: null,
      invest: 0,
      run: vs.amount,
    });
  }

  return items;
}
