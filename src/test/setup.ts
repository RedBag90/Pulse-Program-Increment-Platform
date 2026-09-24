import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest does not auto-cleanup DOM between tests when `globals: true` is paired
// with @testing-library/react ≥ 13 — opt in explicitly so render() output
// doesn't leak across cases.
afterEach(() => {
  cleanup();
});

/**
 * jsdom kennt `ResizeObserver` nicht. Alles, was seine Größe selbst misst,
 * bricht daran — React Flow (Netzplan, Ziel-Netz, Epic-Breakdown) und der
 * Horizont-Trichter. Die Attrappe misst nichts; sie sorgt nur dafür, dass der
 * Aufruf nicht wirft, damit sich solche Flächen überhaupt rendern lassen.
 */
if (!("ResizeObserver" in globalThis)) {
  class ResizeObserverStub {
    observe(): void {}
    unobserve(): void {}
    disconnect(): void {}
  }
  (globalThis as { ResizeObserver?: unknown }).ResizeObserver = ResizeObserverStub;
}

/** Dasselbe für die Matrix, die React Flow zum Umrechnen des Viewports nutzt. */
if (!("DOMMatrixReadOnly" in globalThis)) {
  class DOMMatrixReadOnlyStub {
    m22 = 1;
    constructor(_transform?: string) {}
  }
  (globalThis as { DOMMatrixReadOnly?: unknown }).DOMMatrixReadOnly = DOMMatrixReadOnlyStub;
}

// Die Sprach-Attrappen liegen eigens, weil der Server-Lauf sie auch braucht,
// die DOM-Teile oben aber nicht (siehe `setup-i18n.ts`).
import "@/test/setup-i18n";
