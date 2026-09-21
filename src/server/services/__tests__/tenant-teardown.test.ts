import { describe, it, expect } from "vitest";
import { Prisma } from "@/generated/prisma";
import {
  TENANT_TEARDOWN_ORDER,
  TEARDOWN_MEMBERSHIP_STEP,
  wipeTenantData,
  type TeardownClient,
} from "@/server/services/tenant-teardown";

/**
 * **Der Waechter gegen die vergessene Tabelle.**
 *
 * Die Raeum-Liste war bis September 2026 handgepflegt und uebersah sechs
 * Modelle: `ViewPreference`, `RoleOnboarding`, `JiraConfig`,
 * `AzureDevOpsConfig`, `OutboxEvent`, `IdempotencyKey`. Auffallen konnte das
 * nicht — ein Reseed laeuft durch, die Leichen bleiben still liegen.
 *
 * Statt die Liste zu ergaenzen und zu hoffen, prueft dieser Test sie gegen
 * Prismas DMMF: **jedes** Modell mit einem `tenantId`-Feld muss vorkommen. Ein
 * neues Modell laesst den Test fallen, bis jemand entscheidet, wohin es gehoert.
 */

/** `GoalCheckin` → `goalCheckin`, so heisst das Delegate am Client. */
const delegateName = (model: string) => model[0]!.toLowerCase() + model.slice(1);

const modelleMitTenantId = Prisma.dmmf.datamodel.models
  .filter((m) => m.fields.some((f) => f.name === "tenantId"))
  .map((m) => m.name);

describe("die Raeum-Liste", () => {
  it("deckt jedes Modell mit tenantId ab", () => {
    const abgedeckt = new Set([
      ...TENANT_TEARDOWN_ORDER.map((s) => s.model),
      TEARDOWN_MEMBERSHIP_STEP.model,
    ]);
    const fehlend = modelleMitTenantId
      .map(delegateName)
      .filter((d) => !abgedeckt.has(d))
      .sort();
    expect(fehlend).toEqual([]);
  });

  it("nennt kein Modell, das es nicht gibt", () => {
    const bekannt = new Set(modelleMitTenantId.map(delegateName));
    const erfunden = [...TENANT_TEARDOWN_ORDER, TEARDOWN_MEMBERSHIP_STEP]
      .map((s) => s.model)
      .filter((m) => !bekannt.has(m));
    expect(erfunden).toEqual([]);
  });

  it("ist nicht leer — sonst waere der erste Test trivial gruen", () => {
    expect(TENANT_TEARDOWN_ORDER.length).toBeGreaterThan(40);
    expect(modelleMitTenantId.length).toBeGreaterThan(40);
  });

  /**
   * Die Reihenfolge traegt die Fremdschluessel. Drei Paare stehen fuer den Rest:
   * Features vor Epics, Solutions vor Wertstroemen, Freigabe-Regeln vor dem
   * Wertstrom, auf den sie zeigen.
   */
  it("haelt die Reihenfolge, an der die Fremdschluessel haengen", () => {
    const pos = (model: string, where?: Record<string, unknown>) =>
      TENANT_TEARDOWN_ORDER.findIndex(
        (s) => s.model === model && (where === undefined || s.where?.["level"] === where["level"]),
      );
    expect(pos("initiative", { level: 1 })).toBeLessThan(pos("initiative", { level: 0 }));
    expect(pos("solution")).toBeLessThan(pos("valueStream"));
    expect(pos("stageGateApproverRule")).toBeLessThan(pos("valueStream"));
    expect(pos("stageGateApproval")).toBeLessThan(pos("stageGateTransition"));
    expect(pos("art")).toBeLessThan(pos("valueStream"));
  });

  it("die Mitgliedschaften stehen ausserhalb der Liste", () => {
    // Ein Reseed laesst die Leute stehen, ein Loeschen nimmt sie mit. Staenden
    // sie in der Liste, verloere jeder Seed-Lauf die Zugaenge des Mandanten.
    expect(TENANT_TEARDOWN_ORDER.map((s) => s.model)).not.toContain("userRoleAssignment");
  });
});

/** Ein Doppel, das jede `deleteMany` mitschreibt, statt sie auszufuehren. */
function protokollClient(): { db: TeardownClient; rufe: { model: string; where: unknown }[] } {
  const rufe: { model: string; where: unknown }[] = [];
  const handler: ProxyHandler<object> = {
    get: (_t, model: string) => ({
      deleteMany: ({ where }: { where: Record<string, unknown> }) => {
        rufe.push({ model, where });
        return Promise.resolve({ count: 1 });
      },
    }),
  };
  return { db: new Proxy({}, handler) as unknown as TeardownClient, rufe };
}

describe("wipeTenantData", () => {
  it("filtert jeden Schritt auf den Mandanten", async () => {
    const { db, rufe } = protokollClient();
    await wipeTenantData(db, "t-1");
    expect(rufe).toHaveLength(TENANT_TEARDOWN_ORDER.length);
    expect(rufe.every((r) => (r.where as { tenantId: string }).tenantId === "t-1")).toBe(true);
  });

  it("nimmt die Mitgliedschaften nur auf Verlangen mit", async () => {
    const ohne = protokollClient();
    await wipeTenantData(ohne.db, "t-1");
    expect(ohne.rufe.map((r) => r.model)).not.toContain("userRoleAssignment");

    const mit = protokollClient();
    await wipeTenantData(mit.db, "t-1", { includeMembers: true });
    expect(mit.rufe.at(-1)?.model).toBe("userRoleAssignment");
  });

  it("zaehlt die beiden Initiative-Ebenen auf dasselbe Modell zusammen", async () => {
    const { db } = protokollClient();
    const res = await wipeTenantData(db, "t-1");
    // Das Doppel meldet je Aufruf 1 — zwei Ebenen, also 2.
    expect(res.deleted["initiative"]).toBe(2);
    expect(res.total).toBe(TENANT_TEARDOWN_ORDER.length);
  });

  it("bricht ab, wenn die Liste ein Delegate nennt, das es nicht gibt", async () => {
    const leer = {} as TeardownClient;
    await expect(wipeTenantData(leer, "t-1")).rejects.toThrow(/Raeum-Liste und Schema/);
  });
});
