import { describe, it, expect, vi } from "vitest";
import { createRtbItem } from "@/modules/budgeting/server/services/rtb-item-service";

/**
 * **Wem darf eine Position zugerechnet werden?**
 *
 * Zwei Regeln, die bis 2026-09-19 in einer Bedingung verschmolzen waren und
 * deshalb beide nur für den ART-Rahmen liefen:
 *
 *  1. Ein **ART-Rahmen** braucht einen ART.
 *  2. Ein **gesetzter** ART muss zu diesem Wertstrom gehören — bei **jeder** Art.
 *
 * Regel 2 war folgenlos, solange das Formular an Betriebspositionen gar keinen
 * ART anbot. Mit dem freigegebenen Feld wäre sie eine stille Lücke geworden:
 * `resolveRtbToArts` übergeht einen fremden ART, das Geld fiele aus jeder
 * Gruppe. Der Service hatte bis hierhin überhaupt keinen Test.
 */

const VS = "11111111-1111-4111-8111-111111111111";
const ART_EIGEN = "22222222-2222-4222-8222-222222222222";
const ART_FREMD = "33333333-3333-4333-8333-333333333333";

/** Ein `tx`, in dem nur der eigene ART zum Wertstrom gehört. */
function txWith() {
  return {
    valueStream: { findFirst: vi.fn(async () => ({ financeApproverId: "finance" })) },
    art: {
      findFirst: vi.fn(async (args: { where: { id: string } }) =>
        args.where.id === ART_EIGEN ? { id: ART_EIGEN } : null,
      ),
    },
    runTheBusinessItem: { create: vi.fn(async () => ({ id: "neu" })) },
    auditEvent: { create: vi.fn(async () => ({})) },
  } as unknown as Record<string, Record<string, ReturnType<typeof vi.fn>>>;
}

function ctxWith(tx: ReturnType<typeof txWith>) {
  return {
    principal: {
      id: "finance",
      tenantId: "T",
      email: "x",
      roles: [],
      scopes: { artIds: [], teamIds: [], valueStreamIds: [VS] },
      capabilities: [],
    },
    db: {
      $transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      auditEvent: { create: vi.fn(async () => ({})) },
    },
  } as unknown as Parameters<typeof createRtbItem>[0];
}

const eingabe = (over: Partial<Parameters<typeof createRtbItem>[1]> = {}) => ({
  valueStreamId: VS,
  name: "Position",
  plannedAmount: 1000,
  ...over,
});

describe("createRtbItem — die Zurechnung", () => {
  it("legt eine Betriebsposition **ohne** ART an — der Normalfall", async () => {
    const tx = txWith();
    const res = await createRtbItem(ctxWith(tx), eingabe());
    expect(res.ok).toBe(true);
    expect(tx.runTheBusinessItem!.create).toHaveBeenCalled();
  });

  /** Weg 1 der Auflösung — bis 2026-09-19 im Formular unerreichbar. */
  it("legt eine Betriebsposition **mit** ART dieses Wertstroms an", async () => {
    const tx = txWith();
    const res = await createRtbItem(ctxWith(tx), eingabe({ artId: ART_EIGEN }));
    expect(res.ok).toBe(true);
  });

  it("weist einen fremden ART auch an einer Betriebsposition ab", async () => {
    const tx = txWith();
    const res = await createRtbItem(ctxWith(tx), eingabe({ artId: ART_FREMD }));
    expect(res.ok).toBe(false);
    expect(tx.runTheBusinessItem!.create).not.toHaveBeenCalled();
  });

  it("weist einen fremden ART am ART-Rahmen ab", async () => {
    const tx = txWith();
    const res = await createRtbItem(ctxWith(tx), eingabe({ kind: "art_change", artId: ART_FREMD }));
    expect(res.ok).toBe(false);
  });

  /** Die ältere der beiden Regeln — sie darf beim Auftrennen nicht verlorengehen. */
  it("weist einen ART-Rahmen **ohne** ART ab", async () => {
    const tx = txWith();
    const res = await createRtbItem(ctxWith(tx), eingabe({ kind: "art_change" }));
    expect(res.ok).toBe(false);
    expect(tx.runTheBusinessItem!.create).not.toHaveBeenCalled();
  });

  it("legt einen ART-Rahmen mit eigenem ART an", async () => {
    const tx = txWith();
    const res = await createRtbItem(ctxWith(tx), eingabe({ kind: "art_change", artId: ART_EIGEN }));
    expect(res.ok).toBe(true);
  });
});
