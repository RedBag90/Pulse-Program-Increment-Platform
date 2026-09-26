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
  stripRowOf,
} from "@/modules/work/features/portfolio/lib/horizon-funnel";
import type { Horizon } from "@/modules/work/domain/portfolio-guardrails";

const sol = (
  id: string,
  horizon: Horizon | null,
  invest: number,
  run = 0,
  mode: "investing" | "extracting" | null = null,
  code = id.toUpperCase(),
  count = 0,
): FunnelItem => ({
  id,
  kind: "solution",
  code,
  name: `Solution ${id}`,
  horizon,
  mode,
  invest,
  run,
  count,
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

  it("hält jedes Symbol innerhalb der Kurven — an beiden Kanten", () => {
    // Gemessen wird an **beiden** Kanten des Kastens, nicht nur in seiner
    // Mitte: seit die Kurve an der Trennung H1.1 | H1.2 rundet, ist die
    // Öffnung über einem Symbol nicht mehr überall dieselbe, und die Mitte
    // allein sagt für ein Symbol nahe der Lücke nichts.
    for (const items of [DEMO, LARGE]) {
      const layout = layoutFunnel(items);
      for (const i of layout.items) {
        const half = Math.min(
          halfAt(layout.profile, i.box.x),
          halfAt(layout.profile, i.box.x + i.box.w),
        );
        expect(i.cy - i.size).toBeGreaterThanOrEqual(layout.mid - half - 1e-6);
        expect(i.cy + i.size).toBeLessThanOrEqual(layout.mid + half + 1e-6);
      }
    }
  });

  it("hält jedes Symbol innerhalb des Plateaus seiner Station", () => {
    // Schärfer als „innerhalb seines Bandes": die Lücke zwischen H1.1 und
    // H1.2 gehört keiner der beiden Stationen. Ein Symbol, das in sie
    // hineinragte, stünde über der Rampe statt über seiner Öffnung.
    for (const items of [DEMO, LARGE]) {
      const layout = layoutFunnel(items);
      const stations = layout.bands.flatMap((b) => b.stations);
      for (const i of layout.items) {
        const own = stations.filter(
          (z) => i.box.x >= z.x0 - 1e-6 && i.box.x + i.box.w <= z.x1 + 1e-6,
        );
        expect(own).toHaveLength(1);
      }
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

  it("rundet die Stufe, statt sie im rechten Winkel zu machen", () => {
    // Der Beleg für die Rundung ist **nicht** „die Kurve sieht weich aus",
    // sondern: an der Trennung liegt die Öffnung echt *zwischen* den beiden
    // Plateauwerten. Sprang sie, läge sie exakt auf einem von beiden — genau
    // das tat sie, solange die Plateaus aneinanderstiessen und `halfAt` zwei
    // Kontrollpunkte mit demselben `x` fand.
    const layout = layoutFunnel([
      sol("c", "h1", 900_000, 0, "investing"),
      sol("d", "h1", 300_000, 0, "extracting"),
    ]);
    const x = layout.h1!.splitX;
    const links = halfAt(layout.profile, x - 20);
    const rechts = halfAt(layout.profile, x + 20);
    const mitte = halfAt(layout.profile, x);
    expect(mitte).toBeLessThan(links);
    expect(mitte).toBeGreaterThan(rechts);
    // Symmetrisch: die Mitte der Lücke liegt auf der Mitte des Sprungs.
    expect(mitte).toBeCloseTo((links + rechts) / 2, 5);
  });

  it("lässt die Plateaus selbst flach — gerundet wird nur die Lücke", () => {
    // Die Gegenprobe. Würde die Rundung ins Plateau hineinlaufen, stünde ein
    // Symbol nicht mehr unter der Öffnung seiner eigenen Station.
    const layout = layoutFunnel([
      sol("c", "h1", 900_000, 0, "investing"),
      sol("d", "h1", 300_000, 0, "extracting"),
    ]);
    const [links, rechts] = layout.bands.find((b) => b.horizon === "h1")!.stations;
    for (const z of [links!, rechts!]) {
      expect(halfAt(layout.profile, z.x0)).toBeCloseTo(z.half, 5);
      expect(halfAt(layout.profile, (z.x0 + z.x1) / 2)).toBeCloseTo(z.half, 5);
      expect(halfAt(layout.profile, z.x1)).toBeCloseTo(z.half, 5);
    }
    // Und die Lücke gehört keiner der beiden: sie liegt genau dazwischen.
    expect(rechts!.x0 - links!.x1).toBeCloseTo(DEFAULT_GEOMETRY.stationGap, 5);
  });

  it("rundet die Ziel-Linie mit — sie läuft durch dieselben Lücken", () => {
    const layout = layoutFunnel(
      [sol("c", "h1", 900_000, 0, "investing"), sol("d", "h1", 300_000, 0, "extracting")],
      DEFAULT_GEOMETRY,
      CODE_STEPS[0],
      { h3: 0, h2: 0, "h1.1": 70, "h1.2": 30, h0: 0 },
    );
    const target = layout.targetProfile!;
    const x = layout.h1!.splitX;
    const links = halfAt(target, x - 20);
    const rechts = halfAt(target, x + 20);
    expect(links / rechts).toBeCloseTo(70 / 30, 5);
    expect(halfAt(target, x)).toBeCloseTo((links + rechts) / 2, 5);
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

/**
 * **Ohne Budget-Modul misst die Zeichnung die laufenden Epics.**
 *
 * Vorher fiel sie in diesem Fall zu lauter gleich großen leeren Umrissen
 * zusammen — und behauptete in ihrer Beschriftung weiter, die Größe sei Geld.
 * Produktlose Epics verschwanden ganz, weil ein Filter `invest <= 0`
 * aussortierte, was ohne Modul auf jedes Epic zutrifft.
 */
describe("layoutFunnel — Zählmodus (Budget-Modul aus)", () => {
  const COUNT = { sizing: "count" as const };

  /** Ein Produkt mit `count` laufenden Epics und ohne jedes Geld. */
  const prod = (id: string, horizon: Horizon | null, count: number): FunnelItem => ({
    ...sol(id, horizon, 0),
    count,
  });

  const dot = (id: string, horizon: Horizon | null): FunnelItem => ({
    ...sol(id, horizon, 0),
    kind: "epic",
    count: 1,
  });

  it("macht die Fläche ∝ Epic-Zahl: doppelte Kante = vierfache Zahl", () => {
    const { items } = layoutFunnel(
      [prod("a", "h1", 16), prod("b", "h1", 4)],
      undefined,
      undefined,
      null,
      COUNT,
    );
    const span = (id: string) => items.find((i) => i.id === id)!.size - DEFAULT_GEOMETRY.emptySize;
    expect(span("a") / span("b")).toBeCloseTo(2, 5);
  });

  it("zeichnet jedes Epic gleich groß — ein Epic ist keine Menge", () => {
    const { items } = layoutFunnel(
      [prod("gross", "h1", 20), dot("e1", "h1"), dot("e2", "h2"), dot("e3", "h3")],
      undefined,
      undefined,
      null,
      COUNT,
    );
    const dots = items.filter((i) => i.kind === "epic");
    expect(dots).toHaveLength(3);
    for (const d of dots) expect(d.size).toBe(DEFAULT_GEOMETRY.epicDotSize);
  });

  it("öffnet die Bänder nach der Zahl der Epics, nicht nach Geld", () => {
    // h1 traegt 9 Epics, h3 eines — die Oeffnung muss das widerspiegeln.
    const l = layoutFunnel(
      [prod("viel", "h1", 9), dot("wenig", "h3")],
      undefined,
      undefined,
      null,
      COUNT,
    );
    const half = (h: Horizon) => l.bands.find((b) => b.horizon === h)!.half;
    expect(half("h1")).toBeGreaterThan(half("h3"));
  });

  it("gibt einem Produkt ohne laufende Epics das Mindestmaß", () => {
    const { items } = layoutFunnel([prod("still", "h2", 0)], undefined, undefined, null, COUNT);
    expect(items[0]!.size).toBe(DEFAULT_GEOMETRY.emptySize);
  });

  it("lässt den Geld-Modus unberührt — er bleibt die Vorgabe", () => {
    const money = [sol("a", "h1", 1_000_000), sol("b", "h1", 250_000)];
    expect(layoutFunnel(money).items.map((i) => i.size)).toEqual(
      layoutFunnel(money, undefined, undefined, null, {}).items.map((i) => i.size),
    );
  });
});

/**
 * **Die Symbole im Streifen „Ohne Produktzuordnung" passen hinein.**
 *
 * Gemeldet: der Würfel „NH · Betrieb" ragte über den Hinweistext und unten
 * über die gestrichelte Linie — die Zeile war fest 44 px hoch, egal wie groß
 * das Symbol war.
 */
describe("stripRowOf", () => {
  const MIN = 44;

  it("bleibt bei kleinen Symbolen auf der Mindesthöhe", () => {
    expect(stripRowOf([{ size: 8 }], MIN).rowH).toBe(MIN);
    // Schon das kleinste Produkt (10) braucht mit Beschriftung 46 — die alte
    // feste 44 war also nie ganz genug.
    expect(stripRowOf([{ size: 10 }], MIN).rowH).toBe(46);
  });

  it("wächst mit dem größten Symbol: Würfel plus Beschriftung", () => {
    const { rowH, cyOffset } = stripRowOf([{ size: 12 }, { size: 34 }], MIN);
    expect(rowH).toBe(2 * 34 + DEFAULT_GEOMETRY.labelHeight);
    // Oberkante des größten Würfels liegt genau an der Oberkante der Zeile.
    expect(cyOffset - 34).toBe(0);
    // Unterkante des Würfels liegt über der Beschriftung, innerhalb der Zeile.
    expect(cyOffset + 34).toBeLessThanOrEqual(rowH - DEFAULT_GEOMETRY.labelHeight);
  });

  it("kommt mit einem leeren Streifen aus", () => {
    expect(stripRowOf([], MIN)).toEqual({ rowH: MIN, cyOffset: 0 });
  });
});

describe("Zielbeträge gegen den Topf", () => {
  const ZIELE = { h3: 10, h2: 20, "h1.1": 30, "h1.2": 30, h0: 10 };
  const ITEMS: FunnelItem[] = [
    sol("a", "h3", 100_000),
    sol("b", "h1", 200_000, 0, "investing"),
    sol("c", "h1", 100_000, 0, "extracting"),
    // Ohne Produkt-Zuordnung: liegt im Streifen, in keinem Band.
    sol("ohne", null, 150_000, 50_000),
  ];
  const band = (l: ReturnType<typeof layoutFunnel>, h: Horizon) =>
    l.bands.find((b) => b.horizon === h)!;
  const mitTopf = (pool: number | null, items = ITEMS) =>
    layoutFunnel(items, DEFAULT_GEOMETRY, CODE_STEPS[0], ZIELE, { pool });

  it("rechnet den Anteil gegen Topf minus Kosten ohne Produkt-Zuordnung", () => {
    const l = mitTopf(1_000_000);
    expect(l.targetBasis).toEqual({ pool: 1_000_000, homeless: 200_000, base: 800_000 });
    expect(band(l, "h3").targetMoney).toBeCloseTo(80_000);
    expect(band(l, "h2").targetMoney).toBeCloseTo(160_000);
    expect(band(l, "h0").targetMoney).toBeCloseTo(80_000);
  });

  it("H1 trägt die Ziele beider Stationen", () => {
    expect(band(mitTopf(1_000_000), "h1").targetMoney).toBeCloseTo(0.6 * 800_000);
  });

  it("ein Posten im Streifen senkt die Basis, ein Posten im Band nicht", () => {
    const mehrStreifen = mitTopf(1_000_000, [...ITEMS, sol("ohne2", null, 100_000)]);
    const mehrBand = mitTopf(1_000_000, [...ITEMS, sol("d", "h2", 100_000)]);
    expect(mehrStreifen.targetBasis!.base).toBe(700_000);
    expect(mehrBand.targetBasis!.base).toBe(800_000);
  });

  it("die gestrichelte Linie misst dieselbe Basis wie die Zahl", () => {
    const l = mitTopf(1_000_000);
    const h3 = band(l, "h3");
    const mitte = (h3.x0 + h3.x1) / 2;
    // Öffnung ∝ Geld: Ziel-Öffnung / Ist-Öffnung = Zielbetrag / Ist-Betrag.
    expect(halfAt(l.targetProfile!, mitte) / h3.half).toBeCloseTo(h3.targetMoney! / h3.money, 6);
  });

  it("ohne Topf: keine Zielbeträge, die Linie wie bisher gegen das Bandgeld", () => {
    const ohne = mitTopf(null);
    expect(ohne.targetBasis).toBeNull();
    expect(ohne.bands.every((b) => b.targetMoney == null)).toBe(true);
    expect(ohne.targetProfile).toEqual(
      layoutFunnel(ITEMS, DEFAULT_GEOMETRY, CODE_STEPS[0], ZIELE).targetProfile,
    );
  });

  it("im Zählmodus gibt es keinen Zielbetrag", () => {
    const l = layoutFunnel(ITEMS, DEFAULT_GEOMETRY, CODE_STEPS[0], ZIELE, {
      pool: 1_000_000,
      sizing: "count",
    });
    expect(l.targetBasis).toBeNull();
  });
});
