import { describe, it, expect } from "vitest";
import type { PrismaClient } from "@/generated/prisma";
import {
  loadViewPreferences,
  saveViewPreference,
} from "@/modules/core/kernel/server/view-preference";
import type { RequestContext } from "@/server/http/mutation-handler";

/**
 * **Die eine Zusage dieses Speichers: niemand schreibt in eine fremde Zeile.**
 *
 * Die Ablage ist bewusst generisch — `key` und beliebiges JSON. Was sie eng
 * haelt, ist nicht das Schema, sondern dass beide Funktionen `principal.id`
 * einsetzen und nie etwas aus der Eingabe. Die RLS-Politik
 * `tenant_user_isolation_view_preferences` liegt darunter; sie greift heute
 * jedoch nicht, weil die Anwendung als Eigentuemerin verbindet (siehe
 * `prisma/sql/README.md`). Diese Pruefung ist also die **wirksame**, nicht die
 * zweite.
 */

const calls: { upsert: unknown[]; findMany: unknown[] } = { upsert: [], findMany: [] };

const db = (rows: { key: string; value: unknown }[] = []): PrismaClient =>
  ({
    viewPreference: {
      findMany: async (args: unknown) => {
        calls.findMany.push(args);
        return rows;
      },
      upsert: async (args: unknown) => {
        calls.upsert.push(args);
        return {};
      },
    },
  }) as unknown as PrismaClient;

const ctx = (client: PrismaClient): RequestContext =>
  ({
    db: client,
    principal: { id: "user-1", tenantId: "tenant-1" },
  }) as unknown as RequestContext;

describe("loadViewPreferences", () => {
  it("liest genau die eigenen Zeilen", async () => {
    calls.findMany = [];
    await loadViewPreferences(db(), { id: "user-1", tenantId: "tenant-1" }, ["a", "b"]);
    expect(calls.findMany[0]).toMatchObject({
      where: { tenantId: "tenant-1", userId: "user-1", key: { in: ["a", "b"] } },
    });
  });

  it("holt bei leerer Liste gar nichts", async () => {
    calls.findMany = [];
    const out = await loadViewPreferences(db(), { id: "u", tenantId: "t" }, []);
    expect(out.size).toBe(0);
    // Eine Abfrage mit `in: []` waere ein Roundtrip fuer ein garantiert leeres
    // Ergebnis.
    expect(calls.findMany).toEqual([]);
  });

  it("fehlende Schluessel fehlen in der Map — kein leerer Platzhalter", async () => {
    const out = await loadViewPreferences(
      db([{ key: "a", value: { x: 1 } }]),
      {
        id: "u",
        tenantId: "t",
      },
      ["a", "b"],
    );
    expect(out.get("a")).toEqual({ x: 1 });
    expect(out.has("b")).toBe(false);
  });
});

describe("saveViewPreference", () => {
  it("schreibt auf den Principal, nicht auf eine Id aus der Eingabe", async () => {
    calls.upsert = [];
    const client = db();
    await saveViewPreference(ctx(client), {
      key: "portfolio.goalContribution",
      // Ein Angreifer kann dem Dienst nur `key` und `value` geben. Dass es gar
      // keinen Weg gibt, eine fremde Id zu nennen, ist der Punkt.
      value: { axis: "art", userId: "user-2", tenantId: "tenant-2" },
    });
    expect(calls.upsert[0]).toMatchObject({
      where: {
        tenantId_userId_key: {
          tenantId: "tenant-1",
          userId: "user-1",
          key: "portfolio.goalContribution",
        },
      },
      create: { tenantId: "tenant-1", userId: "user-1" },
    });
  });

  it("ersetzt den Wert, statt ihn zu mischen", async () => {
    calls.upsert = [];
    await saveViewPreference(ctx(db()), { key: "k", value: { axis: "art" } });
    // Zwei Schalter, von denen einer aus einer alten Fassung stammt, waeren
    // schlimmer als zwei aktuelle — deshalb `value:` und kein Merge.
    expect(calls.upsert[0]).toMatchObject({ update: { value: { axis: "art" } } });
  });
});
