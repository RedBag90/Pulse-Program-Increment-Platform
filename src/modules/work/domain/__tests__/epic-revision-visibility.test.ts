import { describe, it, expect } from "vitest";
import {
  computeEpicRevisionVisibility,
  type EpicRevisionVisibilityInput,
} from "@/modules/work/domain/epic-revision-visibility";

/**
 * Die Sperr-Algebra hängt seit dem Umbau an der Reifegrad-Achse: beide Texte
 * werden mit der Abnahme des Schritts freigegeben, der sie trägt — L0 → L1 die
 * Hypothese, L2 → L3.1 der Business Case. Diese Tests halten genau das fest.
 */
const base = (over: Partial<EpicRevisionVisibilityInput> = {}): EpicRevisionVisibilityInput => ({
  stageGate: "L0",
  openGateRequestTo: null,
  viewerIsGateApprover: false,
  hasHypoBaseline: false,
  hasBcBaseline: false,
  canEdit: true,
  ...over,
});

describe("Benefit-Hypothese", () => {
  it("auf L0 ohne Antrag: frei, kein Sperrgrund", () => {
    const v = computeEpicRevisionVisibility(base());
    expect(v.hypoEditable).toBe(true);
    expect(v.hypoLockReason).toBeUndefined();
  });

  it("mit gestelltem L1-Antrag: gesperrt, Begründung nennt den Antrag", () => {
    const v = computeEpicRevisionVisibility(base({ openGateRequestTo: "L1" }));
    expect(v.hypoEditable).toBe(false);
    expect(v.hypoLockReason).toContain("beantragt");
  });

  it("ein Antrag auf ein anderes Gate sperrt sie nicht", () => {
    // Auf L0 gibt es zwar nur den L1-Antrag; die Regel greift trotzdem den
    // Ziel-Schritt ab und nicht bloß „irgendein Antrag offen".
    const v = computeEpicRevisionVisibility(base({ openGateRequestTo: "L3.1" }));
    expect(v.hypoEditable).toBe(true);
  });

  it("ab L1 gesperrt — die Abnahme war die Freigabe", () => {
    const v = computeEpicRevisionVisibility(base({ stageGate: "L1" }));
    expect(v.hypoEditable).toBe(false);
    expect(v.hypoLockReason).toContain("freigegeben");
  });

  it("ohne Schreibrecht gibt es gar keinen Sperrgrund — nur nichts zu tun", () => {
    const v = computeEpicRevisionVisibility(base({ stageGate: "L1", canEdit: false }));
    expect(v.hypoEditable).toBe(false);
    expect(v.hypoLockReason).toBeUndefined();
  });
});

describe("Business Case", () => {
  it("auf L0 noch nicht bearbeitbar — erst muss die Hypothese durch", () => {
    const v = computeEpicRevisionVisibility(base());
    expect(v.bcEditable).toBe(false);
    expect(v.bcLockReason).toContain("L1");
  });

  it("auf L1 und L2 frei", () => {
    expect(computeEpicRevisionVisibility(base({ stageGate: "L1" })).bcEditable).toBe(true);
    expect(computeEpicRevisionVisibility(base({ stageGate: "L2" })).bcEditable).toBe(true);
  });

  it("mit gestelltem L3.1-Antrag gesperrt", () => {
    const v = computeEpicRevisionVisibility(base({ stageGate: "L2", openGateRequestTo: "L3.1" }));
    expect(v.bcEditable).toBe(false);
    expect(v.bcLockReason).toContain("beantragt");
  });

  it("ein offener L2-Antrag sperrt den Business Case nicht", () => {
    const v = computeEpicRevisionVisibility(base({ stageGate: "L1", openGateRequestTo: "L2" }));
    expect(v.bcEditable).toBe(true);
  });

  it("ab L3 gesperrt — die Abnahme war die Freigabe", () => {
    const v = computeEpicRevisionVisibility(base({ stageGate: "L3" }));
    expect(v.bcEditable).toBe(false);
    expect(v.bcLockReason).toContain("freigegeben");
  });
});

describe("Review-Diff und Gegenüberstellung", () => {
  it("der Abnehmer sieht den Diff gegen die zuletzt freigegebene Fassung", () => {
    const v = computeEpicRevisionVisibility(
      base({ openGateRequestTo: "L1", viewerIsGateApprover: true, hasHypoBaseline: true }),
    );
    expect(v.showHypoReviewDiff).toBe(true);
    expect(v.showHypoOwnerEdit).toBe(false);
  });

  it("wer nicht abnimmt, sieht keinen Review-Diff", () => {
    const v = computeEpicRevisionVisibility(
      base({ openGateRequestTo: "L1", viewerIsGateApprover: false, hasHypoBaseline: true }),
    );
    expect(v.showHypoReviewDiff).toBe(false);
  });

  it("ohne Baseline gibt es nichts zu vergleichen", () => {
    const v = computeEpicRevisionVisibility(
      base({ openGateRequestTo: "L1", viewerIsGateApprover: true }),
    );
    expect(v.showHypoReviewDiff).toBe(false);
  });

  it("der Bearbeiter sieht die Gegenüberstellung, solange er schreiben darf", () => {
    const v = computeEpicRevisionVisibility(base({ hasHypoBaseline: true }));
    expect(v.showHypoOwnerEdit).toBe(true);
  });

  it("dasselbe für den Business Case an L3.1", () => {
    const approver = computeEpicRevisionVisibility(
      base({
        stageGate: "L2",
        openGateRequestTo: "L3.1",
        viewerIsGateApprover: true,
        hasBcBaseline: true,
      }),
    );
    expect(approver.showBcReviewDiff).toBe(true);
    const owner = computeEpicRevisionVisibility(base({ stageGate: "L2", hasBcBaseline: true }));
    expect(owner.showBcOwnerEdit).toBe(true);
  });
});
