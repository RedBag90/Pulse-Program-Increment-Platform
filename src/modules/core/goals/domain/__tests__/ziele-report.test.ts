import { describe, it, expect } from "vitest";
import { identityTranslate } from "@/i18n/translate";
import {
  buildZieleReport,
  type ZieleReportContext,
  type ZieleReportNode,
  type ZieleReportTree,
} from "@/modules/core/goals/domain/ziele-report";

/**
 * **Was auf dem Papier steht.**
 *
 * Die Ableitung trägt die Logik des Berichts; das Dokument daneben legt sie nur
 * noch aufs Blatt. Geprüft wird hier deshalb alles, was inhaltlich schiefgehen
 * kann — vor allem die zwei Arten, mit denen ein Bericht lügen könnte: eine
 * verschwiegene Filterung, und Kennzahlen, die anders gerechnet sind als am
 * Bildschirm.
 *
 * **Geprüft werden Schlüssel, keine Wörter.** Der Bericht bekommt
 * {@link identityTranslate} gereicht, also einen Übersetzer, der den Schlüssel
 * zurückgibt. Eine Zusicherung auf `"goals.status.atRisk"` überlebt damit jede
 * Umformulierung des Textes und wird rot, wenn jemand den Schlüssel ändert —
 * genau die Empfindlichkeit, die dieser Test haben soll. Was hier steht, sagt
 * nichts mehr darüber aus, wie der Bericht klingt, sondern was er meint.
 */

const JETZT = new Date("2026-09-23T10:00:00.000Z");

function node(over: Partial<ZieleReportNode> = {}): ZieleReportNode {
  return {
    id: "g1",
    title: "Kundenzufriedenheit erhöhen",
    ownerId: null,
    status: null,
    progress: null,
    period: null,
    periodStart: null,
    periodEnd: null,
    trio: { planned: 0, realized: 0 },
    children: [],
    ...over,
  };
}

function tree(over: Partial<ZieleReportTree> = {}): ZieleReportTree {
  return {
    themes: [],
    periods: [],
    valueStreamIds: [],
    artIds: [],
    statuses: [],
    ...over,
  };
}

function ctx(over: Partial<ZieleReportContext> = {}): ZieleReportContext {
  return {
    tenantName: "Muster GmbH",
    userLabels: {},
    valueStreamNames: {},
    artNames: {},
    now: JETZT,
    t: identityTranslate,
    locale: "de",
    ...over,
  };
}

describe("buildZieleReport — der Baum", () => {
  it("legt ihn vorbestellt flach und behält die Tiefe", () => {
    const t = tree({
      themes: [
        node({
          id: "a",
          title: "A",
          children: [
            node({ id: "a1", title: "A1", children: [node({ id: "a11", title: "A11" })] }),
            node({ id: "a2", title: "A2" }),
          ],
        }),
        node({ id: "b", title: "B" }),
      ],
    });

    expect(buildZieleReport(t, ctx()).rows.map((r) => [r.title, r.depth])).toEqual([
      ["A", 0],
      ["A1", 1],
      ["A11", 2],
      ["A2", 1],
      ["B", 0],
    ]);
  });

  it("zählt alle Ebenen als Ziele, nicht nur die obersten", () => {
    const t = tree({ themes: [node({ children: [node({ id: "k" })] })] });
    expect(buildZieleReport(t, ctx()).summary.goalCount).toBe(2);
  });

  it("macht aus einem leeren Baum einen Kopf ohne Zeilen — keinen Wurf", () => {
    const bericht = buildZieleReport(tree(), ctx());
    expect(bericht.rows).toEqual([]);
    expect(bericht.summary.goalCount).toBe(0);
    expect(bericht.summary.averageProgress).toBe("—");
    expect(bericht.tenantName).toBe("Muster GmbH");
    expect(bericht.generatedAt).toBe("23.09.2026");
  });
});

