import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RolePlaybookPanel } from "@/modules/onboarding/features/onboarding/components/role-playbook-panel";
import { subscribeTour, type TourRequest } from "@/modules/onboarding/features/onboarding/tour-channel";
import { ROLE_PLAYBOOKS } from "@/modules/onboarding/domain/role-playbook";
import { resolveTour } from "@/modules/onboarding/domain/role-tour";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { DEFAULT_PRACTICES } from "@/modules/core/kernel/domain/operating-model";
import { POLICIES, type Action } from "@/server/auth/policies";
import type { ActionState } from "@/server/http/server-action";

/**
 * „Tour erneut starten" tat lange nur die Hälfte: es setzte den Fortschritt
 * zurück, startete aber keine Tour. Hier wird beides festgehalten — und dass
 * nichts startet, wenn das Zurücksetzen scheitert.
 *
 * Der Auftrag wird über den echten Kanal geprüft statt über einen Modul-Mock:
 * so deckt der Test die Verdrahtung mit ab, nicht nur den Aufruf.
 */

const restart = vi.hoisted(() => vi.fn(async (): Promise<ActionState> => ({ success: true })));

vi.mock("@/modules/onboarding/features/onboarding/actions/role-onboarding", () => ({
  restartTourAction: (...args: unknown[]) => restart(...(args as [])),
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, ...props }: { children: React.ReactNode }) => <a {...props}>{children}</a>,
}));

const tour = resolveTour(ROLE_PLAYBOOKS[ROLES.RTE], {
  enabledModules: MODULE_KEYS,
  practices: DEFAULT_PRACTICES,
  allowedCapabilities: new Set(Object.keys(POLICIES) as Action[]),
  availableData: new Set(["valueStream", "art", "epic", "feature", "pi", "risk", "goal"]),
});

let received: TourRequest[];
let unsubscribe: () => void;

beforeEach(() => {
  restart.mockClear();
  restart.mockResolvedValue({ success: true });
  received = [];
  unsubscribe = subscribeTour((r) => received.push(r));
});

afterEach(() => unsubscribe());

describe("RolePlaybookPanel", () => {
  it("startet nach dem Zurücksetzen tatsächlich eine Tour", async () => {
    const user = userEvent.setup();
    render(<RolePlaybookPanel role={ROLES.RTE} tour={tour} seenStepKeys={[]} />);

    await user.click(screen.getByRole("button", { name: /Tour erneut starten/i }));

    expect(restart).toHaveBeenCalledOnce();
    expect(received).toHaveLength(1);
    expect(received[0]?.role).toBe(ROLES.RTE);
    // Alle Schritte, nicht nur die offenen — „erneut starten" heißt von vorne.
    expect(received[0]?.steps).toEqual(tour.steps);
  });

  it("scheitert das Zurücksetzen, startet nichts", async () => {
    restart.mockResolvedValue({ error: "Die Tour konnte nicht zurückgesetzt werden" });
    const user = userEvent.setup();
    render(<RolePlaybookPanel role={ROLES.RTE} tour={tour} seenStepKeys={[]} />);

    await user.click(screen.getByRole("button", { name: /Tour erneut starten/i }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "Die Tour konnte nicht zurückgesetzt werden",
    );
    expect(received).toEqual([]);
  });

  it("zeigt den gespeicherten Fortschritt", () => {
    const firstKey = tour.steps[0]?.key ?? "";
    render(<RolePlaybookPanel role={ROLES.RTE} tour={tour} seenStepKeys={[firstKey]} />);
    expect(screen.getByText(`1 / ${tour.total}`)).toBeInTheDocument();
  });
});
