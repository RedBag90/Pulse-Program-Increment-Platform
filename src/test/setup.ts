import "@testing-library/jest-dom";
import { afterEach } from "vitest";
import { cleanup } from "@testing-library/react";

// Vitest does not auto-cleanup DOM between tests when `globals: true` is paired
// with @testing-library/react ≥ 13 — opt in explicitly so render() output
// doesn't leak across cases.
afterEach(() => {
  cleanup();
});
