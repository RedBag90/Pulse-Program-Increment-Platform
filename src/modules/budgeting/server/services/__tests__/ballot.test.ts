import { describe, it, expect, vi } from "vitest";

/**
 * Fake-DB-Abdeckung des geteilten Ballot-Loaders (F-C1). Ein `initiative`-Delegate
 * mit zwei `findMany`-Antworten (Ballot-Kandidaten, Pflichtvorhaben) reicht — der
 * Loader macht reines SQL-Fan-out.
 */

import { loadRoundBallot } from "@/modules/budgeting/server/services/ballot";

function dbWith(ballot: unknown[], mandatory: unknown[]) {
  const findMany = vi
    .fn()
    .mockResolvedValueOnce(ballot)
    .mockResolvedValueOnce(mandatory);
  return { initiative: { findMany } } as unknown as Parameters<typeof loadRoundBallot>[0];
}

describe("loadRoundBallot", () => {
  it("liefert Ballot (Titel + Kosten) und Pflicht-Summe", async () => {
    const db = dbWith(
      [
        { id: "e1", title: "Alpha", costToMvp: 100_000 },
        { id: "e2", title: "Beta", costToMvp: 50_000 },
      ],
      [{ costToMvp: 200_000 }, { costToMvp: 30_000 }],
    );

    const res = await loadRoundBallot(db, "T");

    expect(res.ballot).toEqual([
      { id: "e1", title: "Alpha", cost: 100_000 },
      { id: "e2", title: "Beta", cost: 50_000 },
    ]);
    expect(res.mandatoryCount).toBe(2);
    expect(res.mandatorySum).toBe(230_000);
  });

  it("behandelt fehlende costToMvp als 0", async () => {
    const db = dbWith([{ id: "e1", title: "Alpha", costToMvp: null }], [{ costToMvp: null }]);

    const res = await loadRoundBallot(db, "T");

    expect(res.ballot).toEqual([{ id: "e1", title: "Alpha", cost: 0 }]);
    expect(res.mandatorySum).toBe(0);
  });

  it("liefert leeres Ballot und Summe 0 ohne Einträge", async () => {
    const res = await loadRoundBallot(dbWith([], []), "T");
    expect(res.ballot).toEqual([]);
    expect(res.mandatoryCount).toBe(0);
    expect(res.mandatorySum).toBe(0);
  });
});
