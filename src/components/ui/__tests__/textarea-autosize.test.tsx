import { describe, it, expect, afterEach } from "vitest";
import { render, fireEvent, act } from "@testing-library/react";
import { TextareaAutosize } from "@/components/ui/textarea-autosize";

/**
 * **Textfelder wachsen mit** — jsdom rechnet keine Layouts; der Test legt
 * `scrollHeight` und die Rahmenbreite fest und prüft, was daraus wird.
 */
function feld(scroll: number, attrs: Record<string, string> = {}) {
  const el = document.createElement("textarea");
  for (const [k, v] of Object.entries(attrs)) el.setAttribute(k, v);
  Object.defineProperty(el, "scrollHeight", { configurable: true, get: () => scroll });
  Object.defineProperty(el, "offsetHeight", { configurable: true, get: () => 42 });
  Object.defineProperty(el, "clientHeight", { configurable: true, get: () => 40 });
  return el;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("TextareaAutosize", () => {
  it("Eingabe setzt die Höhe auf den Inhalt plus Rahmen", () => {
    const el = feld(120);
    document.body.appendChild(el);
    render(<TextareaAutosize />);
    fireEvent.input(el);
    expect(el.style.height).toBe("122px");
  });

  it("vorbefüllte Felder passen sich beim Einhängen an", () => {
    const el = feld(300);
    document.body.appendChild(el);
    render(<TextareaAutosize />);
    expect(el.style.height).toBe("302px");
  });

  it("ein später erscheinendes Feld wird angepasst", async () => {
    render(<TextareaAutosize />);
    const el = feld(90);
    await act(async () => {
      document.body.appendChild(el);
      await Promise.resolve();
    });
    expect(el.style.height).toBe("92px");
  });

  it("data-autosize=off bleibt unberührt", () => {
    const el = feld(500, { "data-autosize": "off" });
    document.body.appendChild(el);
    render(<TextareaAutosize />);
    fireEvent.input(el);
    expect(el.style.height).toBe("");
  });
});
