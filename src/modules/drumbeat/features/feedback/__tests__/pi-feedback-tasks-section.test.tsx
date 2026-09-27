import { describe, it, expect, vi } from "vitest";
import type { ReactNode } from "react";
import { render, screen } from "@testing-library/react";

vi.mock("@/i18n/navigation", () => ({
  Link: ({
    href,
    children,
    className,
  }: {
    href: string;
    children: ReactNode;
    className?: string;
  }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));
import { PiFeedbackTasksSection } from "@/modules/drumbeat/features/feedback/components/pi-feedback-tasks-section";
import type { MyPiFeedbackTask } from "@/modules/drumbeat/server/views/pi-feedback-view";

/** **„Feedback angefragt“ in My Tasks** — offen führt zur Seite, überfällig rot. */
const task = (over: Partial<MyPiFeedbackTask>): MyPiFeedbackTask => ({
  requestId: "req",
  piName: "PI 2",
  artName: "Service & Contact Center",
  requestedBy: "u-rte",
  dueDate: new Date("2026-04-18T00:00:00Z"),
  overdue: false,
  status: "pending",
  submittedAt: null,
  closed: false,
  href: "/umsetzung/feedback/req",
  ...over,
});

describe("PiFeedbackTasksSection", () => {
  it("ohne Aufgabe nichts", () => {
    const { container } = render(<PiFeedbackTasksSection tasks={[]} userLabels={{}} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("offene Anfrage: Link „Feedback geben“ zur Seite", () => {
    render(<PiFeedbackTasksSection tasks={[task({})]} userLabels={{ "u-rte": "Lena Vogt" }} />);
    expect(screen.getByText("Feedback angefragt")).toBeInTheDocument();
    expect(screen.getByText(/Lena Vogt/)).toBeInTheDocument();
    expect(screen.getByRole("link", { name: "Feedback geben" })).toHaveAttribute(
      "href",
      expect.stringContaining("/umsetzung/feedback/req"),
    );
  });

  it("überfällig steht rot da", () => {
    render(<PiFeedbackTasksSection tasks={[task({ overdue: true })]} userLabels={{}} />);
    expect(screen.getByText(/überfällig/).className).toMatch(/destructive/);
  });

  it("abgeschickt: ändern, solange nicht übernommen — danach nicht mehr", () => {
    const erledigt = { status: "submitted" as const, submittedAt: new Date("2026-04-12") };
    const { rerender } = render(
      <PiFeedbackTasksSection tasks={[task(erledigt)]} userLabels={{}} />,
    );
    expect(screen.getByRole("link", { name: "Antwort ändern" })).toBeInTheDocument();
    rerender(
      <PiFeedbackTasksSection tasks={[task({ ...erledigt, closed: true })]} userLabels={{}} />,
    );
    expect(screen.queryByRole("link")).toBeNull();
  });
});
