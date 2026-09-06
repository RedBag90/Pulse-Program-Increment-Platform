import { describe, it, expect } from "vitest";
import {
  layoutFunnel,
  fitFunnel,
  findCollisions,
  clipCode,
  halfAt,
  stationsOf,
  DEFAULT_GEOMETRY,
  CODE_STEPS,
  type FunnelItem,
} from "@/modules/work/features/portfolio/lib/horizon-funnel";
import type { Horizon } from "@/modules/work/domain/portfolio-guardrails";

const sol = (
  id: string,
  horizon: Horizon | null,
  invest: number,
  run = 0,
  mode: "investing" | "extracting" | null = null,
  code = id.toUpperCase(),
): FunnelItem => ({
  id,
  kind: "solution",
  code,
  name: `Solution ${id}`,
  horizon,
  mode,
  invest,
  run,
});

/** Die gemessene Lage aus Pulse Demo Corp. */
const DEMO: FunnelItem[] = [
  sol("cx-rd", "h3", 1_130_000),
  sol("pp-rd", "h3", 460_000),
  sol("db-rd", "h3", 0),
  sol("db-mvp", "h2", 980_000),
  sol("cx-mvp", "h2", 460_000),
  sol("pp-mvp", "h2", 190_000),
  sol("cx-core", "h1", 490_000, 400_000, "investing"),
  sol("pp-core", "h1", 510_000, 350_000, "extracting"),
  sol("db-core", "h1", 480_000, 300_000, "investing"),
  sol("db-leg", "h0", 0),
];

/** Large Test Corp — der Fall, in dem die Zeichnung nichts mehr zeigte. */
const LARGE: FunnelItem[] = [
  sol("vo-pilot", "h3", 1_560_000, 0, null, "V&O · Pilot"),
  sol("p-pilot", "h3", 1_248_000, 0, null, "P · Pilot"),
  sol("l-pilot", "h3", 0, 0, null, "L · Pilot"),
  sol("l-prog", "h2", 1_456_000, 56_500, null, "L · Programm"),
  sol("p-prog", "h2", 1_200_000, 0, null, "P · Programm"),
  sol("vo-prog", "h2", 0, 0, null, "V&O · Programm"),
  sol("l-betr", "h1", 1_680_000, 60_000, "extracting", "L · Betrieb"),
  sol("p-betr", "h1", 1_320_000, 70_000, "extracting", "P · Betrieb"),
  sol("vo-betr", "h1", 0, 50_000, "extracting", "V&O · Betrieb"),
  {
    ...sol("e-einkauf", "h3", 120_000),
    kind: "epic" as const,
    code: "V&O · Indirekten Einkauf bündeln — Rollout Standort A",
  },
  {
    ...sol("e-rechnung", "h3", 120_000),
    kind: "epic" as const,
    code: "V&O · Rechnungsworkflow digitalisieren — Rollout Werk Süd",
  },
  {
    ...sol("e-scrap", "h3", 96_000),
    kind: "epic" as const,
    code: "P · Ausschuss-/Scrap-Reduktion — Rollout Region West",
  },
];

const TARGET = 1100;

