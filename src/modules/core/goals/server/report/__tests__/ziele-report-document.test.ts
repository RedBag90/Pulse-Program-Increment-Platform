import { describe, it, expect } from "vitest";
import { renderZieleReport } from "@/modules/core/goals/server/report/ziele-report-document";
import { buildZieleReport, type ZieleReportNode } from "@/modules/core/goals/domain/ziele-report";
import { catalogTranslate } from "@/test/helpers/catalog";
import type { Locale } from "@/i18n/routing";

/**
 * **Ein Rauch-Test, und er ist mehr wert als er aussieht.**
 *
 * Ein `@react-pdf`-Dokument scheitert nicht beim Typprüfen, sondern beim
 * Rendern: ein Style, den das Layout nicht kennt, ein `View` an falscher
 * Stelle, eine `render`-Funktion mit falscher Signatur. Ohne diesen Test fiele
 * das erst auf, wenn jemand auf den Knopf drückt.
 *
 * Geprüft wird darum nicht das Aussehen — das entscheidet das Auge —, sondern
 * dass am Ende wirklich ein PDF herauskommt.
 *
 * **Und zwar in beiden Sprachen.** Der Übersetzer kommt aus dem echten
 * Katalog und wirft bei einem fehlenden Schlüssel. Damit prüft jeder Durchlauf
 * nebenbei etwas, das sonst niemand prüfen würde: dass der Bericht keinen
 * Schlüssel anfasst, den es nicht gibt. Das ist die Ausfallart, vor der
 * ADR-0024 warnt — sie wirft zur Laufzeit nicht, sie druckt den Schlüssel
 * aufs Papier.
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

/** Ein Baum mit `n` Top-Zielen, jedes mit zwei Unterzielen. */
function baum(n: number): ZieleReportNode[] {
  return Array.from({ length: n }, (_, i) =>
    node({
      id: `t${i}`,
      title: `Thema ${i} — Straße & Größe`,
      status: i % 2 === 0 ? "on_track" : "off_track",
      progress: i / Math.max(n - 1, 1),
      period: "2026-Q3",
      trio: { planned: 12_300, realized: 8_100 },
      children: [
        node({ id: `t${i}a`, title: `Unterziel ${i}a`, progress: 0.5 }),
        node({ id: `t${i}b`, title: `Unterziel ${i}b` }),
      ],
    }),
  );
}

function pdf(themes: ZieleReportNode[], locale: Locale = "de"): Promise<Buffer> {
  const t = catalogTranslate(locale);
  const report = buildZieleReport(
    { themes, periods: ["2026-Q3"], valueStreamIds: [], artIds: [], statuses: [] },
    {
      tenantName: "Muster GmbH",
      userLabels: {},
      valueStreamNames: {},
      artNames: {},
      now: JETZT,
      t,
      locale,
    },
  );
  return renderZieleReport(report, t, locale);
}

describe("ZieleReportDocument", () => {
  it("rendert ein PDF", async () => {
    const buffer = await pdf(baum(3));
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("rendert auch einen leeren Bericht", async () => {
    // Der Fall, in dem ein Filter nichts übrig lässt. Er darf keinen Wurf
    // ergeben — ein Bericht mit Kopf und dem Satz „keine Ziele" ist eine
    // Antwort, ein Fehlerdialog ist keine.
    const buffer = await pdf([]);
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
  });

  it("rendert denselben Bericht auf Englisch", async () => {
    // Der Beweis, dass die Naht trägt: dieselbe Ableitung, dasselbe Dokument,
    // ein anderer Übersetzer — und kein Schlüssel, den `en.json` nicht kennt.
    const buffer = await pdf(baum(3), "en");
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(1000);
  });

  it("trägt über mehrere Seiten", async () => {
    // Der eigentliche Anlass des ganzen Zuges: viele Zeilen. Wenn das Layout
    // beim Umbruch bricht, bricht es hier.
    const buffer = await pdf(baum(40));
    expect(buffer.subarray(0, 5).toString("latin1")).toBe("%PDF-");
    expect(buffer.length).toBeGreaterThan(5000);
  });
}, 30_000);
