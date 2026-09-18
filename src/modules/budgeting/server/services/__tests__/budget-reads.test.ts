import { describe, it, expect } from "vitest";
import { budgetingStore } from "@/test/fakes/budgeting-store";
import {
  readBudgetCandidates,
  readRtbItems,
  readRtbAwards,
} from "@/modules/budgeting/server/services/budget-reads";
import type { TenantId } from "@/modules/core/kernel/domain/types";

/**
 * Die drei Lader, die alle Budget-Flächen speisen.
 *
 * Sie sind **absichtlich filterlos**: sie lesen den ganzen Mandanten, damit alle
 * Aufrufer sich dieselbe Rundreise teilen — auch die, die über Wertströme
 * hinweg lesen. Diese Tests halten genau das fest; ein „hilfreicher" Filter,
 * den jemand später einbaut, bricht sie.
 *
 * Was sie **nicht** prüfen können: die Deduplizierung selbst. `react.cache`
 * greift nur innerhalb eines React-Requests; ausserhalb ist jeder Aufruf ein
 * Fehlschlag. Gemessen wird am laufenden Server mit `PRISMA_DEBUG=1`.
 */

const T = "t1" as unknown as TenantId;

describe("readBudgetCandidates", () => {
  const store = () =>
    budgetingStore({
      budgetRound: [
        { id: "r1", tenantId: T, cycleKey: "2026-H1", status: "closed" },
        { id: "r2", tenantId: T, cycleKey: "2026-H2", status: "open" },
      ],
      budgetCandidate: [
        {
          id: "c1",
          tenantId: T,
          kind: "epic",
          epicId: "e1",
          artId: "a1",
          valueStreamId: "vs1",
          rtbItemId: null,
          title: "Epic Eins",
          ask: 100,
          finalAmount: 80,
          roundId: "r1",
        },
        {
          id: "c2",
          tenantId: T,
          kind: "rtb",
          epicId: null,
          artId: null,
          valueStreamId: "vs1",
          rtbItemId: "i1",
          title: "Betrieb",
          ask: 50,
          finalAmount: null,
          roundId: "r2",
        },
        // Fremder Mandant — darf nie mitkommen.
        {
          id: "c3",
          tenantId: "t2",
          kind: "epic",
          epicId: "e9",
          artId: "a9",
          valueStreamId: "vs9",
          rtbItemId: null,
          title: "Fremd",
          ask: 1,
          finalAmount: 1,
          roundId: "r1",
        },
      ],
    });

  it("liest beide Sorten und lässt den fremden Mandanten draussen", async () => {
    const rows = await readBudgetCandidates(store().db, T);
    expect(rows.map((r) => r.id)).toEqual(["c1", "c2"]);
  });

  /**
   * Das Halbjahr lag bisher eine Ebene tiefer (`round.cycleKey`), und **jeder**
   * der sechs Aufrufer zog es selbst heraus. Einmal reicht.
   */
  it("zieht Halbjahr und Kachel-Zustand flach", async () => {
    const [c1] = await readBudgetCandidates(store().db, T);
    expect(c1?.cycleKey).toBe("2026-H1");
    expect(c1?.roundStatus).toBe("closed");
  });

  it("gibt Beträge als Zahl, nicht als Decimal — und `null` bleibt `null`", async () => {
    const rows = await readBudgetCandidates(store().db, T);
    expect(rows[0]?.ask).toBe(100);
    expect(rows[0]?.finalAmount).toBe(80);
    expect(rows[1]?.finalAmount).toBeNull();
  });
});

describe("readRtbItems", () => {
  const store = () =>
    budgetingStore({
      runTheBusinessItem: [
        {
          id: "i1",
          tenantId: T,
          name: "Betrieb A",
          kind: "run",
          artId: null,
          solutionId: "s1",
          valueStreamId: "vs1",
          plannedAmount: 120,
          interval: "half_yearly",
          active: true,
        },
        {
          id: "i2",
          tenantId: T,
          name: "Rahmen B",
          kind: "art_change",
          artId: "a1",
          solutionId: null,
          valueStreamId: "vs1",
          plannedAmount: 300,
          interval: "yearly",
          active: false,
        },
        { id: "i3", tenantId: "t2", name: "Fremd", kind: "run", valueStreamId: "vs9" },
      ],
    });

  /**
   * **Auch die stillgelegten.** Wer nur aktive will, filtert selbst — die
   * Solutions-Liste zählt die abgeschalteten mit, der Zuspruch nicht. Ein
   * `active: true` im Lader nähme dem einen Aufrufer seine Zeilen weg.
   */
  it("liest auch stillgelegte Positionen", async () => {
    const rows = await readRtbItems(store().db, T);
    expect(rows.map((r) => r.id)).toEqual(["i1", "i2"]);
    expect(rows.find((r) => r.id === "i2")?.active).toBe(false);
  });

  it("gibt den Betrag als Zahl", async () => {
    const rows = await readRtbItems(store().db, T);
    expect(rows.find((r) => r.id === "i2")?.plannedAmount).toBe(300);
  });
});

describe("readRtbAwards", () => {
  /**
   * **Über alle Halbjahre.** Der Lader nimmt bewusst kein `cycleKey`: mit einem
   * dedupliziert `react.cache` nicht mehr, sobald zwei Aufrufer verschiedene
   * Halbjahre wollen — und genau das tun sie (die Kette das gewählte, die
   * Verteilliste dasselbe, der ART-Falter ein anderes).
   */
  it("liest alle Halbjahre des Mandanten", async () => {
    const { db } = budgetingStore({
      rtbItemAward: [
        { id: "w1", tenantId: T, rtbItemId: "i1", cycleKey: "2026-H1", amount: 10 },
        { id: "w2", tenantId: T, rtbItemId: "i1", cycleKey: "2026-H2", amount: 20 },
        { id: "w3", tenantId: "t2", rtbItemId: "i9", cycleKey: "2026-H1", amount: 99 },
      ],
    });
    const rows = await readRtbAwards(db, T);
    expect(rows).toEqual([
      { rtbItemId: "i1", cycleKey: "2026-H1", amount: 10 },
      { rtbItemId: "i1", cycleKey: "2026-H2", amount: 20 },
    ]);
  });
});