describe("Senkrecht steht das Geld", () => {
  it("verhält sich streng proportional zwischen zwei Stationen", () => {
    // Seit H1 in Investing und Extracting zerfällt, ist die Station die
    // Bezugsgröße — jede führt ihr eigenes Geld und ihre eigene Öffnung.
    const layout = layoutFunnel(DEMO);
    const by = Object.fromEntries(layout.bands.map((b) => [b.horizon, b]));
    expect(by.h3!.money).toBe(1_590_000);
    expect(by.h1!.money).toBe(2_530_000);

    const zonen = layout.bands.flatMap((b) => b.stations).filter((z) => z.money > 0);
    expect(zonen.length).toBeGreaterThan(1);
    const bezug = zonen[0]!;
    for (const z of zonen) {
      expect(z.half / bezug.half).toBeCloseTo(z.money / bezug.money, 5);
    }
  });

  it("gibt einem Horizont ohne Geld die Mindestöffnung — und sagt es", () => {
    const layout = layoutFunnel(DEMO);
    const h0 = layout.bands.find((b) => b.horizon === "h0")!;
    expect(h0.money).toBe(0);
    expect(h0.minimal).toBe(true);
    // Die kleinste Öffnung des Bildes — der genaue Wert hängt daran, ob ein
    // gedrängtes Band alle Öffnungen gemeinsam geweitet hat.
    for (const b of layout.bands) expect(h0.half).toBeLessThanOrEqual(b.half + 1e-6);
  });

  it("ist ohne Gedränge exakt die Mindestöffnung", () => {
    const layout = layoutFunnel([sol("a", "h1", 1_000_000), sol("b", "h3", 400_000)]);
    const h0 = layout.bands.find((b) => b.horizon === "h0")!;
    expect(layout.bands.every((b) => !b.enlarged)).toBe(true);
    expect(h0.half).toBe(DEFAULT_GEOMETRY.minHalf);
  });

  it("vergrössert eine zu enge Öffnung — und kennzeichnet das", () => {
    // Die Größe wächst mit √Geld, die Öffnung linear. Für kleine Beträge
    // gewinnt die Wurzel, und das Symbol ragte aus den Kurven.
    // Ein armes Band mit **einem grossen** Symbol: sein Geld reicht für 15 px
    // Öffnung, das Symbol ist aber 94 px hoch.
    const arm = layoutFunnel([
      ...Array.from({ length: 3 }, (_, k) => sol(`r${k}`, "h1", 1_000_000)),
      sol("arm", "h3", 1_000_000),
    ]);
    const h3 = arm.bands.find((b) => b.horizon === "h3")!;
    const h1 = arm.bands.find((b) => b.horizon === "h1")!;
    expect(h3.enlarged).toBe(true);
    expect(h1.enlarged).toBe(false);
    expect(h3.minimal).toBe(false);
    // Und die Zusicherung, für die die Klammer da ist:
    const sym = arm.items.find((i) => i.id === "arm")!;
    expect(sym.cy + sym.size).toBeLessThanOrEqual(arm.mid + h3.half + 1e-6);
  });

  it("zählt das Geld produktloser Epics in ihr Band mit", () => {
    const withEpic = layoutFunnel([
      ...DEMO,
      { ...sol("e1", "h2", 240_000), kind: "epic" as const },
    ]);
    expect(withEpic.bands.find((b) => b.horizon === "h2")!.money).toBe(1_870_000);
  });
});

