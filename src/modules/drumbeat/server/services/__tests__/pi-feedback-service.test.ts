import { describe, it, expect, vi } from "vitest";

/**
 * PI-Feedback durch die echten Dienste mit einem gefälschten Transaktions-
 * Client (Muster: `pi-lifecycle-service.test.ts`). Die Rechenregeln stehen in
 * `domain/__tests__/pi-feedback.test.ts`; hier geht es um die Verdrahtung:
 * wer antworten darf, welche Werte durchgehen, was „Übernehmen" schreibt.
 */

import {
  applyPiFeedback,
  requestPiFeedback,
  submitPiFeedback,
} from "@/modules/drumbeat/server/services/pi-feedback";

type Fn = ReturnType<typeof vi.fn>;
type Tx = Record<string, Record<string, Fn>>;

function ctxWith(tx: Tx, actor = "actor") {
  return {
    principal: {
      id: actor,
      tenantId: "T",
      email: "x",
      roles: [],
      scopes: { artIds: [], teamIds: [], valueStreamIds: [] },
    },
    db: {
      $transaction: async (cb: (tx: unknown) => Promise<unknown>) => cb(tx),
    },
  } as unknown as Parameters<typeof requestPiFeedback>[0];
}

const audit = () => ({ auditEvent: { create: vi.fn(async () => ({})) } });

describe("requestPiFeedback", () => {
  function tx(opts: { piStatus?: string; open?: unknown; known?: string[] } = {}): Tx {
    return {
      ...audit(),
      programIncrement: {
        findFirst: vi.fn(async () => ({
          id: "pi",
          name: "PI 2",
          status: opts.piStatus ?? "active",
          timelineId: "tl",
          artId: null,
        })),
      },
      art: { findFirst: vi.fn(async () => ({ id: "art", timelineId: "tl" })) },
      userRoleAssignment: {
        findMany: vi.fn(async () => (opts.known ?? ["bo"]).map((userId) => ({ userId }))),
      },
      piFeedbackRequest: {
        findFirst: vi.fn(async () => opts.open ?? null),
        create: vi.fn(async () => ({ id: "req", dueDate: null })),
        update: vi.fn(async () => ({})),
      },
      piFeedbackReviewer: { createMany: vi.fn(async () => ({ count: 1 })) },
    };
  }

  it("legt eine Runde an und benennt die Personen", async () => {
    const t = tx();
    const r = await requestPiFeedback(ctxWith(t), {
      piId: "pi",
      artId: "art",
      reviewerIds: ["bo"],
      dueDate: null,
    });
    expect(r).toEqual({ ok: true, value: { requestId: "req", added: 1 } });
    expect(t.piFeedbackRequest!.create).toHaveBeenCalled();
    expect(t.piFeedbackReviewer!.createMany).toHaveBeenCalledWith(
      expect.objectContaining({ skipDuplicates: true }),
    );
  });

  it("ergänzt eine offene Runde, statt eine zweite zu beginnen", async () => {
    const t = tx({ open: { id: "offen", dueDate: null } });
    const r = await requestPiFeedback(ctxWith(t), {
      piId: "pi",
      artId: "art",
      reviewerIds: ["bo"],
      dueDate: null,
    });
    expect(r.ok && r.value.requestId).toBe("offen");
    expect(t.piFeedbackRequest!.create).not.toHaveBeenCalled();
  });

  it("nicht beim geplanten PI", async () => {
    const r = await requestPiFeedback(ctxWith(tx({ piStatus: "planned" })), {
      piId: "pi",
      artId: "art",
      reviewerIds: ["bo"],
      dueDate: null,
    });
    expect(r).toMatchObject({
      ok: false,
      error: { reason: "drumbeat.feedback.errors.piNochGeplant" },
    });
  });

  it("nur Personen des Mandanten", async () => {
    const r = await requestPiFeedback(ctxWith(tx({ known: ["bo"] })), {
      piId: "pi",
      artId: "art",
      reviewerIds: ["bo", "fremd"],
      dueDate: null,
    });
    expect(r).toMatchObject({
      ok: false,
      error: { reason: "drumbeat.feedback.errors.unbekanntePerson" },
    });
  });
});

