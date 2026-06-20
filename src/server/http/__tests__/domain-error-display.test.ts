import { describe, it, expect } from "vitest";
import { formatDomainError } from "@/server/http/domain-error-display";
import type { DomainError } from "@/domain/errors";

const errs: Record<DomainError["kind"], DomainError> = {
  not_found: { kind: "not_found", resourceType: "Epic", id: "x" },
  conflict: { kind: "conflict", reason: "Endedatum vor Startdatum" },
  forbidden: { kind: "forbidden", reason: "scope" },
  tenant_mismatch: { kind: "tenant_mismatch", detail: "—" },
  validation: { kind: "validation", issues: [] },
  hierarchy_violation: {
    kind: "hierarchy_violation",
    violatedConstraint: "x",
    detail: "Feature gehört zu anderer ART",
  },
  pyramid_violated: { kind: "pyramid_violated", kpiId: "k", existingKeyResultId: "kr" },
};

describe("formatDomainError — defaults", () => {
  it("conflict → e.reason verbatim", () => {
    expect(formatDomainError(errs.conflict)).toBe("Endedatum vor Startdatum");
  });

  it("not_found → localised resource label + 'nicht gefunden'", () => {
    expect(formatDomainError(errs.not_found)).toBe("Epic nicht gefunden");
    expect(formatDomainError({ kind: "not_found", resourceType: "Team", id: "x" })).toBe(
      "Team nicht gefunden",
    );
    expect(formatDomainError({ kind: "not_found", resourceType: "PiStandard", id: "x" })).toBe(
      "PI-Standard nicht gefunden",
    );
  });

  it("unknown resource type falls back to its raw name", () => {
    expect(formatDomainError({ kind: "not_found", resourceType: "GadgetX", id: "x" })).toBe(
      "GadgetX nicht gefunden",
    );
  });

  it("forbidden → fixed German default", () => {
    expect(formatDomainError(errs.forbidden)).toBe("Keine Berechtigung");
  });

  it("tenant_mismatch → fixed German default", () => {
    expect(formatDomainError(errs.tenant_mismatch)).toBe("Mandantenzuordnung passt nicht");
  });

  it("validation → fixed German default", () => {
    expect(formatDomainError(errs.validation)).toBe("Eingabe ungültig");
  });

  it("hierarchy_violation → e.detail", () => {
    expect(formatDomainError(errs.hierarchy_violation)).toBe("Feature gehört zu anderer ART");
  });

  it("pyramid_violated → fixed German default", () => {
    expect(formatDomainError(errs.pyramid_violated)).toBe(
      "KPI ist bereits an einen anderen Key Result gebunden",
    );
  });
});

describe("formatDomainError — overrides", () => {
  it("overrides.notFound replaces only the not_found message", () => {
    expect(formatDomainError(errs.not_found, { notFound: "Story not found" })).toBe(
      "Story not found",
    );
    expect(formatDomainError(errs.conflict, { notFound: "Story not found" })).toBe(
      "Endedatum vor Startdatum",
    );
  });

  it("overrides.conflict replaces the conflict's reason", () => {
    expect(formatDomainError(errs.conflict, { conflict: "Aktion nicht möglich" })).toBe(
      "Aktion nicht möglich",
    );
  });

  it("overrides.fallback covers forbidden/validation/tenant_mismatch/hierarchy", () => {
    expect(formatDomainError(errs.forbidden, { fallback: "X" })).toBe("X");
    expect(formatDomainError(errs.validation, { fallback: "X" })).toBe("X");
    expect(formatDomainError(errs.tenant_mismatch, { fallback: "X" })).toBe("X");
    expect(formatDomainError(errs.hierarchy_violation, { fallback: "X" })).toBe("X");
  });

  it("fallback never reaches conflict or not_found (they have their own slots)", () => {
    expect(formatDomainError(errs.conflict, { fallback: "X" })).toBe("Endedatum vor Startdatum");
    expect(formatDomainError(errs.not_found, { fallback: "X" })).toBe("Epic nicht gefunden");
  });
});