describe("Waagerecht steht nichts — die Breite misst kein Geld", () => {
  it("gibt gleich vielen Symbolen gleiche Breite, egal wie verschieden das Geld ist", () => {
    // Die Zusicherung, um die es geht. Die naheliegende Regel „Breite =
    // Platzbedarf" verletzt sie unbemerkt: ein reiches Band stapelt in weniger
    // Spalten und würde dadurch schmaler — die Breite kodierte das Geld invers.
    const spread = [
      sol("a1", "h3", 30_000),
      sol("a2", "h3", 30_000),
      sol("a3", "h3", 30_000),
      sol("b1", "h2", 300_000),
      sol("b2", "h2", 300_000),
      sol("b3", "h2", 300_000),
      sol("c1", "h1", 3_000_000),
      sol("c2", "h1", 3_000_000),
      sol("c3", "h1", 3_000_000),
    ];
    const bands = layoutFunnel(spread).bands.filter((b) => b.horizon !== "h0");
    // Verglichen wird die **Station**, nicht das Band: H1 belegt zwei davon.
    const widths = bands.map((b) => (b.x1 - b.x0) / stationsOf(b.horizon).length);
    for (const w of widths) expect(w).toBeCloseTo(widths[0]!, 6);

    // …während der Abstand sehr wohl skaliert. Er ist aber nach unten durch die
    // Mindestöffnung gedeckelt: gegenüber 3 Mio € liegen 300 T€ **und** 30 T€
    // beide unter dem, was die Zeichnung auflösen kann, und fallen deshalb
    // zusammen. Das ist die benannte Grenze, keine Verwechslung — vorher trennte
    // sie nur die Symbolgröße, also eine Größe, die gar nicht die Bahn meint.
    const halves = bands.map((b) => b.half);
    expect(halves[2]!).toBeGreaterThan(halves[1]!);
    expect(halves[1]!).toBe(halves[0]!);
  });

  it("gibt gleich breite Bänder, egal wie viele Symbole sie tragen", () => {
    // Bis September 2026 war die Breite **streng proportional zur Anzahl**.
    // Damit trug die waagerechte Achse eine Aussage, die die Zeichnung nie
    // machen wollte: in Large Test Corp bekam H3 mit 16 kleinen Posten 73 % der
    // Breite, während H1 mit dem meisten Geld auf 14 % sass.
    const layout = layoutFunnel([
      sol("a1", "h3", 100_000),
      sol("a2", "h3", 100_000),
      sol("a3", "h3", 100_000),
      sol("a4", "h3", 100_000),
      sol("b1", "h1", 100_000),
      sol("b2", "h1", 100_000),
    ]);
    const h3 = layout.bands.find((b) => b.horizon === "h3")!;
    const h1 = layout.bands.find((b) => b.horizon === "h1")!;
    // H1 belegt zwei Stationen — je Station sind sie gleich breit.
    expect((h3.x1 - h3.x0) / ((h1.x1 - h1.x0) / 2)).toBeCloseTo(1, 5);
  });

  it("hält die Öffnungen im Verhältnis des Geldes, auch wenn ein Band gedrängt ist", () => {
    // Der Kern des Umbaus. Klammerte man je Band, wanderte die Verzerrung nur
    // von der Breite in die Höhe: H3 mit 16 kleinen Posten bekäme eine weitere
    // Öffnung als H1 mit dem meisten Geld. Ein **gemeinsamer** Faktor weitet
    // alle Öffnungen und lässt ihr Verhältnis exakt das des Geldes bleiben.
    const layout = layoutFunnel([
      ...Array.from({ length: 16 }, (_, k) => sol(`viele${k}`, "h3", 88_500)),
      sol("m1", "h2", 1_100_000),
      sol("c1", "h1", 1_500_000),
    ]);
    const by = Object.fromEntries(layout.bands.map((b) => [b.horizon, b]));
    expect(by.h3!.money).toBe(1_416_000);
    expect(by.h3!.enlarged).toBe(true);
    // H1 trägt das meiste Geld — also hat es die weiteste Öffnung.
    expect(by.h1!.half).toBeGreaterThan(by.h3!.half);
    expect(by.h1!.half / by.h3!.half).toBeCloseTo(1_500_000 / 1_416_000, 5);
    expect(by.h2!.half / by.h1!.half).toBeCloseTo(1_100_000 / 1_500_000, 5);
    // …und die Stationen bleiben trotzdem gleich breit (H1 belegt zwei).
    expect(by.h3!.x1 - by.h3!.x0).toBeCloseTo((by.h1!.x1 - by.h1!.x0) / 2, 6);
  });

  it("lässt ein Band ohne Geld die Öffnungen der anderen nicht aufblasen", () => {
    // Die Mindestöffnung ist ein Platzhalter, keine Aussage über Geld. Rechnete
    // man den Inhalt eines leeren Bandes gegen sie, triebe er den gemeinsamen
    // Faktor: gemessen riss ein leeres H3 mit drei Umrissen die Öffnung von H1
    // von 150 auf 248 — und mit ihr die Kürzung von 18 auf 8 Zeichen.
    const mitLeerem = layoutFunnel([
      sol("leer1", "h3", 0),
      sol("leer2", "h3", 0),
      sol("leer3", "h3", 0),
      sol("reich", "h1", 1_000_000),
    ]);
    const ohneLeeres = layoutFunnel([sol("reich", "h1", 1_000_000)]);
    const h1 = (l: typeof mitLeerem) => l.bands.find((b) => b.horizon === "h1")!.half;
    expect(h1(mitLeerem)).toBe(h1(ohneLeeres));
    expect(h1(mitLeerem)).toBe(DEFAULT_GEOMETRY.maxHalf);
    // Das leere Band fasst seinen Inhalt trotzdem — nur eben für sich.
    const h3 = mitLeerem.bands.find((b) => b.horizon === "h3")!;
    expect(h3.minimal).toBe(true);
    for (const i of mitLeerem.items.filter((x) => x.horizon === "h3")) {
      expect(i.box.y).toBeGreaterThanOrEqual(mitLeerem.mid - h3.half - 1e-6);
      expect(i.box.y + i.box.h).toBeLessThanOrEqual(mitLeerem.mid + h3.half + 1e-6);
    }
  });

  it("lässt der Beschriftung über der Kurve immer ihren Platz", () => {
    // Die Luft über der weitesten Öffnung ergab sich früher aus `mid − maxHalf`
    // und war damit unsichtbar. Wächst die Öffnung, muss die Mittellinie
    // ausweichen — sonst schöbe sich die Kurve unter Bandname und Betrag.
    for (const items of [
      DEMO,
      LARGE,
      Array.from({ length: 40 }, (_, k) => sol(`v${k}`, "h3", 50_000)),
    ]) {
      const layout = layoutFunnel(items);
      expect(layout.mid - layout.maxHalf).toBeGreaterThanOrEqual(DEFAULT_GEOMETRY.headroom - 1e-6);
    }
  });

  it("lässt auch ein gedrängtes Band nichts aus den Kurven ragen", () => {
    const layout = layoutFunnel([
      ...Array.from({ length: 16 }, (_, k) => sol(`viele${k}`, "h3", 88_500)),
      sol("c1", "h1", 1_500_000),
    ]);
    for (const i of layout.items) {
      const band = layout.bands.find((b) => b.horizon === i.horizon)!;
      expect(i.box.y).toBeGreaterThanOrEqual(layout.mid - band.half - 1e-6);
      expect(i.box.y + i.box.h).toBeLessThanOrEqual(layout.mid + band.half + 1e-6);
    }
    expect(layout.collisions).toEqual([]);
  });

  it("nimmt ein leeres Band aus der Aufteilung heraus", () => {
    // Sonst bestimmt der leere Horizont die Größe des ganzen Bildes: in Large
    // Test Corp brauchte H0 64 px, riss die Grundbreite aber auf 1620 px.
    const h0 = layoutFunnel(LARGE).bands.find((b) => b.horizon === "h0")!;
    expect(h0.x1 - h0.x0).toBe(DEFAULT_GEOMETRY.stubWidth);
  });

  it("gibt einem Band mit einem einzigen Symbol seinen Anteil, keinen Stummel", () => {
    const h0 = layoutFunnel(DEMO).bands.find((b) => b.horizon === "h0")!;
    expect(h0.x1 - h0.x0).toBeGreaterThan(DEFAULT_GEOMETRY.stubWidth);
  });
});

