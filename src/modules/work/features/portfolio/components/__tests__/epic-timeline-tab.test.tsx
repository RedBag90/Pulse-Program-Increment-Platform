import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { EpicTimelineTab } from "@/modules/work/features/portfolio/components/epic-timeline-tab";
import { epicLifecycleSteps } from "@/modules/work/features/portfolio/lib/epic-lifecycle";

/**
 * **Die Zeitleiste zeigt den Verlauf; sie benennt niemanden.**
 *
 * Bis September 2026 trug der Meilenstein _Erstsichtung_ als einzige Zeile einen
 * Aufklapp-Pfeil, und darin die Zuweisung des Epic Owners — eine zweite Stelle
 * neben dem Overview, und die ältere von beiden. Sie ist fort.
 *
 * Ohne Test käme sie wieder: der Meilenstein *handelt* vom Owner („Der VMO
 * sichtet das Epic und benennt den Epic Owner"), und genau deshalb liegt es
 * nahe, das Feld dort erneut anzubringen. Was der Meilenstein besagt, und wo man
 * ihn auslöst, sind aber zwei Dinge.
 *
 * **Nur der zweite Test wäre am alten Stand rot gewesen** — die Box war
 * eingeklappt vorbelegt, ihr Inhalt also ohnehin nicht im Dokument. Der erste
 * und der dritte sind darum keine Nachweise, sondern Zusicherungen: der eine
 * fängt eine Rückkehr in beliebiger Form, der andere hält fest, was vom weichen
 * Tor übrig bleibt, damit der Rückbau nicht zum Einebnen wird.
 */

vi.mock("@/modules/work/features/portfolio/actions/timeline", () => ({
  saveTimelineAction: vi.fn(async () => ({}) as { error?: string; success?: boolean }),
}));

function setup(over: Partial<Parameters<typeof EpicTimelineTab>[0]> = {}) {
  return render(
    <EpicTimelineTab
      epicId="11111111-1111-4111-8111-111111111111"
      createdAt="2026-01-05T00:00:00.000Z"
      selectedForDetailingAt={null}
      hypothesisApprovedAt={null}
      selectedForAnalyzingAt={null}
      businessCaseApprovedAt={null}
      implementationStartedAt={null}
      impactRecognizedAt={null}
      approvedAt={null}
      implementationCompletedAt={null}
      timeline={{ estimates: {}, actuals: {} }}
      canEdit
      gateHistory={[]}
      userLabels={{}}
      lifecycleSteps={epicLifecycleSteps({
        stageGate: "L0",
        subStage: null,
        impactRecognizedAt: null,
        selectedForDetailingAt: null,
        selectedForAnalyzingAt: null,
      })}
      {...over}
    />,
  );
}

describe("EpicTimelineTab", () => {
  it("trägt kein Bedienelement für den Epic Owner", () => {
    setup();

    expect(screen.queryByRole("button", { name: "Owner zuweisen" })).toBeNull();
    expect(screen.queryByText("Epic Owner")).toBeNull();
    expect(screen.queryByText("Nicht zugewiesen")).toBeNull();
  });

  it("lässt sich an der Erstsichtung nicht aufklappen", () => {
    const { container } = setup();

    // Der Pfeil hing an genau dieser einen Zeile. Kein `aria-expanded` heisst:
    // die Bahn ist durchweg Anzeige.
    expect(container.querySelectorAll("[aria-expanded]")).toHaveLength(0);
  });

  it("unterscheidet den Meilenstein weiterhin vom Tor", () => {
    setup();

    // Das ist, was vom weichen Tor bleibt, nachdem die Box weg ist — ohne diese
    // Zusicherung wäre der Rückbau nicht vom Einebnen zu unterscheiden.
    expect(screen.getByText("Erstsichtung")).toBeInTheDocument();
    expect(screen.getAllByText("Meilenstein")).toHaveLength(1);
    expect(screen.getAllByText("Gate").length).toBeGreaterThan(1);
  });
});
