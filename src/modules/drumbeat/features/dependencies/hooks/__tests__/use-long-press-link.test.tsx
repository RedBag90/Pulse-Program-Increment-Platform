import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, act, fireEvent } from "@testing-library/react";
import {
  useLongPressLink,
  HALTEZEIT_MS,
} from "@/modules/drumbeat/features/dependencies/hooks/use-long-press-link";
import type { LinkDrop } from "@/modules/drumbeat/domain/long-press-link";

/**
 * **Halten, ziehen, loslassen** — die Geste mit echten Touch-Ereignissen in
 * jsdom. `elementFromPoint` gibt es dort nicht; der Test stellt es auf das
 * Element, über dem der Finger gerade „ist".
 */
function Flaeche({ onDrop }: { onDrop: (d: LinkDrop) => void }) {
  const { ref, preview } = useLongPressLink({ enabled: true, onDrop });
  return (
    <div ref={ref}>
      <div data-dep-node="a">A</div>
      <div data-dep-node="b">B</div>
      <svg>
        <path data-dep-edge="d1" data-dep-from="a" data-dep-to="b" />
      </svg>
      <span data-testid="stand">
        {preview ? `${preview.gesture.kind}:${preview.targetId}` : "-"}
      </span>
    </div>
  );
}

const touch = (x: number, y: number) => ({ touches: [{ clientX: x, clientY: y }] });

let unter: Element | null = null;
beforeEach(() => {
  vi.useFakeTimers();
  document.elementFromPoint = () => unter;
});
afterEach(() => {
  vi.useRealTimers();
});

function rahmen(el: Element, x: number) {
  el.getBoundingClientRect = () =>
    ({ left: x, top: 0, width: 20, height: 20, right: x + 20, bottom: 20 }) as DOMRect;
}

describe("useLongPressLink", () => {
  it("Feature halten, auf ein anderes ziehen, loslassen: neue Abhängigkeit", () => {
    const onDrop = vi.fn();
    const { getByText, getByTestId } = render(<Flaeche onDrop={onDrop} />);
    const a = getByText("A");
    const b = getByText("B");
    fireEvent.touchStart(a, touch(5, 5));
    act(() => vi.advanceTimersByTime(HALTEZEIT_MS));
    expect(getByTestId("stand").textContent).toBe("create:null");
    unter = b;
    fireEvent.touchMove(a, touch(100, 5));
    expect(getByTestId("stand").textContent).toBe("create:b");
    expect(b.getAttribute("data-dep-target")).toBe("true");
    fireEvent.touchEnd(a, { touches: [] });
    expect(onDrop).toHaveBeenCalledWith({ kind: "create", fromId: "a", toId: "b" });
    expect(b.hasAttribute("data-dep-target")).toBe(false);
  });

  it("Bewegung vor Ablauf der Haltezeit: nichts — das ist Schieben oder Scrollen", () => {
    const onDrop = vi.fn();
    const { getByText, getByTestId } = render(<Flaeche onDrop={onDrop} />);
    fireEvent.touchStart(getByText("A"), touch(5, 5));
    fireEvent.touchMove(getByText("A"), touch(40, 5));
    act(() => vi.advanceTimersByTime(HALTEZEIT_MS));
    expect(getByTestId("stand").textContent).toBe("-");
    unter = getByText("B");
    fireEvent.touchEnd(getByText("A"), { touches: [] });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("loslassen daneben: nichts", () => {
    const onDrop = vi.fn();
    const { getByText } = render(<Flaeche onDrop={onDrop} />);
    fireEvent.touchStart(getByText("A"), touch(5, 5));
    act(() => vi.advanceTimersByTime(HALTEZEIT_MS));
    unter = null;
    fireEvent.touchMove(getByText("A"), touch(300, 300));
    fireEvent.touchEnd(getByText("A"), { touches: [] });
    expect(onDrop).not.toHaveBeenCalled();
  });

  it("Kante halten greift das nähere Ende und versetzt es", () => {
    const onDrop = vi.fn();
    const { getByText, container } = render(<Flaeche onDrop={onDrop} />);
    rahmen(getByText("A"), 0);
    rahmen(getByText("B"), 200);
    const kante = container.querySelector("[data-dep-edge]")!;
    // Näher an B (Ziel) gehalten → das Ziel wird versetzt; losgelassen über A
    // ergäbe a→a, also nichts; über einem dritten Knoten: versetzen.
    const c = document.createElement("div");
    c.setAttribute("data-dep-node", "c");
    container.firstElementChild!.appendChild(c);
    fireEvent.touchStart(kante, touch(190, 10));
    act(() => vi.advanceTimersByTime(HALTEZEIT_MS));
    unter = c;
    fireEvent.touchMove(kante, touch(260, 10));
    fireEvent.touchEnd(kante, { touches: [] });
    expect(onDrop).toHaveBeenCalledWith({
      kind: "relink",
      depId: "d1",
      newFromId: "a",
      newToId: "c",
    });
  });

  it("Maus-Ereignisse lösen nichts aus", () => {
    const onDrop = vi.fn();
    const { getByText, getByTestId } = render(<Flaeche onDrop={onDrop} />);
    fireEvent.mouseDown(getByText("A"));
    act(() => vi.advanceTimersByTime(HALTEZEIT_MS * 2));
    expect(getByTestId("stand").textContent).toBe("-");
  });
});
