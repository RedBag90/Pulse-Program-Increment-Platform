import { describe, it, expect } from "vitest";
import {
  attentionOf,
  burnup,
  foldScopeDrift,
  forecast,
  lageHead,
  lageSignal,
  piDays,
  type LageFeature,
} from "@/modules/drumbeat/domain/pi-lage";

/**
 * **PI-Lage** — Beispiel aus dem Wireframe: PI 30.08.–07.11.2026 (69 Tage),
 * heute 27.09. = Tag 28, 14 von 42 JS geliefert.
 */
const D = (s: string) => new Date(`${s}T00:00:00Z`);
const PI = { startDate: D("2026-08-30"), endDate: D("2026-11-07"), status: "active" };
const HEUTE = D("2026-09-27");

const f = (over: Partial<LageFeature> & { id: string }): LageFeature => ({
  title: over.id,
  status: "approved",
  jobSize: 3,
  businessValue: 5,
  completedAt: null,
  updatedAt: HEUTE,
  ownerName: null,
  blockedSince: null,
  blockedReason: null,
  ...over,
});

describe("piDays / lageSignal / forecast", () => {
  it("zählt Tage ab PI-Start, auf den PI begrenzt", () => {
    expect(piDays(PI, HEUTE)).toEqual({ total: 69, elapsed: 28 });
    expect(piDays(PI, D("2026-12-01")).elapsed).toBe(69);
    expect(piDays(PI, D("2026-08-01")).elapsed).toBe(0);
  });

  it("Signal nach Abstand Zeit − Lieferung", () => {
    expect(lageSignal("active", 5)).toBe("onTrack");
    expect(lageSignal("active", 6)).toBe("behind");
    expect(lageSignal("active", 15)).toBe("behind");
    expect(lageSignal("active", 16)).toBe("critical");
    expect(lageSignal("active", -20)).toBe("onTrack");
    expect(lageSignal("completed", 40)).toBe("done");
    expect(lageSignal("planned", 0)).toBe("planned");
  });

  it("Prognose erst ab Tag 3, im bisherigen Tempo", () => {
    expect(forecast(4, { total: 69, elapsed: 2 })).toBeNull();
    expect(forecast(14, { total: 69, elapsed: 28 })).toBe(35);
  });
});

describe("lageHead", () => {
  it("Plan ohne Verworfene, Lieferung aus Abgeschlossenen", () => {
    const head = lageHead(
      [
        f({ id: "a", status: "completed", jobSize: 8 }),
        f({ id: "b", status: "completed", jobSize: 6 }),
        f({ id: "c", status: "in_progress", jobSize: 28 }),
        f({ id: "x", status: "cancelled", jobSize: 13 }),
      ],
      PI,
      HEUTE,
    );
    expect(head).toMatchObject({
      plannedJs: 42,
      deliveredJs: 14,
      plannedCount: 3,
      deliveredCount: 2,
      gapPoints: 8,
      signal: "behind",
      forecastJs: 35,
    });
  });
});

describe("attentionOf — Braucht jetzt Hilfe", () => {
  it("nur blockierte, am längsten blockierte zuerst, dann grössere Job Size", () => {
    const items = attentionOf(
      [
        f({ id: "neu", status: "approved", jobSize: 8 }),
        f({ id: "still", status: "in_progress", updatedAt: D("2026-09-01") }),
        f({ id: "kurz", status: "blocked", jobSize: 13, blockedSince: D("2026-09-25") }),
        f({ id: "lang", status: "blocked", jobSize: 2, blockedSince: D("2026-09-21") }),
        f({ id: "ohneDatum", status: "blocked", jobSize: 5 }),
        f({ id: "fertig", status: "completed" }),
      ],
      PI,
      HEUTE,
    );
    expect(items.map((i) => [i.feature.id, i.days])).toEqual([
      ["lang", 6],
      ["kurz", 2],
      ["ohneDatum", null],
    ]);
  });

  it("nur im laufenden PI", () => {
    expect(
      attentionOf([f({ id: "b", status: "blocked" })], { ...PI, status: "completed" }, HEUTE),
    ).toEqual([]);
  });
});

describe("foldScopeDrift", () => {
  const info = new Map([
    ["rein", { title: "Chatbot", jobSize: 5, status: "in_progress" }],
    ["raus", { title: "Historie", jobSize: 2, status: "approved" }],
    ["hinUndZurueck", { title: "Pendel", jobSize: 8, status: "approved" }],
  ]);
  const now = [
    f({ id: "rein", jobSize: 5 }),
    f({ id: "hinUndZurueck", jobSize: 8 }),
    f({ id: "alt", jobSize: 29 }),
    f({ id: "direkt", jobSize: 2 }),
    f({ id: "seed", jobSize: 3 }),
  ];

  it("Nettoeffekt je Feature; in der App angelegt zählt als hinein, ohne Audit nicht", () => {
    const drift = foldScopeDrift({
      pi: PI,
      featuresNow: now,
      info,
      created: new Map([
        ["direkt", { at: D("2026-09-10"), actorId: "u3" }],
        // vor dem Start angelegt: gehörte schon zum Plan
        ["alt", { at: D("2026-08-20"), actorId: "u3" }],
      ]),
      moves: [
        { featureId: "rein", at: D("2026-09-10"), direction: "in", actorId: "u1" },
        { featureId: "raus", at: D("2026-09-18"), direction: "out", actorId: "u2" },
        { featureId: "hinUndZurueck", at: D("2026-09-05"), direction: "out", actorId: "u1" },
        { featureId: "hinUndZurueck", at: D("2026-09-06"), direction: "in", actorId: "u1" },
        // vor dem Start: zählt nicht
        { featureId: "alt", at: D("2026-08-20"), direction: "in", actorId: "u1" },
      ],
    });
    expect(drift.changes.map((c) => [c.featureId, c.direction, c.jobSize])).toEqual([
      ["rein", "in", 5],
      ["direkt", "in", 2],
      ["raus", "out", 2],
    ]);
    expect(drift.changes.find((c) => c.featureId === "direkt")).toMatchObject({
      created: true,
      actorId: "u3",
    });
    // „seed" hat kein Audit und bleibt Teil des Startumfangs.
    expect(drift.nowJs).toBe(47);
    expect(drift.startJs).toBe(47 - 5 - 2 + 2);
  });
});

describe("burnup", () => {
  it("Lieferung als Treppe bis heute, Umfang als Treppe über den PI", () => {
    const features = [
      f({ id: "a", status: "completed", jobSize: 3, completedAt: D("2026-09-07") }),
      f({ id: "b", status: "completed", jobSize: 2, completedAt: D("2026-09-07") }),
      f({ id: "c", status: "completed", jobSize: 3, completedAt: D("2026-09-20") }),
      f({ id: "d", status: "in_progress", jobSize: 5 }),
    ];
    const b = burnup(
      features,
      {
        startJs: 8,
        nowJs: 13,
        changes: [
          {
            featureId: "d",
            title: "d",
            jobSize: 5,
            direction: "in",
            at: D("2026-09-11"),
            actorId: null,
          },
        ],
      },
      PI,
      HEUTE,
    );
    expect(b.delivered).toEqual([
      { day: 0, js: 0 },
      { day: 8, js: 5 },
      { day: 21, js: 8 },
      { day: 28, js: 8 },
    ]);
    expect(b.scope).toEqual([
      { day: 0, js: 8 },
      { day: 12, js: 13 },
      { day: 69, js: 13 },
    ]);
    expect(b.today).toBe(28);
  });
});
