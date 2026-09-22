import { describe, it, expect, vi } from "vitest";
import type { PrismaClient } from "@/generated/prisma";
import type { RequestContext } from "@/server/http/mutation-handler";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import {
  dismissTourSteps,
  restartTour,
} from "@/modules/onboarding/server/services/role-onboarding";
import { ONBOARDING_DISMISSED_KEY } from "@/modules/onboarding/domain/onboarding-dismissal";

/**
 * **Die Ablehnung muss umkehrbar bleiben.**
 *
 * „Nicht mehr anzeigen" schreibt einen Merker ans Konto. Der Knopf „Tour
 * erneut starten" auf `/meine-rolle` leerte bis dahin nur `seenStepKeys` — mit
 * dem Merker daneben wäre er eine leere Zusage geworden: die Tour startete neu
 * und wäre im selben Augenblick wieder zu Ende gewesen.
 */

const TENANT = "11111111-1111-4111-8111-111111111111";
const USER = "22222222-2222-4222-8222-222222222222";

/** Ein Prisma-Doppel, das genau die zwei Tabellen kennt, die hier zählen. */
function harness(gespeichert: unknown = undefined) {
  const upsert = vi.fn(async (_args: { create: { value: unknown } }) => ({ id: "p1" }));
  const updateMany = vi.fn(async (_args: { data: { seenStepKeys: string[] } }) => ({ count: 1 }));
  const db = {
    roleOnboarding: { updateMany },
    viewPreference: {
      findMany: async () =>
        gespeichert === undefined ? [] : [{ key: ONBOARDING_DISMISSED_KEY, value: gespeichert }],
      upsert,
    },
  } as unknown as PrismaClient;

  const ctx = {
    db,
    principal: { id: USER, tenantId: TENANT },
  } as unknown as RequestContext;

  /** Der Wert, der in `view_preferences` geschrieben wurde — oder `null`. */
  const geschrieben = (): unknown => upsert.mock.calls[0]?.[0].create.value ?? null;

  return { ctx, upsert, updateMany, geschrieben };
}

describe("dismissTourSteps", () => {
  it("legt die abgelehnten Schritte je Rolle ab", async () => {
    const h = harness();
    await dismissTourSteps(h.ctx, { role: ROLES.RTE, stepKeys: ["a", "b"] });
    expect(h.geschrieben()).toEqual({ [ROLES.RTE]: ["a", "b"] });
  });

  it("legt zu einer bestehenden Ablehnung nach, statt sie zu ersetzen", async () => {
    // Lesen-Ändern-Schreiben auf dem Server: der Merker trägt alle Rollen in
    // einem JSON. Ein Client, der seinen Stand von vorhin zurückschriebe,
    // löschte die Ablehnung eines anderen Tabs mit.
    const h = harness({ [ROLES.RTE]: ["a"], [ROLES.PORTFOLIO_MANAGER]: ["x"] });
    await dismissTourSteps(h.ctx, { role: ROLES.RTE, stepKeys: ["b"] });
    expect(h.geschrieben()).toEqual({ [ROLES.RTE]: ["a", "b"], [ROLES.PORTFOLIO_MANAGER]: ["x"] });
  });

  it("schreibt bei leerer Liste gar nicht", async () => {
    const h = harness();
    await dismissTourSteps(h.ctx, { role: ROLES.RTE, stepKeys: [] });
    expect(h.upsert).not.toHaveBeenCalled();
  });
});

describe("restartTour", () => {
  it("leert die gesehenen Schritte — und die Ablehnungen derselben Rolle", async () => {
    const h = harness({ [ROLES.RTE]: ["a", "b"], [ROLES.PORTFOLIO_MANAGER]: ["x"] });
    await restartTour(h.ctx, { role: ROLES.RTE });

    expect(h.updateMany).toHaveBeenCalledOnce();
    expect(h.updateMany.mock.calls[0]?.[0]).toMatchObject({ data: { seenStepKeys: [] } });
    // Die andere Rolle behält ihre Entscheidung: zurückgesetzt wird eine Tour,
    // nicht das Konto.
    expect(h.geschrieben()).toEqual({ [ROLES.PORTFOLIO_MANAGER]: ["x"] });
  });

  it("rührt den Merker nicht an, wenn diese Rolle nichts abgelehnt hat", async () => {
    // Der häufige Fall. Ein Schreibzugriff ohne Änderung wäre nur Last.
    const h = harness({ [ROLES.PORTFOLIO_MANAGER]: ["x"] });
    await restartTour(h.ctx, { role: ROLES.RTE });
    expect(h.upsert).not.toHaveBeenCalled();
  });
});
