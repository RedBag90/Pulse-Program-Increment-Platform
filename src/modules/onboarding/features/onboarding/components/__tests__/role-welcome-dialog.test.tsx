import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleWelcomeDialog } from "@/modules/onboarding/features/onboarding/components/role-welcome-dialog";
import { ROLE_PLAYBOOKS } from "@/modules/onboarding/domain/role-playbook";
import { resolveTour, type Notice } from "@/modules/onboarding/domain/role-tour";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { catalogTranslate } from "@/test/helpers/catalog";

const t = catalogTranslate("de");
import { DEFAULT_PRACTICES } from "@/modules/core/kernel/domain/operating-model";
import { POLICIES, type Action } from "@/server/auth/policies";
import type { ActionState } from "@/server/http/server-action";

const acknowledge = vi.fn(async (): Promise<ActionState> => ({ success: true }));
const dismiss = vi.fn(
  async (_state: unknown, _fd: FormData): Promise<ActionState> => ({ success: true }),
);

vi.mock("@/modules/onboarding/features/onboarding/actions/role-onboarding", () => ({
  acknowledgeRoleAction: (...args: unknown[]) => acknowledge(...(args as [])),
  dismissTourStepsAction: (...args: Parameters<typeof dismiss>) => dismiss(...args),
}));

/**
 * Der Dialog ruft eine Server-Action aus einem Button heraus auf. React verlangt
 * dafür eine Transition — ohne sie schreibt es „An async function with
 * useActionState was called outside of a transition" in die Konsole. Genau das
 * ist einmal passiert, deshalb prüft der erste Test hier auf eine **stumme
 * Konsole**: der Fehler ist nur eine Warnung, keine Exception, und rutscht sonst
 * unbemerkt durch.
 */

const tour = resolveTour(ROLE_PLAYBOOKS[ROLES.RTE], {
  enabledModules: MODULE_KEYS,
  practices: DEFAULT_PRACTICES,
  allowedCapabilities: new Set(Object.keys(POLICIES) as Action[]),
  availableData: new Set(["valueStream", "art", "epic", "feature", "pi", "risk", "goal"]),
});

const newRole: Notice = { kind: "new_role", role: ROLES.RTE, tour, open: tour.steps };

let consoleError: ReturnType<typeof vi.spyOn>;

beforeEach(() => {
  acknowledge.mockClear();
  acknowledge.mockResolvedValue({ success: true });
  dismiss.mockClear();
  dismiss.mockResolvedValue({ success: true });
  consoleError = vi.spyOn(console, "error").mockImplementation(() => {});
});

afterEach(() => {
  consoleError.mockRestore();
});