describe("Die Packung", () => {
  it("platziert alles und überschneidet nichts", () => {
    const l = layoutFunnel(DEMO);
    expect(l.items).toHaveLength(DEMO.length);
    expect(l.collisions).toEqual([]);
    expect(l.dropped).toEqual([]);
  });

  it("hält jedes Symbol innerhalb der Kurven", () => {
    const { items, profile } = layoutFunnel(DEMO);
    for (const i of items) {
      const half = halfAt(profile, i.cx);
      expect(i.cy - i.size).toBeGreaterThanOrEqual(DEFAULT_GEOMETRY.mid - half - 1e-6);
      expect(i.cy + i.size).toBeLessThanOrEqual(DEFAULT_GEOMETRY.mid + half + 1e-6);
    }
  });

  it("hält jedes Symbol innerhalb seines Bandes", () => {
    const { items, bands } = layoutFunnel(DEMO);
    for (const i of items) {
      const band = bands.find((b) => b.horizon === i.horizon)!;
      expect(i.box.x).toBeGreaterThanOrEqual(band.x0 - 1e-6);
      expect(i.box.x + i.box.w).toBeLessThanOrEqual(band.x1 + 1e-6);
    }
  });

  it("ist deterministisch und ordnungsunabhängig", () => {
    expect(layoutFunnel(DEMO)).toEqual(layoutFunnel(DEMO));
    const reversed = layoutFunnel([...DEMO].reverse());
    expect(reversed.items.map((i) => i.id)).toEqual(layoutFunnel(DEMO).items.map((i) => i.id));
    expect(reversed.width).toBeCloseTo(layoutFunnel(DEMO).width, 6);
  });

  it("macht die Fläche ∝ Geld: doppelte Kante = vierfaches Geld", () => {
    const { items } = layoutFunnel([sol("a", "h1", 1_000_000), sol("b", "h1", 250_000)]);
    const span = (id: string) => items.find((i) => i.id === id)!.size - DEFAULT_GEOMETRY.emptySize;
    expect(span("a") / span("b")).toBeCloseTo(2, 5);
  });

  it("gibt einem Produkt ohne Geld ein sichtbares Mindestmaß", () => {
    const leg = layoutFunnel(DEMO).items.find((i) => i.id === "db-leg")!;
    expect(leg.total).toBe(0);
    expect(leg.size).toBe(DEFAULT_GEOMETRY.emptySize);
  });

  it("bleibt leer und ruhig, wenn es nichts zu zeichnen gibt", () => {
    const empty = layoutFunnel([]);
    expect(empty.items).toEqual([]);
    expect(empty.collisions).toEqual([]);
    expect(empty.dropped).toEqual([]);
    expect(empty.bands).toHaveLength(4);
    expect(empty.bands.every((b) => b.minimal)).toBe(true);
  });
});

