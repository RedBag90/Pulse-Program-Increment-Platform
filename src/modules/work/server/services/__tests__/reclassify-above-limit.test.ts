import { describe, it, expect, vi } from "vitest";
import type { Prisma } from "@/generated/prisma";
import type { TenantId } from "@/modules/core/kernel/domain/types";
import { reclassifyAboveLimit } from "@/modules/work/server/services/epic-class";

/**
 * Die Regel „über dem Limit bleibt kein Epic ART" gegen eine Attrappe der
 * Transaktion. Der Weg durch den Gate-Dienst steht im Integrationstest
 * (`stage-gate-transition.integration.test.ts`); diese Datei prüft die Regel
 * selbst, auch ohne Test-Datenbank.
 */

const TENANT = "00000000-0000-0000-0000-000000000001" as TenantId;
const LIMIT = 100_000;
const bc = (amount: number) => ({ current: { costSlices: [{ amount }] } });

function fakeTx(row: { intendedClass: string | null; businessCase: unknown } | null) {
  const update = vi.fn().mockResolvedValue({});
  const tx = {
    initiative: {
      findFirst: vi.fn().mockResolvedValue(row && { ...row, valueStreamId: "vs-1" }),
      update,
    },
    valueStreamGuardrailTargets: {
      findMany: vi
        .fn()
        .mockResolvedValue([
          { valueStreamId: "vs-1", targets: { approval: { portfolioThreshold: LIMIT } } },
        ]),
    },
    tenant: { findUnique: vi.fn().mockResolvedValue({ guardrailTargets: null }) },
  };
  return { tx: tx as unknown as Prisma.TransactionClient, update };
}

describe("reclassifyAboveLimit", () => {
  it("stellt ein ART-Epic über dem Limit auf Portfolio um", async () => {
    const { tx, update } = fakeTx({ intendedClass: "art", businessCase: bc(LIMIT + 1) });
    const change = await reclassifyAboveLimit(tx, TENANT, "e1", "actor");
    expect(change).toEqual({ before: "art", after: "portfolio" });
    expect(update).toHaveBeenCalledWith({
      where: { id: "e1" },
      data: { intendedClass: "portfolio", updatedBy: "actor" },
    });
  });

  it("Gleichstand bleibt ART — die Schwelle zählt noch zum ART", async () => {
    const { tx, update } = fakeTx({ intendedClass: "art", businessCase: bc(LIMIT) });
    expect(await reclassifyAboveLimit(tx, TENANT, "e1", "actor")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("ein Portfolio-Epic unter dem Limit bleibt Portfolio", async () => {
    const { tx, update } = fakeTx({ intendedClass: "portfolio", businessCase: bc(1) });
    expect(await reclassifyAboveLimit(tx, TENANT, "e1", "actor")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("ohne bezifferten Business Case ändert sich nichts", async () => {
    const { tx, update } = fakeTx({ intendedClass: "art", businessCase: null });
    expect(await reclassifyAboveLimit(tx, TENANT, "e1", "actor")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });

  it("ein fremdes oder fehlendes Epic ändert nichts", async () => {
    const { tx, update } = fakeTx(null);
    expect(await reclassifyAboveLimit(tx, TENANT, "e1", "actor")).toBeNull();
    expect(update).not.toHaveBeenCalled();
  });
});
