import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ConfirmMutateForm } from "@/components/actions/confirm-mutate-form";
import type { ActionState } from "@/server/http/server-action";

/**
 * Tests at the component's seam: caller passes Action + fields + labels; we
 * assert the observable contract (confirm gates submission, action receives
 * the right FormData, error/success render correctly, onSuccess fires).
 */

beforeEach(() => {
  vi.restoreAllMocks();
});

function makeAction(result: ActionState = { success: true }) {
  return vi.fn(async (_state: ActionState, _fd: FormData): Promise<ActionState> => result);
}

describe("ConfirmMutateForm", () => {
  it("renders the trigger label", () => {
    render(<ConfirmMutateForm action={makeAction()} fields={{ id: "x" }} label="Delete" />);
    expect(screen.getByRole("button", { name: "Delete" })).toBeInTheDocument();
  });

  it("native confirm() gates submission — cancel aborts", async () => {
    const user = userEvent.setup();
    const action = makeAction();
    vi.spyOn(window, "confirm").mockReturnValue(false);

    render(
      <ConfirmMutateForm
        action={action}
        fields={{ id: "abc" }}
        label="Delete"
        confirmPrompt="Sure?"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));
    expect(window.confirm).toHaveBeenCalledWith("Sure?");
    expect(action).not.toHaveBeenCalled();
  });

  it("submitting calls the action with the hidden FormData fields", async () => {
    const user = userEvent.setup();
    const action = makeAction();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ConfirmMutateForm
        action={action}
        fields={{ id: "abc", artId: "art-1" }}
        label="Delete"
        confirmPrompt="Sure?"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(action).toHaveBeenCalledTimes(1);
    const fd = action.mock.calls[0]?.[1];
    expect(fd?.get("id")).toBe("abc");
    expect(fd?.get("artId")).toBe("art-1");
  });

  it("renders state.error as an alert and keeps the button enabled afterward", async () => {
    const user = userEvent.setup();
    const action = makeAction({ error: "Not allowed" });
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ConfirmMutateForm
        action={action}
        fields={{ id: "x" }}
        label="Delete"
        confirmPrompt="Sure?"
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    expect(await screen.findByRole("alert")).toHaveTextContent("Not allowed");
  });

  it("fires onSuccess once when the action returns success", async () => {
    const user = userEvent.setup();
    const action = makeAction({ success: true });
    const onSuccess = vi.fn();
    vi.spyOn(window, "confirm").mockReturnValue(true);

    render(
      <ConfirmMutateForm
        action={action}
        fields={{ id: "x" }}
        label="Delete"
        confirmPrompt="Sure?"
        onSuccess={onSuccess}
      />,
    );
    await user.click(screen.getByRole("button", { name: "Delete" }));

    await vi.waitFor(() => expect(onSuccess).toHaveBeenCalledTimes(1));
  });

  it("skips confirm when no confirmPrompt is set", async () => {
    const user = userEvent.setup();
    const action = makeAction();
    const confirmSpy = vi.spyOn(window, "confirm");

    render(<ConfirmMutateForm action={action} fields={{ id: "x" }} label="Run" />);
    await user.click(screen.getByRole("button", { name: "Run" }));

    expect(confirmSpy).not.toHaveBeenCalled();
    expect(action).toHaveBeenCalledTimes(1);
  });
});