describe("Nichts verschwindet stumm", () => {
  const sizes = [1, 12, 30, 50];
  const many = (n: number): FunnelItem[] =>
    Array.from({ length: n }, (_, k) =>
      sol(`s${k}`, (["h3", "h2", "h1", "h0"] as const)[k % 4]!, 100_000 * (k + 1)),
    );

  it.each([
    ...sizes.map((n) => [`${n} Symbole`, many(n)] as const),
    ["leer", [] as FunnelItem[]] as const,
  ])("%s: items + homeless + dropped ist die Eingabemenge", (_label, input) => {
    const l = fitFunnel(input, TARGET);
    const ids = [...l.items, ...l.homeless].map((i) => i.id).concat(l.dropped.map((i) => i.id));
    expect(ids.sort()).toEqual(input.map((i) => i.id).sort());
    expect(l.dropped).toEqual([]);
    expect(l.collisions).toEqual([]);
  });
});

describe("Der Large-Test-Corp-Fall", () => {
  it("platziert alle zwölf Symbole — vorher waren es null", () => {
    // Die Regression: lange Epic-Titel liessen die Packung scheitern, und weil
    // die Kollisionsprüfung nur über Platziertes läuft, blieb auch der Hinweis
    // leer. Die Fläche zeigte Bänder und Kurven, aber kein Symbol.
    const l = fitFunnel(LARGE, TARGET);
    expect(l.items).toHaveLength(LARGE.length);
    expect(l.dropped).toEqual([]);
    expect(l.collisions).toEqual([]);
  });

  it("bleibt lesbar: hoechstens eine leichte Stauchung", () => {
    // 11 px Schrift bei Zoom 0,98 sind 10,8 px — die Beschriftungen bleiben am
    // Symbol und wandern nicht in die Legende.
    expect(TARGET / fitFunnel(LARGE, TARGET).width).toBeGreaterThanOrEqual(0.9);
  });

  it("kürzt die langen Epic-Titel, statt an ihnen zu scheitern", () => {
    const l = fitFunnel(LARGE, TARGET);
    const epic = l.items.find((i) => i.id === "e-rechnung")!;
    expect(epic.label.length).toBeLessThanOrEqual(l.maxCodeLength);
    expect(epic.label.endsWith("…")).toBe(true);
    expect(epic.code).toContain("Rechnungsworkflow"); // der volle Name bleibt
  });
});

