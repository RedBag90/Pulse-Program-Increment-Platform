import { describe, it, expect, vi, beforeEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleOnboardingMount } from "@/modules/onboarding/features/onboarding/components/role-onboarding-mount";
import { requestTour } from "@/modules/onboarding/features/onboarding/tour-channel";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import type { TourStep } from "@/modules/onboarding/domain/role-playbook";

/**
 * Der Regressionstest zum Knopf „Tour erneut starten": der startete die Tour
 * nicht, weil das Overlay nur aus dem Willkommensfenster heraus erreichbar war
 * und die Warteschlange auf `/meine-rolle` praktisch immer leer ist. Genau diese
 * Kombination wird hier festgehalten — leere Warteschlange **und** trotzdem eine
 * laufende Tour.
 */

const refresh = vi.hoisted(() => vi.fn());
const push = vi.hoisted(() => vi.fn());

// `@/i18n/navigation` zieht next-intl nach, das unter vitest nicht auflöst.
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ refresh, push, replace: vi.fn() }),
  usePathname: () => "/meine-rolle",
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

vi.mock("@/modules/onboarding/features/onboarding/actions/role-onboarding", () => ({
  acknowledgeRoleAction: vi.fn(async () => ({ success: true })),
  markStepsSeenAction: vi.fn(async () => ({ success: true })),
}));

/**
 * Schritte **ohne** `anchor`: dann greift sofort die zentrierte Karte, und der
 * Test braucht weder `scrollIntoView` noch das Nachfassen per
 * `requestAnimationFrame`, das die Ankersuche sonst betreibt.
 */
const STEPS: TourStep[] = [
  { key: "s1", title: "Erster Schritt", body: "Hier fängt es an.", route: "/my-tasks" },
  { key: "s2", title: "Zweiter Schritt", body: "Und hier weiter.", route: "/portfolio" },
];

describe("RoleOnboardingMount", () => {
  beforeEach(() => {
    refresh.mockClear();
    push.mockClear();
  });

  it("rendert nichts, solange es weder Hinweise noch einen Auftrag gibt", () => {
    const { container } = render(<RoleOnboardingMount notices={[]} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("startet die Tour auf Auftrag — auch bei leerer Warteschlange", async () => {
    render(<RoleOnboardingMount notices={[]} />);

    await React.act(async () => {
      requestTour({ role: ROLES.RTE, steps: STEPS });
    });

    expect(screen.getByRole("dialog")).toBeInTheDocument();
    expect(screen.getByText("Erster Schritt")).toBeInTheDocument();
    expect(screen.getByText("Schritt 1 von 2")).toBeInTheDocument();
  });

  it("die angeforderte Tour läuft durch alle Schritte", async () => {
    const user = userEvent.setup();
    render(<RoleOnboardingMount notices={[]} />);
    await React.act(async () => {
      requestTour({ role: ROLES.RTE, steps: STEPS });
    });

    await user.click(screen.getByRole("button", { name: "Weiter" }));
    expect(screen.getByText("Zweiter Schritt")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Fertig" })).toBeInTheDocument();
  });

  it("nach dem Ende ist das Overlay weg und die Seite wird aufgefrischt", async () => {
    const user = userEvent.setup();
    render(<RoleOnboardingMount notices={[]} />);
    await React.act(async () => {
      requestTour({ role: ROLES.RTE, steps: STEPS });
    });

    await user.click(screen.getByRole("button", { name: "Tour beenden" }));

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    // Ohne diesen Anstoß stünde `/meine-rolle` mit veralteten Haken da:
    // `markStepsSeenAction` revalidiert bewusst nicht.
    expect(refresh).toHaveBeenCalled();
  });

  it("meldet sich beim Abbau wieder ab — ein Auftrag ins Leere schadet nicht", async () => {
    const { unmount } = render(<RoleOnboardingMount notices={[]} />);
    unmount();

    await React.act(async () => {
      requestTour({ role: ROLES.RTE, steps: STEPS });
    });

    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
  });
});
