import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import type { ReactNode } from "react";
import type {
  PeriodDetailModel,
  PbListEntry,
} from "@/modules/budgeting/server/views/period-detail";

/**
 * **Ein Kandidat ist ein Epic ODER eine Run-the-Business-Position.**
 *
 * Gemeldet wurde: eine Kachel zeigte „0 Epics · 1 RtB" und eine PB-Liste über
 * 147.500 €, und darunter sperrte „Runde starten" mit der Begründung, die Liste
 * sei leer. Gezählt wurden nur die Epics — obwohl siebzehn Zeilen tiefer
 * dieselbe Datei die Liste aus beiden Sorten baut.
 *
 * Die RtB-Zeilen sind im Entwurf eine **Vorschau**: sie werden erst beim Start
 * zu Kandidaten. Genau sie zu zählen ist trotzdem richtig — sie sind das, was
 * beim Start entsteht, und der Dienst dahinter startet eine reine RtB-Runde
 * bereits klaglos (`round-service.test.ts`).
 */

const noop = vi.fn(async () => ({}) as { error?: string });

vi.mock("@/modules/budgeting/features/actions/period-setup", () => ({
  addParticipantAction: noop,
  removeParticipantAction: noop,
  addEpicCandidateAction: noop,
  removeCandidateAction: noop,
  updatePeriodFrameAction: noop,
  startPeriodAction: noop,
}));
vi.mock("@/modules/budgeting/features/actions/round", () => ({
  addGroupAction: noop,
  removeGroupAction: noop,
  updateGroupAction: noop,
  addGroupMemberAction: noop,
  removeGroupMemberAction: noop,
}));
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...rest }: { children?: ReactNode; href?: string }) => (
    <a {...rest}>{children}</a>
  ),
}));

const { PeriodSetupTab } =
  await import("@/modules/budgeting/features/components/period/period-setup-tab");

const entry = (kind: "epic" | "rtb", title: string, ask: number): PbListEntry => ({
  id: `${kind}-${title}`,
  sourceId: `${kind}-${title}`,
  kind,
  title,
  ask,
  valueStreamName: "Elefanten-Wertstrom 1",
  solutionName: null,
});

function model(over: Partial<PeriodDetailModel> = {}): PeriodDetailModel {
  return {
    round: {
      id: "r1",
      cycleKey: "2026-H2",
      status: "draft",
      poolTotal: 1_000_000,
      startDate: new Date("2026-07-01"),
      endDate: new Date("2026-12-31"),
      submissionDeadline: null,
    },
    distributable: 1_000_000,
    participants: [],
    groups: [
      {
        id: "g1",
        name: "Gruppe A",
        spokespersonId: null,
        members: [{ id: "m1", userId: "u1", label: "a@x.test", isSubmitter: true, hasRead: false }],
      },
    ],
    eligibleEpics: [],
    artEpicsFilteredOut: 0,
    epicCandidates: [],
    rtbCandidates: [],
    rtbIsPreview: true,
    users: [{ id: "u1", label: "a@x.test" }],
    canManage: true,
    ...over,
  };
}

const LEER = "Die PB-Liste ist leer — ohne Kandidaten gibt es nichts zu verteilen.";
const startKnopf = () => screen.getByRole("button", { name: "Runde starten" });

describe("PeriodSetupTab — wann die Runde starten darf", () => {
  it("lässt starten, wenn nur eine Run-the-Business-Position auf der Liste steht", () => {
    // Der gemeldete Fall: 0 Epics, 1 RtB über 147.500 €.
    render(
      <PeriodSetupTab
        model={model({ rtbCandidates: [entry("rtb", "Elefanten-Wertstrom 1", 147_500)] })}
      />,
    );

    expect(startKnopf()).not.toBeDisabled();
    expect(screen.queryByText(LEER)).toBeNull();
  });

  it("sperrt weiterhin, wenn wirklich nichts auf der Liste steht", () => {
    render(<PeriodSetupTab model={model()} />);

    expect(startKnopf()).toBeDisabled();
    expect(screen.getByText(LEER)).toBeInTheDocument();
  });

  it("nennt die fehlende Gruppe zuerst — sie wiegt schwerer als die Liste", () => {
    render(
      <PeriodSetupTab
        model={model({
          rtbCandidates: [entry("rtb", "Elefanten-Wertstrom 1", 147_500)],
          groups: [{ id: "g1", name: "Gruppe A", spokespersonId: null, members: [] }],
        })}
      />,
    );

    expect(startKnopf()).toBeDisabled();
    expect(
      screen.getByText("Erst möglich, wenn mindestens eine Gruppe ein Mitglied hat."),
    ).toBeInTheDocument();
  });

  it("hakt Schritt 2 auch ab, wenn die Liste nur Run-the-Business trägt", () => {
    // Vorher stand „0 Epics · 1 RtB" neben einem ungehakten Schritt — die
    // Zustandszeile zählte beide Sorten, das Häkchen nur eine.
    const { container } = render(
      <PeriodSetupTab
        model={model({ rtbCandidates: [entry("rtb", "Elefanten-Wertstrom 1", 147_500)] })}
      />,
    );

    expect(screen.getByText("0 Epics · 1 RtB")).toBeInTheDocument();

    // Der erledigte Schritt trägt „✓" statt seiner Nummer — geprüft an der
    // Marke selbst, nicht an irgendeinem Symbol im Schritt: die Liste darunter
    // bringt eigene mit, und daran gemessen wäre der Test immer grün.
    const schritte = container.querySelector("ol")!.children;
    const marken = [...schritte].map((li) => li.firstElementChild?.textContent);
    expect(marken).toEqual(["✓", "✓", "✓", "4"]);
  });
});