describe("fitFunnel — die gestufte Kürzung", () => {
  it("nimmt die ausführlichste Stufe, die lesbar bleibt", () => {
    expect(fitFunnel(DEMO, 10_000).maxCodeLength).toBe(CODE_STEPS[0]);
  });

  it("nimmt eine leichte Stauchung in Kauf, statt härter zu kürzen", () => {
    // Genau der Fall, der sonst „V&O · Pilot" und „V&O · Programm" beide zu
    // `V&O · P…` machte: zwei Produkte, ein Etikett.
    // Die Zusicherung ist die **Eindeutigkeit**, nicht eine bestimmte Stufe:
    // welche Stufe reicht, hängt an Schriftgröße und Stationsbreite.
    //
    // Sie gilt ab einer bestimmten Breite, und die ist gemessen: für diesen
    // Datensatz ab **1200 px** (bei 1100 fällt die Kürzung auf acht Zeichen und
    // „V&O · Pilot"/„V&O · Programm" werden beide zu `V&O · P…`). Seit der
    // Trichter seine Breite misst, statt sie zu raten, ist das die Breite einer
    // echten Karte — auf dem Schreibtisch 1200 bis 1700 px. Steigt die Schwelle
    // durch einen künftigen Umbau, wird dieser Test rot.
    const l = fitFunnel(LARGE, 1400);
    expect(l.maxCodeLength).not.toBe(CODE_STEPS[CODE_STEPS.length - 1]);
    expect(1400 / l.width).toBeGreaterThanOrEqual(0.8);
    const labels = l.items.map((i) => i.label);
    expect(new Set(labels).size).toBe(labels.length);

    // Und die Gegenprobe auf die gemessene Schwelle selbst.
    const knapp = fitFunnel(LARGE, 1200).items.map((i) => i.label);
    expect(new Set(knapp).size).toBe(knapp.length);
  });

  it("kürzt weiter, wenn es wirklich eng wird", () => {
    expect(fitFunnel(LARGE, 400).maxCodeLength).toBe(CODE_STEPS[CODE_STEPS.length - 1]);
  });
});

describe("clipCode", () => {
  it("lässt einen kurzen Code unangetastet", () => {
    expect(clipCode("CE · Core", 18)).toBe("CE · Core");
  });

  it("kappt mit Auslassungszeichen", () => {
    const clipped = clipCode("Rechnungsworkflow digitalisieren", 12);
    expect(clipped).toBe("Rechnungswo…");
    expect(clipped.length).toBeLessThanOrEqual(12); // `max` ist eine Obergrenze
  });

  it("lässt kein hängendes Satzzeichen stehen", () => {
    // Sonst entstehen Beschriftungen wie „P · Ausschuss-/Scrap-Reduktion —".
    expect(clipCode("Ausschuss-/Scrap — Rollout", 19)).toBe("Ausschuss-/Scrap…");
    expect(clipCode("Rollout Werk, Süd", 13)).toBe("Rollout Werk…");
  });
});

describe("Der Streifen für alles ohne Horizont", () => {
  const input = [...DEMO, { ...sol("e9", null, 90_000), kind: "epic" as const }];

  it("nimmt auf, was sich nicht platzieren lässt", () => {
    const { homeless, items } = layoutFunnel(input);
    expect(homeless.map((h) => h.id)).toEqual(["e9"]);
    expect(items.map((i) => i.id)).not.toContain("e9");
  });

  it("zählt sein Geld in keinem Band mit — genau das ist die Aussage", () => {
    expect(layoutFunnel(input).bands.map((b) => b.money)).toEqual(
      layoutFunnel(DEMO).bands.map((b) => b.money),
    );
  });
});

describe("Die Trennung H1.1 | H1.2", () => {
  it("liegt zwischen den beiden Gruppen, nicht quer durch sie", () => {
    const layout = layoutFunnel(DEMO);
    const x = layout.h1!.splitX;
    for (const i of layout.items.filter((i) => i.horizon === "h1")) {
      if (i.mode === "extracting") expect(i.box.x).toBeGreaterThanOrEqual(x - 1e-6);
      else expect(i.box.x + i.box.w).toBeLessThanOrEqual(x + 1e-6);
    }
  });

  it("steht auch dann, wenn eine der beiden Hälften leer ist", () => {
    // Der Fall aus Large Test Corp: **alle** H1-Produkte sind in der Ernte.
    // Vorher verschwand die Trennung dann ganz — und der Bandkopf behauptete
    // weiter „H1 · Investing". Eine leere Hälfte ist die Aussage.
    const nurErnte = layoutFunnel(
      DEMO.map((i) => (i.horizon === "h1" ? { ...i, mode: "extracting" as const } : i)),
    );
    expect(nurErnte.h1).not.toBeNull();
    expect(nurErnte.h1!.investing).toBe(0);
    expect(nurErnte.h1!.extracting).toBeGreaterThan(0);
    // Alles liegt rechts der Trennung, nichts überschreitet sie.
    for (const i of nurErnte.items.filter((i) => i.horizon === "h1")) {
      expect(i.box.x).toBeGreaterThanOrEqual(nurErnte.h1!.splitX - 1e-6);
    }
  });

  it("entfällt nur, wenn H1 überhaupt nichts trägt", () => {
    expect(layoutFunnel(DEMO.filter((i) => i.horizon !== "h1")).h1).toBeNull();
  });

  it("nennt das Geld beider Hälften getrennt", () => {
    const layout = layoutFunnel(DEMO);
    const h1 = layout.bands.find((b) => b.horizon === "h1")!;
    expect(layout.h1!.investing + layout.h1!.extracting).toBeCloseTo(h1.money, 6);
  });
});

