import { describe, it, expect } from "vitest";
import { formatDomainError } from "@/server/http/domain-error-display";
import { catalogTranslate } from "@/test/helpers/catalog";
import type { DomainError } from "@/modules/core/kernel/domain/errors";

/**
 * **Der echte Katalog, nicht `identityTranslate`.**
 *
 * Was diese Naht leistet, sind fertige Sätze — „Epic nicht gefunden" entsteht
 * aus einer Vorlage und einem Ressourcen-Namen. Mit dem Schlüssel-Übersetzer
 * käme davon nur die Vorlage heraus, und der Test sagte nichts mehr über das,
 * wofür er da ist. Nebenbei wirft `catalogTranslate` bei einem Schlüssel, den
 * `de.json` nicht kennt — die Ressourcen-Tabelle kann also nicht unbemerkt
 * hinter `DomainError` zurückfallen.
 */
const t = catalogTranslate("de");
const en = catalogTranslate("en");

const errs: Record<DomainError["kind"], DomainError> = {
  not_found: { kind: "not_found", resourceType: "Epic", id: "x" },
  conflict: { kind: "conflict", reason: "work.errors.endBeforeStart" },
  forbidden: { kind: "forbidden", reason: "errors.forbidden" },
  tenant_mismatch: { kind: "tenant_mismatch", detail: "—" },
  validation: { kind: "validation", issues: [] },
  hierarchy_violation: {
    kind: "hierarchy_violation",
    violatedConstraint: "x",
    detail: "work.errors.featureOtherArt",
  },
  pyramid_violated: { kind: "pyramid_violated", kpiId: "k", existingKeyResultId: "kr" },
};

describe("formatDomainError — Vorgaben", () => {
  it("conflict → der Grund, übersetzt", () => {
    expect(formatDomainError(errs.conflict, {}, t)).toBe(
      "Das Enddatum des geplanten Zeitfensters liegt vor dem Startdatum.",
    );
  });

  it("not_found → Ressourcenname plus „nicht gefunden“", () => {
    expect(formatDomainError(errs.not_found, {}, t)).toBe("Epic nicht gefunden");
    expect(formatDomainError({ kind: "not_found", resourceType: "Team", id: "x" }, {}, t)).toBe(
      "Team nicht gefunden",
    );
    expect(
      formatDomainError({ kind: "not_found", resourceType: "PiStandard", id: "x" }, {}, t),
    ).toBe("PI-Standard nicht gefunden");
  });

  it("nennt dieselbe Ressource auf Englisch anders", () => {
    // Die Probe darauf, dass hier wirklich übersetzt wird und nicht nur eine
    // deutsche Tabelle durchgereicht: „Wertstrom" gegen „Value stream".
    expect(
      formatDomainError({ kind: "not_found", resourceType: "ValueStream", id: "x" }, {}, t),
    ).toBe("Wertstrom nicht gefunden");
    expect(
      formatDomainError({ kind: "not_found", resourceType: "ValueStream", id: "x" }, {}, en),
    ).toBe("Value stream not found");
  });

  it("forbidden → der Grund, übersetzt — wie bei conflict", () => {
    // Bis Zug 5 warf diese Naht `e.reason` hier weg und zeigte immer
    // „Keine Berechtigung". Die Services schreiben aber Sätze, die erklären,
    // *warum* jemand nicht darf — und drei Actions hatten sich deshalb eine
    // eigene Verzweigung gebaut, nur um sie sichtbar zu machen.
    expect(formatDomainError(errs.forbidden, {}, t)).toBe("Keine Berechtigung");
    expect(
      formatDomainError({ kind: "forbidden", reason: "budgeting.errors.onlySpokesperson" }, {}, t),
    ).toBe("Nur der Sprecher (oder ein Einreicher) darf die Verteilung einreichen.");
  });

  it("tenant_mismatch · validation · pyramid → feste Vorgaben", () => {
    expect(formatDomainError(errs.tenant_mismatch, {}, t)).toBe("Mandantenzuordnung passt nicht");
    expect(formatDomainError(errs.validation, {}, t)).toBe("Eingabe ungültig");
    expect(formatDomainError(errs.pyramid_violated, {}, t)).toBe(
      "KPI ist bereits an einen anderen Key Result gebunden",
    );
  });

  it("hierarchy_violation → das Detail, übersetzt", () => {
    expect(formatDomainError(errs.hierarchy_violation, {}, t)).toBe(
      "Das Feature gehört zu einem anderen ART",
    );
  });
});

describe("formatDomainError — Overrides", () => {
  it("notFoundKey ersetzt nur die not_found-Meldung", () => {
    const o = { notFoundKey: "errors.action.epicNotFound" };
    expect(formatDomainError(errs.not_found, o, t)).toBe("Epic nicht gefunden");
    expect(formatDomainError(errs.conflict, o, t)).toBe(
      "Das Enddatum des geplanten Zeitfensters liegt vor dem Startdatum.",
    );
  });

  it("conflictKey ersetzt den Grund", () => {
    expect(formatDomainError(errs.conflict, { conflictKey: "errors.action.actionFailed" }, t)).toBe(
      "Aktion fehlgeschlagen",
    );
  });

  it("forbiddenKey ersetzt den Grund", () => {
    expect(formatDomainError(errs.forbidden, { forbiddenKey: "errors.action.save" }, t)).toBe(
      "Speichern fehlgeschlagen",
    );
  });

  it("fallbackKey deckt validation, tenant_mismatch und hierarchy ab", () => {
    const o = { fallbackKey: "errors.action.save" };
    for (const e of [errs.validation, errs.tenant_mismatch, errs.hierarchy_violation]) {
      expect(formatDomainError(e, o, t)).toBe("Speichern fehlgeschlagen");
    }
  });

  it("fallbackKey erreicht die drei Fehler mit eigenem Grund nicht", () => {
    // `conflict`, `forbidden` und `not_found` tragen ihre Aussage selbst —
    // ein Auffangsatz würde sie überdecken, nicht ergänzen.
    const o = { fallbackKey: "errors.action.save" };
    expect(formatDomainError(errs.conflict, o, t)).toBe(
      "Das Enddatum des geplanten Zeitfensters liegt vor dem Startdatum.",
    );
    expect(formatDomainError(errs.forbidden, o, t)).toBe("Keine Berechtigung");
    expect(formatDomainError(errs.not_found, o, t)).toBe("Epic nicht gefunden");
  });
});