describe("RoleWelcomeDialog", () => {
  it("quittiert ohne React-Transition-Warnung in der Konsole", async () => {
    const user = userEvent.setup();
    render(<RoleWelcomeDialog notice={newRole} onStartTour={vi.fn()} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Tour starten/i }));

    expect(acknowledge).toHaveBeenCalledOnce();
    const warnings = consoleError.mock.calls.map((c) => String(c[0]));
    expect(warnings.filter((w) => w.includes("outside of a transition"))).toEqual([]);
  });

  it("startet die Tour erst, wenn die Quittung durch ist", async () => {
    const user = userEvent.setup();
    const onStartTour = vi.fn();
    render(<RoleWelcomeDialog notice={newRole} onStartTour={onStartTour} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Tour starten/i }));
    expect(onStartTour).toHaveBeenCalledOnce();
  });

  it("bleibt stehen und zeigt den Fehler, wenn die Quittung scheitert", async () => {
    // Sonst verschwindet das Fenster, der Nutzer glaubt es sei erledigt — und
    // beim nächsten Laden ist es wieder da, ohne Erklärung.
    acknowledge.mockResolvedValue({ error: "Die Rolle konnte nicht bestätigt werden" });
    const user = userEvent.setup();
    const onStartTour = vi.fn();
    render(<RoleWelcomeDialog notice={newRole} onStartTour={onStartTour} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: /Tour starten/i }));

    expect(onStartTour).not.toHaveBeenCalled();
    expect(await screen.findByRole("alert")).toHaveTextContent(/nicht bestätigt/i);
  });

  it("zeigt Mission und Verantwortung der Rolle", () => {
    render(<RoleWelcomeDialog notice={newRole} onStartTour={vi.fn()} onDismiss={vi.fn()} />);
    // Die Fläche zeigt das Wort, der Tour-Bau den Schlüssel.
    expect(screen.getByText(t(tour.missionKey))).toBeInTheDocument();
    for (const schluessel of tour.responsibilityKeys) {
      // Vorher stand hier `getByText(r)` — der **Schlüssel**. Der Test war grün,
      // weil die Fläche ihn tatsächlich roh zeichnete. Er nagelte den Fehler
      // fest, statt ihn zu finden.
      expect(screen.getByText(t(schluessel))).toBeInTheDocument();
    }
  });

  it("leere Tour: keine Tour-Schaltfläche, sondern ein ehrlicher Hinweis", async () => {
    const empty: Notice = {
      kind: "new_role",
      role: ROLES.FEATURE_OWNER,
      tour: { ...tour, role: ROLES.FEATURE_OWNER, steps: [], total: 0 },
      open: [],
    };
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<RoleWelcomeDialog notice={empty} onStartTour={vi.fn()} onDismiss={onDismiss} />);

    expect(screen.queryByRole("button", { name: /Tour starten/i })).not.toBeInTheDocument();
    expect(screen.getByText(/nichts freigeschaltet/i)).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Verstanden" }));
    expect(acknowledge).toHaveBeenCalledOnce();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("new_scope quittiert nicht — die Rolle ist längst angenommen", async () => {
    const scope: Notice = {
      kind: "new_scope",
      role: ROLES.RTE,
      tour,
      open: tour.steps.slice(0, 2),
      modules: ["drumbeat"],
    };
    const user = userEvent.setup();
    const onStartTour = vi.fn();
    render(<RoleWelcomeDialog notice={scope} onStartTour={onStartTour} onDismiss={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Ansehen" }));
    expect(onStartTour).toHaveBeenCalledOnce();
    expect(acknowledge).not.toHaveBeenCalled();
  });
});

describe("„Nicht mehr anzeigen“", () => {
  const scope: Notice = {
    kind: "new_scope",
    role: ROLES.RTE,
    tour,
    open: tour.steps.slice(0, 2),
    modules: ["drumbeat"],
  };

  it("merkt sich genau die offenen Schritte und schliesst", async () => {
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<RoleWelcomeDialog notice={scope} onStartTour={vi.fn()} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Nicht mehr anzeigen" }));

    expect(dismiss).toHaveBeenCalledOnce();
    const fd = dismiss.mock.calls[0]?.[1];
    expect(fd?.get("role")).toBe(ROLES.RTE);
    expect(fd?.getAll("stepKeys")).toEqual(scope.open.map((s) => s.key));
    expect(onDismiss).toHaveBeenCalledOnce();
    // Die Rolle ist längst angenommen — hier wird nichts quittiert.
    expect(acknowledge).not.toHaveBeenCalled();
  });

  it("lässt „Nicht jetzt“ flüchtig — dort wird weiterhin nichts gespeichert", async () => {
    // Zwei Knöpfe, zwei Bedeutungen. Wer heute wegklickt, hat nichts
    // entschieden; nur der zweite Knopf ist eine Entscheidung.
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(<RoleWelcomeDialog notice={scope} onStartTour={vi.fn()} onDismiss={onDismiss} />);

    await user.click(screen.getByRole("button", { name: "Nicht jetzt" }));

    expect(dismiss).not.toHaveBeenCalled();
    expect(onDismiss).toHaveBeenCalledOnce();
  });

  it("steht an einer frisch zugewiesenen Rolle nicht", async () => {
    // `new_role` will einmal aktiv angenommen werden — ein „nie wieder" vor der
    // ersten Kenntnisnahme wäre ein Knopf, der die Vorstellung überspringt.
    render(<RoleWelcomeDialog notice={newRole} onStartTour={vi.fn()} onDismiss={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Nicht mehr anzeigen" })).not.toBeInTheDocument();
  });
});