describe("Fünf Stationen statt vier Bänder", () => {
  it("gibt H1 zwei Stationen, allen anderen eine", () => {
    expect(stationsOf("h1")).toEqual(["h1.1", "h1.2"]);
    expect(stationsOf("h3")).toEqual(["h3"]);
  });

  it("macht ein belegtes H1 doppelt so breit wie seine Nachbarn", () => {
    // Die Achse hat fünf Lebenszyklus-Stationen, nicht vier — dieselbe
    // Fünferleiter wie die Lebenszyklus-Leiste am Produkt.
    const layout = layoutFunnel([
      sol("a", "h3", 100_000),
      sol("b", "h2", 100_000),
      sol("c", "h1", 100_000, 0, "investing"),
      sol("d", "h1", 100_000, 0, "extracting"),
    ]);
    const w = (h: Horizon) => {
      const b = layout.bands.find((x) => x.horizon === h)!;
      return b.x1 - b.x0;
    };
    expect(w("h1") / w("h3")).toBeCloseTo(2, 5);
    expect(w("h2")).toBeCloseTo(w("h3"), 5);
  });

  it("hält die Trennung genau in der Bandmitte", () => {
    const layout = layoutFunnel([
      sol("a", "h3", 100_000),
      sol("c", "h1", 100_000, 0, "investing"),
      sol("d", "h1", 100_000, 0, "extracting"),
    ]);
    const h1 = layout.bands.find((b) => b.horizon === "h1")!;
    expect(layout.h1!.splitX).toBeCloseTo((h1.x0 + h1.x1) / 2, 5);
  });

  it("macht an der Trennung eine Stufe, wenn die Hälften Verschiedenes tragen", () => {
    // **Das ersetzt eine frühere Zusicherung.** Sie lautete: „ein Horizont, ein
    // Geld — an der Trennung darf die Kurve keine Stufe machen." Das war
    // richtig, solange nur der Horizont ein Ziel hatte. Seit die Guardrail
    // eigene Ziele für H1.1 und H1.2 trägt, ist ihr Geld eine eigene Größe —
    // und eine Ziel-Linie, die springt, während die Ist-Kurve flach
    // durchläuft, misst an dieser Stelle nichts.
    //
    // Die Betraege liegen bewusst beide **ueber** der Mindestoeffnung: bei
    // 900 zu 100 faengt der Bodensatz die kleinere Haelfte ab (40 statt 16,7),
    // und das Verhaeltnis waere dann 3,75 statt 9 — richtig gerechnet, aber
    // kein Beleg fuer die Stufe.
    const layout = layoutFunnel([
      sol("c", "h1", 900_000, 0, "investing"),
      sol("d", "h1", 300_000, 0, "extracting"),
    ]);
    const x = layout.h1!.splitX;
    const links = halfAt(layout.profile, x - 20);
    const rechts = halfAt(layout.profile, x + 20);
    expect(links / rechts).toBeCloseTo(3, 5);
  });

  it("zählt ein Epic ohne Modus zu H1.1 · Investing", () => {
    // Geld, das einem Epic zugeteilt ist, ist eine Investition; die Ernte ist
    // eine Eigenschaft des Produkts.
    const layout = layoutFunnel([{ ...sol("e", "h1", 50_000), kind: "epic" as const }]);
    expect(layout.h1!.investing).toBe(50_000);
    expect(layout.h1!.extracting).toBe(0);
  });
});

