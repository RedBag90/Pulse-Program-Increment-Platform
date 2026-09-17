import { describe, it, expect } from "vitest";
import {
  buildGoalActivity,
  type ActivityAudit,
  type ActivityCheckin,
  type ActivityComment,
} from "@/modules/core/goals/domain/goal-activity";

/**
 * Der gemeldete Fehler in einer Zeile: **die leere Zeile stand über der
 * vollen.** Der Check-in trägt UTC-Mitternacht des gewählten Tages, sein
 * Audit-Ereignis trägt „jetzt" — beide heißen „Status-Check-in".
 */

const checkin = (over: Partial<ActivityCheckin> = {}): ActivityCheckin => ({
  id: "c1",
  status: "on_track",
  value: null,
  note: null,
  sections: [{ title: "Fortschritt", body: "Zwei Features fertig." }],
  at: "2026-09-10T00:00:00.000Z",
  by: "u1",
  ...over,
});

describe("buildGoalActivity", () => {
  it("lässt das Audit-Doppel des Check-ins weg — sonst steht die leere Zeile oben", () => {
    const audits: ActivityAudit[] = [
      // Dasselbe Ereignis, 14 Stunden später gestempelt und ohne Inhalt.
      { id: "a1", action: "goal.checkin", at: "2026-09-10T14:00:00.000Z", by: "u1" },
    ];
    const feed = buildGoalActivity([checkin()], [], audits);

    expect(feed).toHaveLength(1);
    expect(feed[0]?.id).toBe("checkin-c1");
    expect(feed[0]?.sections).toEqual([{ title: "Fortschritt", body: "Zwei Features fertig." }]);
    expect(feed[0]?.detail).toBe("on_track");
  });

  it("lässt auch die Doppel von Fortschritt und Kommentar weg", () => {
    const comments: ActivityComment[] = [
      { id: "k1", body: "Danke!", at: "2026-09-11T09:00:00.000Z", by: "u2" },
    ];
    const audits: ActivityAudit[] = [
      { id: "a1", action: "goal.progress.updated", at: "2026-09-10T14:00:00.000Z", by: "u1" },
      { id: "a2", action: "goal.comment.added", at: "2026-09-11T09:00:00.000Z", by: "u2" },
    ];
    const feed = buildGoalActivity(
      [checkin({ status: null, value: 3, sections: null })],
      comments,
      audits,
    );

    expect(feed.map((e) => e.id)).toEqual(["comment-k1", "checkin-c1"]);
    // Der statuslose Check-in bleibt der Fortschritts-Eintrag, mit seinem Wert.
    expect(feed[1]?.action).toBe("goal.progress");
    expect(feed[1]?.detail).toBe("→ 3");
  });

  it("behält die Audit-Zeilen, die keine eigene Spur haben", () => {
    const audits: ActivityAudit[] = [
      { id: "a1", action: "goal.created", at: "2026-09-01T08:00:00.000Z", by: "u1" },
      { id: "a2", action: "goal.checkin", at: "2026-09-10T14:00:00.000Z", by: "u1" },
    ];
    const feed = buildGoalActivity([], [], audits);
    expect(feed.map((e) => e.action)).toEqual(["goal.created"]);
    expect(feed[0]?.kind).toBe("audit");
    expect(feed[0]?.entryId).toBeNull();
  });

  it("sortiert neueste zuerst und bleibt bei Gleichstand stabil", () => {
    const a = checkin({ id: "a", at: "2026-09-10T00:00:00.000Z" });
    const b = checkin({ id: "b", at: "2026-09-10T00:00:00.000Z" });
    const c = checkin({ id: "c", at: "2026-09-12T00:00:00.000Z" });
    const first = buildGoalActivity([a, b, c], [], []).map((e) => e.id);
    const second = buildGoalActivity([c, b, a], [], []).map((e) => e.id);
    expect(first[0]).toBe("checkin-c");
    expect(first).toEqual(second);
  });

  it("reicht die Roh-Id durch, damit die Fläche die richtige Zeile trifft", () => {
    const feed = buildGoalActivity(
      [checkin()],
      [{ id: "k1", body: "Hallo", at: "2026-09-11T09:00:00.000Z", by: "u2" }],
      [],
    );
    expect(feed.map((e) => [e.kind, e.entryId])).toEqual([
      ["comment", "k1"],
      ["checkin", "c1"],
    ]);
  });

  it("lässt leere Sektionen weg, statt einen leeren Block zu zeigen", () => {
    const feed = buildGoalActivity([checkin({ sections: [] })], [], []);
    expect(feed[0]?.sections).toBeUndefined();
  });
});
