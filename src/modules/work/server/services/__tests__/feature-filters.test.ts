import { describe, it, expect } from "vitest";
import { overviewFeatureWhere } from "@/modules/work/server/services/feature";
import type { TenantId } from "@/modules/core/kernel/domain/types";

const T = "t1" as TenantId;

describe("overviewFeatureWhere", () => {
  /**
   * **Die Zeile, auf die es ankommt.** Vorher lautete sie
   * `parent: { is: { valueStreamId } }` — ein Feature ohne Eltern-Epic hätte
   * darunter nie gematcht und wäre aus „Features fällig" verschwunden, sobald
   * jemand nach Wertstrom filtert. Der Wertstrom kommt jetzt vom ART, so wie
   * die Seite ihn auch anzeigt.
   */
  it("filtert den Wertstrom über das ART, nicht über das Eltern-Epic", () => {
    const where = overviewFeatureWhere(T, { valueStreamIds: ["vs1", "vs2"] });
    expect(where.art).toEqual({ is: { valueStreamId: { in: ["vs1", "vs2"] } } });
    expect(where.parent).toBeUndefined();
  });

  it("lässt die Wertstrom-Bedingung ganz weg, wenn nicht gefiltert wird", () => {
    const where = overviewFeatureWhere(T);
    expect(where.art).toBeUndefined();
    expect(where.parent).toBeUndefined();
  });

  /** Die übrigen Bedingungen sind unverändert — das ist hier die Zusicherung. */
  it("hält Mandant, Ebene, Papierkorb, PI-Pflicht und Status fest", () => {
    const where = overviewFeatureWhere(T, { statuses: ["approved"], ownerIds: ["u1"] });
    expect(where.tenantId).toBe(T);
    expect(where.level).toBe(1);
    expect(where.deletedAt).toBeNull();
    expect(where.piId).toEqual({ not: null });
    expect(where.ownerId).toEqual({ in: ["u1"] });
    // „completed"/„cancelled" bleiben immer draußen, auch wenn gefiltert wird.
    expect(where.status).toEqual({ notIn: ["completed", "cancelled"], in: ["approved"] });
  });
});