describe("Das Ziel-Profil — die Guardrail als zweite Silhouette", () => {
  const spread = [sol("a", "h3", 1_000_000), sol("b", "h2", 1_000_000), sol("c", "h1", 1_000_000)];
  const targets = { h3: 10, h2: 20, "h1.1": 30, "h1.2": 30, h0: 10 };

  it("liegt auf derselben Skala wie das Ist", () => {
    // Gleiches Geld, gleiche Oeffnung: bekommt ein Band genau den Anteil, den
    // es tatsaechlich haelt, muessen Ist- und Ziel-Linie zusammenfallen.
    const gleich = layoutFunnel(spread, DEFAULT_GEOMETRY, CODE_STEPS[0], {
      h3: 100 / 3,
      h2: 100 / 3,
      "h1.1": 100 / 3,
      "h1.2": 0,
      h0: 0,
    });
    const h3 = gleich.bands.find((b) => b.horizon === "h3")!;
    expect(halfAt(gleich.targetProfile!, (h3.x0 + h3.x1) / 2)).toBeCloseTo(h3.half, 6);
  });

  it("folgt den Anteilen, nicht dem Ist", () => {
    const l = layoutFunnel(spread, DEFAULT_GEOMETRY, CODE_STEPS[0], targets);
    const at = (st: string) => {
      const z = l.bands.flatMap((b) => b.stations).find((x) => x.station === st)!;
      return halfAt(l.targetProfile!, (z.x0 + z.x1) / 2);
    };
    // 30 : 20 : 10 — das Verhaeltnis der Vorgabe je Station, nicht das der drei
    // gleichen Ist-Betraege.
    expect(at("h1.1") / at("h2")).toBeCloseTo(1.5, 5);
    expect(at("h2") / at("h3")).toBeCloseTo(2, 5);
  });

  it("hebt ein kleines Ziel nicht auf die Mindestoeffnung an", () => {
    // Der Bodensatz ist ein Platzhalter fuer „kein Geld"; auf ein Ziel
    // angewandt behauptete er eine Vorgabe, die es nicht gibt.
    const l = layoutFunnel(spread, DEFAULT_GEOMETRY, CODE_STEPS[0], {
      h3: 1,
      h2: 33,
      "h1.1": 66,
      "h1.2": 0,
      h0: 0,
    });
    const h3 = l.bands.find((b) => b.horizon === "h3")!;
    expect(halfAt(l.targetProfile!, (h3.x0 + h3.x1) / 2)).toBeLessThan(DEFAULT_GEOMETRY.minHalf);
  });

  it("passt ins Bild, auch wenn es weiter reicht als jedes Ist-Band", () => {
    // Gemessen in Large Test Corp: das H1-Ziel liegt bei einer halben Oeffnung
    // von 401 px, das Ist bei 249. Wer nur das Ist misst, schneidet die
    // Vergleichslinie oben ab — genau dann, wenn der Abstand am groessten und
    // die Aussage am wichtigsten ist.
    const l = layoutFunnel(spread, DEFAULT_GEOMETRY, CODE_STEPS[0], {
      h3: 0,
      h2: 0,
      "h1.1": 100,
      "h1.2": 0,
      h0: 0,
    });
    const hoechste = Math.max(...l.targetProfile!.map(([, half]) => half));
    expect(hoechste).toBeGreaterThan(Math.max(...l.bands.map((b) => b.half)));
    // Nichts laeuft oben aus dem Bild, und die Kopffreiheit bleibt.
    expect(l.mid - hoechste).toBeGreaterThanOrEqual(DEFAULT_GEOMETRY.headroom - 1e-6);
  });

  it("entfaellt ohne Ziele und ohne Geld", () => {
    expect(layoutFunnel(spread).targetProfile).toBeNull();
    const ohneGeld = [sol("leer", "h1", 0)];
    expect(
      layoutFunnel(ohneGeld, DEFAULT_GEOMETRY, CODE_STEPS[0], targets).targetProfile,
    ).toBeNull();
  });
});

describe("findCollisions", () => {
  it("findet ein überlappendes Paar", () => {
    const box = (x: number) => ({
      ...sol("x", "h1", 1),
      total: 1,
      label: "X",
      size: 10,
      cx: x,
      cy: 0,
      box: { x, y: 0, w: 20, h: 20 },
    });
    expect(findCollisions([box(0), box(10)])).toHaveLength(1);
    expect(findCollisions([box(0), box(30)])).toEqual([]);
  });
});
