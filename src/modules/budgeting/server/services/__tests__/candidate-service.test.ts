import { describe, it, expect, vi } from "vitest";
import {
  addEpicCandidate,
  type ClassificationBasis,
} from "@/modules/budgeting/server/services/candidate-service";

/**
 * `candidate-service.ts` war eine der neun Service-Dateien ohne jeden Test.
 *
 * Testbar wurde sie durch den **Port**: die Einordnungs-Grundlage kam vorher aus
 * `work`, mitten in der Transaktion, über zwei Loader mit einem
 * `tx as unknown as PrismaClient`-Cast. Ein Test hätte dafür fremdes Prisma
 * nachbauen müssen. Jetzt reicht er Zahlen herein — und ist damit der zweite
 * Adapter, der die Naht rechtfertigt.
 */

const ROUND = "11111111-1111-4111-8111-111111111111";
const EPIC = "22222222-2222-4222-8222-222222222222";
const VS = "33333333-3333-4333-8333-333333333333";

type Tx = Record<string, Record<string, ReturnType<typeof vi.fn>>>;

function ctxWith(tx: Tx) {
  return {
    principal: {
      id: "actor",
      tenantId: "T",
      email: "x",
      roles: [],
      scopes: { artIds: [], teamIds: [], valueStreamIds: [] },
      capabilities: [],
    },
    db: {
      $transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      auditEvent: { create: vi.fn(async () => ({})) },
    },
  } as unknown as Parameters<typeof addEpicCandidate>[0];
}

/** Ein Epic mit freigegebenem Business Case über dem Limit ⇒ Portfolio-Epic. */
function txWith(costEstimate: number): Tx {
  return {
    budgetRound: { findFirst: vi.fn(async () => ({ status: "draft" })) },
    initiative: {
      findFirst: vi.fn(async () => ({
        id: EPIC,
        title: "Ein Epic",
        valueStreamId: VS,
        artId: null,
        businessCase: {
          current: { costSlices: [{ label: "Umsetzung", amount: costEstimate }] },
        },
        benefitHypothesis: null,
        businessCaseApprovedAt: new Date(),
        hypothesisApprovedAt: new Date(),
        portfolioOverrideAt: null,
      })),
    },
    tenant: { findUnique: vi.fn(async () => ({ defaultHypothesisEffort: null })) },
    budgetCandidate: { upsert: vi.fn(async () => ({ id: "c1" })) },
    auditEvent: { create: vi.fn(async () => ({})) },
  };
}

const basis = (over: Partial<ClassificationBasis> = {}): ClassificationBasis => ({
  artEpicsPractice: true,
  thresholdFor: () => 100_000,
  ...over,
});

describe("addEpicCandidate — die Einordnung als Port", () => {
  it("weist ein ART-Epic ab: es wird aus dem ART-Epic-Budget finanziert", async () => {
    const tx = txWith(40_000); // unter dem Limit ⇒ ART-Epic
    const res = await addEpicCandidate(ctxWith(tx), { roundId: ROUND, epicId: EPIC }, basis());
    expect(res.ok).toBe(false);
    expect(tx.budgetCandidate!.upsert).not.toHaveBeenCalled();
  });

  it("nimmt ein Portfolio-Epic auf die PB-Liste", async () => {
    const tx = txWith(400_000); // über dem Limit
    const res = await addEpicCandidate(ctxWith(tx), { roundId: ROUND, epicId: EPIC }, basis());
    expect(res.ok).toBe(true);
    expect(tx.budgetCandidate!.upsert).toHaveBeenCalled();
  });

  it("ohne die Practice gibt es die Trennung nicht — alles darf auf die Liste", async () => {
    const tx = txWith(40_000);
    const res = await addEpicCandidate(
      ctxWith(tx),
      { roundId: ROUND, epicId: EPIC },
      basis({ artEpicsPractice: false }),
    );
    expect(res.ok).toBe(true);
  });

  it("nimmt das Limit des Wertstroms, nicht ein festes", async () => {
    const thresholdFor = vi.fn(() => 10_000);
    const tx = txWith(40_000); // über 10.000 ⇒ Portfolio-Epic
    const res = await addEpicCandidate(
      ctxWith(tx),
      { roundId: ROUND, epicId: EPIC },
      basis({ thresholdFor }),
    );
    expect(res.ok).toBe(true);
    expect(thresholdFor).toHaveBeenCalledWith(VS);
  });

  it("kuratiert nur im Entwurf", async () => {
    const tx = txWith(400_000);
    tx.budgetRound!.findFirst = vi.fn(async () => ({ status: "running" }));
    const res = await addEpicCandidate(ctxWith(tx), { roundId: ROUND, epicId: EPIC }, basis());
    expect(res.ok).toBe(false);
  });
});