describe("submitPiFeedback", () => {
  function tx(opts: { reviewer?: unknown; status?: string } = {}): Tx {
    return {
      ...audit(),
      piFeedbackRequest: {
        findFirst: vi.fn(async () => ({
          id: "req",
          piId: "pi",
          artId: "art",
          status: opts.status ?? "open",
        })),
      },
      piFeedbackReviewer: {
        findUnique: vi.fn(async () => ("reviewer" in opts ? opts.reviewer : { id: "rv" })),
        update: vi.fn(async () => ({})),
      },
      initiative: { findMany: vi.fn(async () => [{ id: "f1" }, { id: "f2" }]) },
      piFeedbackAnswer: {
        deleteMany: vi.fn(async () => ({})),
        createMany: vi.fn(async () => ({})),
      },
    };
  }
  const answers = [{ featureId: "f1", businessValue: 13, comment: "  mehr als gedacht " }];

  it("ersetzt die Antwort der benannten Person und markiert sie abgeschickt", async () => {
    const t = tx();
    const r = await submitPiFeedback(ctxWith(t, "bo"), { requestId: "req", answers });
    expect(r.ok).toBe(true);
    expect(t.piFeedbackAnswer!.deleteMany).toHaveBeenCalledWith({ where: { reviewerId: "rv" } });
    expect(t.piFeedbackAnswer!.createMany).toHaveBeenCalledWith({
      data: [
        expect.objectContaining({
          featureId: "f1",
          businessValue: 13,
          comment: "mehr als gedacht",
        }),
      ],
    });
    expect(t.piFeedbackReviewer!.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "submitted" }) }),
    );
  });

  it("wer nicht benannt ist, findet die Runde nicht", async () => {
    const r = await submitPiFeedback(ctxWith(tx({ reviewer: null }), "fremd"), {
      requestId: "req",
      answers,
    });
    expect(r).toMatchObject({ ok: false, error: { kind: "not_found" } });
  });

  it("nur Skalenwerte und nur Features der Runde", async () => {
    const aussen = await submitPiFeedback(ctxWith(tx()), {
      requestId: "req",
      answers: [{ featureId: "anderes", businessValue: 5, comment: null }],
    });
    expect(aussen).toMatchObject({
      ok: false,
      error: { reason: "drumbeat.feedback.errors.featureNichtDabei" },
    });
    const krumm = await submitPiFeedback(ctxWith(tx()), {
      requestId: "req",
      answers: [{ featureId: "f1", businessValue: 4, comment: null }],
    });
    expect(krumm).toMatchObject({
      ok: false,
      error: { reason: "drumbeat.feedback.errors.keinSkalenwert" },
    });
  });

  it("nach dem Übernehmen nicht mehr", async () => {
    const r = await submitPiFeedback(ctxWith(tx({ status: "applied" })), {
      requestId: "req",
      answers,
    });
    expect(r).toMatchObject({
      ok: false,
      error: { reason: "drumbeat.feedback.errors.schonUebernommen" },
    });
  });
});

describe("applyPiFeedback", () => {
  function tx(artId = "art"): Tx {
    return {
      ...audit(),
      piFeedbackRequest: {
        findFirst: vi.fn(async () => ({ id: "req", piId: "pi", artId, status: "open" })),
        update: vi.fn(async () => ({})),
      },
      initiative: {
        findMany: vi.fn(async () => [
          {
            id: "f1",
            wsjfBusinessValueActual: null,
            wsjfTimeCriticality: 5,
            wsjfRiskReduction: 3,
            wsjfJobSize: 5,
          },
        ]),
        update: vi.fn(async () => ({})),
      },
    };
  }

  it("schreibt Ist-BV und Ist-WSJF, protokolliert je Feature und schließt die Runde", async () => {
    const t = tx();
    const r = await applyPiFeedback(ctxWith(t), {
      requestId: "req",
      artId: "art",
      values: [{ featureId: "f1", businessValue: 13 }],
    });
    expect(r).toEqual({ ok: true, value: { applied: 1 } });
    expect(t.initiative!.update).toHaveBeenCalledWith({
      where: { id: "f1" },
      data: { wsjfBusinessValueActual: 13, wsjfComputedActual: 4.2 },
    });
    // Ein Eintrag für das Feature, einer für die Runde.
    const actions = t.auditEvent!.create!.mock.calls.map(
      (c) => (c[0] as { data: { action: string } }).data.action,
    );
    expect(actions).toEqual(["initiative.bv_actual.applied", "pi.feedback.applied"]);
    expect(t.piFeedbackRequest!.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: expect.objectContaining({ status: "applied" }) }),
    );
  });

  it("die Runde muss dem ART gehören, für den die Berechtigung galt", async () => {
    const t = tx("anderer-art");
    const r = await applyPiFeedback(ctxWith(t), {
      requestId: "req",
      artId: "art",
      values: [{ featureId: "f1", businessValue: 13 }],
    });
    expect(r).toMatchObject({ ok: false, error: { kind: "not_found" } });
    expect(t.initiative!.update).not.toHaveBeenCalled();
  });
});