describe("buildZieleReport — eine Zeile", () => {
  it("schreibt einen Strich, wo nichts gepflegt ist", () => {
    // Auf Papier kann man nicht nachschlagen, ob die Zelle leer ist, weil
    // nichts da war oder weil die Anzeige versagt hat. Der Strich sagt es.
    const [row] = buildZieleReport(tree({ themes: [node()] }), ctx()).rows;
    expect(row).toMatchObject({
      owner: "—",
      status: "goals.tier.neutral",
      statusTier: "neutral",
      progress: "—",
      value: "—",
      timeframe: "—",
    });
  });

  it("löst Owner, Status, Fortschritt und Zeitraum auf", () => {
    const t = tree({
      themes: [
        node({
          ownerId: "u1",
          status: "at_risk",
          progress: 0.716,
          period: "2026-Q3",
          trio: { planned: 12_300, realized: 8_100 },
        }),
      ],
    });
    const [row] = buildZieleReport(t, ctx({ userLabels: { u1: "Anna Weber" } })).rows;

    expect(row).toMatchObject({
      owner: "Anna Weber",
      status: "goals.status.atRisk",
      statusTier: "amber",
      progress: "72 %",
      timeframe: "Q3 2026",
    });
    // Ist vor Soll — dieselbe Lesart wie die Spalte „Wert“ am Bildschirm.
    expect(row?.value).toContain("8");
    expect(row?.value).toMatch(/\//);
  });

  it("lässt einen eigenen Zeitraum den Quartals-Eimer schlagen", () => {
    const t = tree({
      themes: [node({ period: "2026-Q3", periodStart: "2026-02-01", periodEnd: "2026-05-31" })],
    });
    expect(buildZieleReport(t, ctx()).rows[0]?.timeframe).toBe("2026-02-01 – 2026-05-31");
  });
});

describe("buildZieleReport — das Filter-Echo", () => {
  it("sagt „alle“, wo nichts gefiltert ist", () => {
    expect(buildZieleReport(tree(), ctx()).filters).toEqual({
      periods: "goals.report.all",
      valueStreams: "goals.report.all",
      arts: "goals.report.all",
      statuses: "goals.report.all",
    });
  });

  it("nennt Wertströme und ARTs beim Namen, nicht bei der Id", () => {
    // Ein Bericht zeigt einen Ausschnitt. Verschweigt er das, behauptet er
    // etwas Falsches — und eine UUID im Kopf sagt niemandem, welcher.
    const t = tree({ valueStreamIds: ["vs-1"], artIds: ["art-1"] });
    const bericht = buildZieleReport(
      t,
      ctx({ valueStreamNames: { "vs-1": "Zahlungsverkehr" }, artNames: { "art-1": "Kasse" } }),
    );

    expect(bericht.filters.valueStreams).toBe("Zahlungsverkehr");
    expect(bericht.filters.arts).toBe("Kasse");
  });

  it("lässt eine Id stehen, zu der es keinen Namen gibt", () => {
    // Lieber ein unschöner Schlüssel im Kopf als ein verschwiegener Filter.
    const t = tree({ valueStreamIds: ["vs-weg"] });
    expect(buildZieleReport(t, ctx()).filters.valueStreams).toBe("vs-weg");
  });

  it("beschriftet Zeiträume und Status lesbar — auch den Sentinel", () => {
    const t = tree({ periods: ["2026-Q3", "2027"], statuses: ["on_track", "none"] });
    const f = buildZieleReport(t, ctx()).filters;

    // Ein Jahres-Eimer heisst „FY 2027" — dieselbe Beschriftung wie im Filter.
    expect(f.periods).toBe("Q3 2026, FY 2027");
    // `none` ist eine Auswahl („ohne Status"), kein Fehlen.
    expect(f.statuses).toBe("goals.status.onTrack, goals.tier.neutral");
  });
});

describe("buildZieleReport — die Kopfzahlen", () => {
  it("mittelt über die Top-Ziele, nicht über den ganzen Baum", () => {
    // Genau wie der Health-Strip. Über alle Ebenen gemittelt zöge ein Ziel mit
    // vielen Unterzielen den Schnitt zu sich, und dieselbe Zahl stünde auf
    // Papier und Bildschirm verschieden da.
    const t = tree({
      themes: [
        node({ id: "a", progress: 1, children: [node({ id: "a1", progress: 0 })] }),
        node({ id: "b", progress: 0.5 }),
      ],
    });
    // Top-Ziele: 1 und 0,5 ⇒ 75 %. Über alle vier Knoten wären es 50 %.
    expect(buildZieleReport(t, ctx()).summary.averageProgress).toBe("75 %");
  });

  it("lässt nicht messbare Top-Ziele aus dem Schnitt heraus", () => {
    const t = tree({ themes: [node({ id: "a", progress: 0.4 }), node({ id: "b" })] });
    expect(buildZieleReport(t, ctx()).summary.averageProgress).toBe("40 %");
  });

  it("verteilt die Top-Ziele auf die vier Stufen, in der Reihenfolge des Strips", () => {
    const t = tree({
      themes: [
        node({ id: "a", status: "on_track" }),
        node({ id: "b", status: "off_track" }),
        node({ id: "c", status: "off_track" }),
        node({ id: "d" }),
      ],
    });
    expect(buildZieleReport(t, ctx()).summary.tiers).toEqual([
      { tier: "green", label: "goals.tier.green", count: 1 },
      { tier: "amber", label: "goals.tier.amber", count: 0 },
      { tier: "rose", label: "goals.tier.rose", count: 2 },
      { tier: "neutral", label: "goals.tier.neutral", count: 1 },
    ]);
  });
});
