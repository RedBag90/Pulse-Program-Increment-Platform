import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { RoleTourOverlay } from "@/modules/onboarding/features/onboarding/components/role-tour-overlay";
import { ROLE_PLAYBOOKS } from "@/modules/onboarding/domain/role-playbook";
import { resolveTour } from "@/modules/onboarding/domain/role-tour";
import { ROLES } from "@/modules/core/kernel/domain/roles";
import { MODULE_KEYS } from "@/modules/core/kernel/domain/modules";
import { DEFAULT_PRACTICES } from "@/modules/core/kernel/domain/operating-model";
import { POLICIES, type Action } from "@/server/auth/policies";
import type { ActionState } from "@/server/http/server-action";

/**
 * **Ein Abbruch mitten in der Tour war die zweite Hälfte derselben Schleife.**
 *
 * „Tour beenden" rief nur `onFinish()`. Gemeldet wurden Schritte allein beim
 * Weiterblättern — wer abbrach, hinterliess alle folgenden offen und bekam beim
 * nächsten Seitenaufbau denselben Hinweis erneut angeboten, unbegrenzt oft.
 */

// Die Argumente gehoeren in die Signatur der Attrappe, nicht nur in den Aufruf:
// sonst haelt TypeScript die Aufrufliste fuer leer und `mock.calls[0][1]` fuer
// einen Fehler — obwohl der Test zur Laufzeit laeuft.
const markSeen = vi.fn(
  async (_state: unknown, _fd: FormData): Promise<ActionState> => ({ success: true }),
);
const dismiss = vi.fn(
  async (_state: unknown, _fd: FormData): Promise<ActionState> => ({ success: true }),
);

vi.mock("@/modules/onboarding/features/onboarding/actions/role-onboarding", () => ({
  markStepsSeenAction: (...args: Parameters<typeof markSeen>) => markSeen(...args),
  dismissTourStepsAction: (...args: Parameters<typeof dismiss>) => dismiss(...args),
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  usePathname: () => "/portfolio",
}));

const tour = resolveTour(ROLE_PLAYBOOKS[ROLES.RTE], {
  enabledModules: MODULE_KEYS,
  practices: DEFAULT_PRACTICES,
  allowedCapabilities: new Set(Object.keys(POLICIES) as Action[]),
  availableData: new Set(["valueStream", "art", "epic", "feature", "pi", "risk", "goal"]),
});

const STEPS = tour.steps.slice(0, 3);

/**
 * Die Anker der Tour in den DOM stellen.
 *
 * Ohne sie sucht das Overlay seinen Anker per `requestAnimationFrame` weiter,
 * bis ein Zeitfenster abläuft (Seiten streamen nach) — die Karte erschiene im
 * Test erst nach Sekunden. Mit Ankern misst es sofort.
 */
function ankerStellen(): void {
  for (const step of STEPS) {
    if (!step.anchor) continue;
    const el = document.createElement("div");
    el.setAttribute("data-tour", step.anchor);
    document.body.appendChild(el);
  }
}

beforeEach(() => {
  markSeen.mockClear();
  dismiss.mockClear();
  document.body.innerHTML = "";
  // jsdom kennt `scrollIntoView` nicht — das Overlay holt sein Ziel ins Bild,
  // bevor es misst.
  Element.prototype.scrollIntoView = vi.fn();
  ankerStellen();
});

/** Die Schritt-Schlüssel, die eine gemockte Action mitbekommen hat. */
const keysOf = (fn: typeof dismiss): string[] =>
  fn.mock.calls[0]?.[1].getAll("stepKeys").map(String) ?? [];

describe("RoleTourOverlay — Abbruch", () => {
  it("merkt die noch nicht begangenen Schritte als abgelehnt", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<RoleTourOverlay role={ROLES.RTE} steps={STEPS} onFinish={onFinish} />);

    await user.click(screen.getByRole("button", { name: "Tour beenden" }));

    // Der **aktuelle** Schritt zählt mit: gesehen ist er erst, wenn man ihn
    // verlässt — hier bricht man auf ihm ab.
    expect(keysOf(dismiss)).toEqual(STEPS.map((s) => s.key));
    expect(onFinish).toHaveBeenCalledOnce();
  });

  it("meldet sie nicht als gesehen — das wäre eine andere Aussage", async () => {
    // „Gesehen" und „abgelehnt" getrennt zu halten ist der Grund, warum „Tour
    // erneut starten" beides abräumen kann.
    const user = userEvent.setup();
    render(<RoleTourOverlay role={ROLES.RTE} steps={STEPS} onFinish={vi.fn()} />);

    await user.click(screen.getByRole("button", { name: "Tour beenden" }));

    expect(markSeen).not.toHaveBeenCalled();
  });

  it("lässt nach dem letzten Schritt nichts abzulehnen übrig", async () => {
    const user = userEvent.setup();
    const onFinish = vi.fn();
    render(<RoleTourOverlay role={ROLES.RTE} steps={STEPS.slice(0, 1)} onFinish={onFinish} />);

    // Ein Schritt, durchgeblättert: „Fertig" meldet ihn als gesehen und
    // beendet regulär. Eine Ablehnung wäre hier falsch.
    await user.click(screen.getByRole("button", { name: "Fertig" }));

    expect(keysOf(markSeen)).toEqual([STEPS[0]!.key]);
    expect(dismiss).not.toHaveBeenCalled();
    expect(onFinish).toHaveBeenCalledOnce();
  });
});
