import { describe, it, expect } from "vitest";
import {
  ISSUE_FILTER_KEYS,
  criteriaFromParams,
  criteriaToParams,
  hasAnyCriteria,
} from "@/modules/risks/domain/issue-filter-keys";
import { parseFilterCriteria } from "@/server/services/saved-filter";

/**
 * Ein gespeicherter Issue-Filter trägt **Facetten, Suche und Ansicht**. Die
 * Einzelwerte reisen dabei in einem `string[]`, weil die geteilte Tabelle nur
 * diese Form kennt — die Umrechnung ist der Ort, an dem das entweder sauber
 * bleibt oder sich rächt.
 */
describe("Issue-Filter-Schlüssel", () => {
  const urlParams = (init: Record<string, string>) => {
    const p = new URLSearchParams(init);
    return (k: string) => p.get(k);
  };

  it("nimmt Mengen, Suche und Ansicht mit", () => {
    const c = criteriaFromParams(
      urlParams({
        roam: "owned,resolved",
        band: "critical",
        q: "Zoll",
        group: "exposure",
        density: "compact",
      }),
    );
    expect(c["roam"]).toEqual(["owned", "resolved"]);
    expect(c["band"]).toEqual(["critical"]);
    expect(c["q"]).toEqual(["Zoll"]);
    expect(c["group"]).toEqual(["exposure"]);
    expect(c["density"]).toEqual(["compact"]);
    expect(c["owner"]).toEqual([]);
  });

  /** Leere Schlüssel müssen aus der URL **verschwinden**, nicht leer dastehen. */
  it("macht aus leeren Schlüsseln `null`", () => {
    const params = criteriaToParams(criteriaFromParams(urlParams({ roam: "owned" })));
    expect(params["roam"]).toBe("owned");
    expect(params["owner"]).toBeNull();
    expect(params["q"]).toBeNull();
  });

  it("kommt hin und zurück beim selben Stand heraus", () => {
    const start = { roam: "owned,resolved", art: "a1", q: "Zoll", sort: "exposure:desc" };
    const zurueck = criteriaToParams(criteriaFromParams(urlParams(start)));
    for (const [k, v] of Object.entries(start)) expect(zurueck[k]).toBe(v);
  });

  it("erkennt den leeren Filter — der löst keine Umleitung aus", () => {
    expect(hasAnyCriteria(criteriaFromParams(urlParams({})))).toBe(false);
    expect(hasAnyCriteria(criteriaFromParams(urlParams({ density: "compact" })))).toBe(true);
  });

  /**
   * Der Versionierungs-Mechanismus des schemalosen Feldes: ein Datensatz, der
   * vor der Ansicht gespeichert wurde, kennt `group`/`density` nicht.
   */
  it("liest einen alten Datensatz ohne Ansichts-Schlüssel als leer", () => {
    const alt = parseFilterCriteria({ roam: ["owned"], band: ["high"] }, ISSUE_FILTER_KEYS);
    expect(alt["roam"]).toEqual(["owned"]);
    expect(alt["group"]).toEqual([]);
    expect(alt["density"]).toEqual([]);
    expect(criteriaToParams(alt)["group"]).toBeNull();
  });

  it("verwirft Fremdes im Blob", () => {
    const c = parseFilterCriteria({ roam: "owned", foo: ["bar"] }, ISSUE_FILTER_KEYS);
    expect(c["roam"]).toEqual([]);
    expect(c["foo"]).toBeUndefined();
  });
});
