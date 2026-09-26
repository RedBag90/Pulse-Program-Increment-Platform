import { describe, it, expect, vi } from "vitest";
import { setArtJobSizeRateEstimate } from "@/modules/budgeting/server/services/art-rate-estimate";

/**
 * **Die Schätzung des €-Satzes speichern** — Recht gegen ART und Wertstrom,
 * leer entfernt, jede Änderung im Audit.
 */

const ART = "11111111-1111-4111-8111-111111111111";
const VS = "33333333-3333-4333-8333-333333333333";

function aufbau(capabilities: { action: string; scope?: string }[], vsIds = [VS]) {
  const update = vi.fn(async () => ({}));
  const audit = vi.fn(async () => ({}));
  const tx = {
    art: {
      findFirst: vi.fn(async () => ({ valueStreamId: VS, jobSizeRateEstimate: null })),
      update,
    },
    // Das Audit schreibt in derselben Transaktion.
    auditEvent: { create: audit },
  };
  const ctx = {
    principal: {
      id: "u1",
      tenantId: "T",
      email: "x",
      roles: [],
      scopes: { artIds: [ART], teamIds: [], valueStreamIds: vsIds },
      capabilities,
    },
    db: {
      $transaction: async (cb: (t: unknown) => Promise<unknown>) => cb(tx),
      auditEvent: { create: audit },
    },
  } as unknown as Parameters<typeof setArtJobSizeRateEstimate>[0];
  return { ctx, update, audit };
}

describe("setArtJobSizeRateEstimate", () => {
  it("mit art_budget.distribute: speichert die Schätzung und schreibt das Audit", async () => {
    const { ctx, update, audit } = aufbau([{ action: "art_budget.distribute" }]);
    const r = await setArtJobSizeRateEstimate(ctx, { artId: ART, estimate: 2_500 });
    expect(r.ok).toBe(true);
    expect(update).toHaveBeenCalledWith({
      where: { id: ART },
      data: { jobSizeRateEstimate: 2_500 },
    });
    expect(audit).toHaveBeenCalled();
  });

  it("leer entfernt die Schätzung", async () => {
    const { ctx, update } = aufbau([{ action: "art_budget.distribute" }]);
    await setArtJobSizeRateEstimate(ctx, { artId: ART, estimate: null });
    expect(update).toHaveBeenCalledWith({
      where: { id: ART },
      data: { jobSizeRateEstimate: null },
    });
  });

  it("ohne Recht: abgewiesen, nichts geschrieben", async () => {
    const { ctx, update } = aufbau([]);
    const r = await setArtJobSizeRateEstimate(ctx, { artId: ART, estimate: 2_500 });
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.error).toMatchObject({ kind: "forbidden" });
    expect(update).not.toHaveBeenCalled();
  });

  it("wertstrom-scoped Recht gilt nur im eigenen Wertstrom", async () => {
    const { ctx, update } = aufbau(
      [{ action: "art_budget.distribute", scope: "value_stream" }],
      ["anderer-wertstrom"],
    );
    const r = await setArtJobSizeRateEstimate(ctx, { artId: ART, estimate: 2_500 });
    expect(r.ok).toBe(false);
    expect(update).not.toHaveBeenCalled();
  });
});
